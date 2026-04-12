from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.mysql import get_db
from sqlalchemy.exc import IntegrityError
from models.user import User, UserCreate, UserLogin, UserResponse, UserUpdate
from utils.jwt_utils import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter()

@router.post("/register")
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check duplicate BEFORE insert
    existing = await db.execute(select(User).where(User.email == user_data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    try:
        user = User(
            email=user_data.email,
            hashed_password=hash_password(user_data.password),
            full_name=user_data.full_name
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        token = create_access_token({"sub": user.id})
        return {"success": True, "data": {"token": token, "user": UserResponse.model_validate(user)}}
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Email already registered")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login")
async def login(user_in: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"sub": user.id})
    return {"success": True, "data": {"token": token, "user": UserResponse.model_validate(user)}}

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {"success": True, "data": UserResponse.model_validate(current_user)}

@router.put("/me")
async def update_me(update_in: UserUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    for field, value in update_in.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return {"success": True, "data": UserResponse.model_validate(current_user)}

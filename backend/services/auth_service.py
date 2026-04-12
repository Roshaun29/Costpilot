from datetime import datetime
from fastapi import HTTPException, status
import bcrypt
from sqlalchemy import select, update
from models.user import UserCreate
from models.sql_models import User as UserSQL
from utils.jwt_utils import create_access_token

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

async def register_user(user_create: UserCreate, session) -> dict:
    # Check email uniqueness
    result = await session.execute(select(UserSQL).filter_by(email=user_create.email))
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    hashed = hash_password(user_create.password)
    
    new_user = UserSQL(
        email=user_create.email,
        full_name=user_create.full_name,
        hashed_password=hashed,
        phone_number=user_create.phone_number,
        notification_prefs=user_create.notification_prefs.model_dump(),
        alert_threshold_percent=user_create.alert_threshold_percent
    )
    
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    
    user_id = str(new_user.id)
    token = create_access_token(data={"sub": user_id})
    
    # Format for response
    return {
        "token": token, 
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "full_name": new_user.full_name,
            "created_at": new_user.created_at
        }
    }

async def login_user(email: str, password: str, session) -> dict:
    result = await session.execute(select(UserSQL).filter_by(email=email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    user_id = str(user.id)
    token = create_access_token(data={"sub": user_id})
    
    return {
        "token": token, 
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "created_at": user.created_at
        }
    }

async def update_user_settings(user_id: int, updates: dict, session) -> dict:
    stmt = (
        update(UserSQL)
        .where(UserSQL.id == user_id)
        .values(**updates, updated_at=datetime.utcnow())
    )
    await session.execute(stmt)
    await session.commit()
    
    result = await session.execute(select(UserSQL).filter_by(id=user_id))
    updated_user = result.scalar_one_or_none()
    
    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    return {
        "id": updated_user.id,
        "email": updated_user.email,
        "full_name": updated_user.full_name,
        "updated_at": updated_user.updated_at
    }

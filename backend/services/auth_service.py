from datetime import datetime
from fastapi import HTTPException, status
import bcrypt
from backend.models.user import UserCreate, UserInDB
from backend.utils.jwt_utils import create_access_token
from bson import ObjectId

def hash_password(password: str) -> str:
    # bcrypt expects bytes
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # bcrypt.checkpw expects (plain_bytes, hashed_bytes)
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

async def register_user(user_create: UserCreate, db) -> dict:
    # Check email uniqueness
    existing_user = await db.users.find_one({"email": user_create.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    hashed = hash_password(user_create.password)
    user_dict = user_create.model_dump(exclude={"password"})
    
    # Explicitly set defaults and type conversion for Pydantic v2/MongoDB compat
    user_dict["hashed_password"] = hashed
    user_dict["created_at"] = datetime.utcnow()
    user_dict["updated_at"] = datetime.utcnow()
    
    result = await db.users.insert_one(user_dict)
    user_id = str(result.inserted_id)
    
    token = create_access_token(data={"sub": user_id})
    
    # Fetch final user for response
    new_user = await db.users.find_one({"_id": result.inserted_id})
    new_user["id"] = str(new_user.pop("_id"))
    new_user.pop("hashed_password")
    
    return {"token": token, "user": new_user}

async def login_user(email: str, password: str, db) -> dict:
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    user_id = str(user["_id"])
    token = create_access_token(data={"sub": user_id})
    
    # Prepare user object for response
    user["id"] = str(user.pop("_id"))
    user.pop("hashed_password")
    
    return {"token": token, "user": user}

async def update_user_settings(user_id: str, updates: dict, db) -> dict:
    updates["updated_at"] = datetime.utcnow()
    result = await db.users.find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$set": updates},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    result["id"] = str(result.pop("_id"))
    result.pop("hashed_password", None)
    return result

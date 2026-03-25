from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from pymongo.errors import DuplicateKeyError

from db.connection import get_users_collection
from models.user import (
    RefreshTokenRequest,
    TokenPair,
    UserCreate,
    UserLogin,
    UserResponse,
    build_user_document,
    serialize_user,
)
from utils.jwt import create_access_token, create_refresh_token, decode_token
from utils.password import get_password_hash, verify_password


router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token, token_type="access")
        subject = payload.get("sub")
        if subject is None or not ObjectId.is_valid(subject):
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    users_collection = get_users_collection()
    user = await users_collection.find_one({"_id": ObjectId(subject), "is_active": True})
    if not user:
        raise credentials_exception
    return user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(payload: UserCreate) -> UserResponse:
    users_collection = get_users_collection()

    existing_user = await users_collection.find_one({"email": str(payload.email)})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    try:
        user_document = build_user_document(
            name=payload.name,
            email=str(payload.email),
            hashed_password=get_password_hash(payload.password),
        )
        result = await users_collection.insert_one(user_document)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to create user account: {exc}",
        ) from exc

    created_user = await users_collection.find_one({"_id": result.inserted_id})
    if not created_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User account was created but could not be loaded",
        )

    return serialize_user(created_user)


@router.post("/login", response_model=TokenPair)
async def login_user(payload: UserLogin) -> TokenPair:
    users_collection = get_users_collection()
    user = await users_collection.find_one({"email": str(payload.email)})

    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    subject = str(user["_id"])
    return TokenPair(
        access_token=create_access_token(subject=subject),
        refresh_token=create_refresh_token(subject=subject),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh_access_token(payload: RefreshTokenRequest) -> TokenPair:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token_payload = decode_token(payload.refresh_token, token_type="refresh")
        subject = token_payload.get("sub")
        if subject is None or not ObjectId.is_valid(subject):
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    users_collection = get_users_collection()
    user = await users_collection.find_one({"_id": ObjectId(subject), "is_active": True})
    if not user:
        raise credentials_exception

    user["updated_at"] = datetime.now(timezone.utc)
    await users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"updated_at": user["updated_at"]}},
    )

    return TokenPair(
        access_token=create_access_token(subject=subject),
        refresh_token=create_refresh_token(subject=subject),
    )


@router.get("/me", response_model=UserResponse)
async def read_current_user(current_user: dict = Depends(get_current_user)) -> UserResponse:
    return serialize_user(current_user)

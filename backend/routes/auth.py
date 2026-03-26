from fastapi import APIRouter, Depends, Request, HTTPException, status
from backend.db.mongodb import get_db
from backend.models.user import UserCreate, UserLogin, UserUpdate, UserResponse
from backend.services.auth_service import register_user, login_user, update_user_settings
from backend.utils.jwt_utils import get_current_user
from backend.utils.response import success_response, error_response
from backend.utils.logger import log_activity

router = APIRouter(tags=["auth"])

@router.post("/register")
async def register(user_data: UserCreate, db = Depends(get_db)):
    try:
        result = await register_user(user_data, db)
        
        # Log activity
        await log_activity(
            db, 
            user_id=result["user"]["id"], 
            action="USER_REGISTER", 
            entity_type="user", 
            entity_id=result["user"]["id"]
        )
        
        return success_response(result, "Registration successful", status.HTTP_201_CREATED)
    except HTTPException as e:
        raise e
    except Exception as e:
        return error_response(f"Internal server error: {str(e)}", status.HTTP_500_INTERNAL_SERVER_ERROR)

@router.post("/login")
async def login(credentials: UserLogin, db = Depends(get_db)):
    try:
        result = await login_user(credentials.email, credentials.password, db)
        
        # Log activity
        await log_activity(
            db, 
            user_id=result["user"]["id"], 
            action="USER_LOGIN", 
            entity_type="user", 
            entity_id=result["user"]["id"]
        )
        
        return success_response(result, "Login successful")
    except HTTPException as e:
        raise e
    except Exception as e:
        return error_response(f"Authentication failed: {str(e)}", status.HTTP_401_UNAUTHORIZED)

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    # Convert _id to string for JSON serialization
    current_user["id"] = str(current_user.pop("_id"))
    current_user.pop("hashed_password", None)
    return success_response(current_user, "User profile retrieved")

@router.put("/me")
async def update_me(
    update_data: UserUpdate, 
    current_user: dict = Depends(get_current_user), 
    db = Depends(get_db)
):
    try:
        user_id = str(current_user["_id"])
        # Filter only full_name as per instruction (though UserUpdate allows more)
        clean_data = {}
        if update_data.full_name is not None:
            clean_data["full_name"] = update_data.full_name
            
        if not clean_data:
            return error_response("No valid fields provided for update", status.HTTP_400_BAD_REQUEST)
            
        updated_user = await update_user_settings(user_id, clean_data, db)
        
        # Log activity
        await log_activity(
            db, 
            user_id=user_id, 
            action="USER_UPDATE_PROFILE", 
            entity_type="user", 
            entity_id=user_id,
            metadata={"fields": list(clean_data.keys())}
        )
        
        return success_response(updated_user, "Profile updated successfully")
    except HTTPException as e:
        raise e
    except Exception as e:
        return error_response(f"Update failed: {str(e)}", status.HTTP_500_INTERNAL_SERVER_ERROR)

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import re
from datetime import datetime
from typing import Optional

from db.mysql import get_db
from utils.jwt_utils import get_current_user, hash_password, verify_password
from utils.response import success_response, error_response
from utils.logger import log_activity
from models.user import User

router = APIRouter(tags=["settings"])

class NotificationPrefs(BaseModel):
    email: bool
    sms: bool
    in_app: bool

class SettingsUpdate(BaseModel):
    phone_number: Optional[str] = None
    notif_email: Optional[bool] = None
    notif_sms: Optional[bool] = None
    notif_in_app: Optional[bool] = None
    alert_threshold_percent: Optional[int] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

@router.get("")
async def get_current_settings(current_user: User = Depends(get_current_user)):
    return success_response({
        "phone_number": current_user.phone_number,
        "notification_prefs": {
            "email": current_user.notif_email,
            "sms": current_user.notif_sms,
            "in_app": current_user.notif_in_app
        },
        "alert_threshold_percent": current_user.alert_threshold_percent,
        "full_name": current_user.full_name,
        "email": current_user.email
    })

@router.put("")
async def update_current_settings(
    updates: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if updates.phone_number:
        if not re.match(r"^\+[1-9]\d{7,14}$", updates.phone_number):
            return error_response("Phone number must be in E.164 format (e.g. +12025551234)", 400)

    # Manual mapping for clarity
    if updates.phone_number is not None: current_user.phone_number = updates.phone_number
    if updates.notif_email is not None: current_user.notif_email = updates.notif_email
    if updates.notif_sms is not None: current_user.notif_sms = updates.notif_sms
    if updates.notif_in_app is not None: current_user.notif_in_app = updates.notif_in_app
    if updates.alert_threshold_percent is not None: current_user.alert_threshold_percent = updates.alert_threshold_percent

    db.add(current_user)
    await db.commit()
    
    await log_activity(db, current_user.id, "settings_updated", "user", current_user.id)
    return success_response(None, "Settings updated")

@router.put("/password")
async def change_password(
    body: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change account password - verifies current password first."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    
    current_user.hashed_password = hash_password(body.new_password)
    db.add(current_user)
    await db.commit()
    
    await log_activity(db, current_user.id, "password_changed", "user", current_user.id)
    return success_response(None, "Password changed successfully")

@router.post("/test-alert")
async def test_alert(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from services.alert_service import send_test_alert
    
    try:
        result = await send_test_alert(current_user, db)
        return success_response(result, "Test alert dispatched")
    except Exception as e:
        return error_response(f"Test alert failed: {str(e)}", 500)

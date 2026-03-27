from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import re
from datetime import datetime
from bson import ObjectId

from backend.db.mongodb import get_db
from backend.utils.jwt_utils import get_current_user
from backend.utils.response import success_response, error_response
from backend.utils.logger import log_activity
from backend.services.auth_service import hash_password, verify_password
from backend.config import settings

router = APIRouter(tags=["settings"])


class NotificationPrefs(BaseModel):
    email: bool
    sms: bool
    in_app: bool


class SettingsUpdate(BaseModel):
    phone_number: str | None = None
    notification_prefs: NotificationPrefs | None = None
    alert_threshold_percent: int | None = None


@router.get("")
async def get_settings(current_user: dict = Depends(get_current_user)):
    return success_response({
        "phone_number": current_user.get("phone_number"),
        "notification_prefs": current_user.get("notification_prefs"),
        "alert_threshold_percent": current_user.get("alert_threshold_percent", 25)
    })


@router.put("")
async def update_settings(
    updates: SettingsUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    uid = current_user["_id"]

    if updates.phone_number:
        if not re.match(r"^\+[1-9]\d{7,14}$", updates.phone_number):
            return error_response("Phone number must be in E.164 format (e.g. +12025551234)", 400)

    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        return error_response("No fields to update")

    await db.users.update_one({"_id": uid}, {"$set": update_data})
    await log_activity(db, str(uid), "settings_updated", "user", str(uid), {"fields": list(update_data.keys())})

    return success_response(None, "Settings updated")


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str


@router.put("/password")
async def update_password(
    payload: PasswordUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    uid = current_user["_id"]
    user = await db.users.find_one({"_id": uid})

    if not verify_password(payload.current_password, user["hashed_password"]):
        return error_response("Incorrect current password", 400)

    if len(payload.new_password) < 8:
        return error_response("New password must be at least 8 characters", 400)

    new_hashed = hash_password(payload.new_password)
    await db.users.update_one({"_id": uid}, {"$set": {"hashed_password": new_hashed}})
    await log_activity(db, str(uid), "password_changed", "user", str(uid))

    return success_response(None, "Password updated")


@router.post("/test-alert")
async def test_alert(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    from backend.services.alert_service import send_test_alert

    uid = current_user["_id"]

    try:
        result = await send_test_alert(current_user, db)
    except Exception as e:
        return error_response(f"Test alert failed: {str(e)}", 500)

    channels_tested = []
    results = {}

    if result.get("in_app"):
        channels_tested.append("in_app")
        results["in_app"] = "success"

    sms_val = result.get("sms", "skipped")
    if sms_val != "skipped":
        channels_tested.append("sms")
        results["sms"] = sms_val

    email_val = result.get("email", "skipped")
    if email_val != "skipped":
        channels_tested.append("email")
        results["email"] = email_val

    return success_response(
        {"channels_tested": channels_tested, "results": results},
        "Test alert dispatched"
    )

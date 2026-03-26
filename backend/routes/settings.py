from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import re
from bson import ObjectId

from backend.db.mongodb import get_db
from backend.utils.jwt_utils import get_current_user
from backend.utils.response import success_response, error_response
from backend.utils.logger import log_activity
from backend.services.auth_service import hash_password, verify_password

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
async def update_settings(updates: SettingsUpdate, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    
    if updates.phone_number:
        if not re.match(r"^\+[1-9]\d{1,14}$", updates.phone_number):
            return error_response("Phone number must be in E.164 format (e.g. +1234567890)", 400)
            
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
async def update_password(payload: PasswordUpdate, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    user = await db.users.find_one({"_id": uid})
    
    if not verify_password(payload.current_password, user["hashed_password"]):
        return error_response("Incorrect current password", 400)
        
    new_hashed = hash_password(payload.new_password)
    await db.users.update_one({"_id": uid}, {"$set": {"hashed_password": new_hashed}})
    await log_activity(db, str(uid), "password_changed", "user", str(uid))
    
    return success_response(None, "Password updated")

@router.post("/test-alert")
async def test_alert(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    prefs = current_user.get("notification_prefs", {})
    phone = current_user.get("phone_number")
    
    channels_tested = []
    results = {}
    
    if prefs.get("in_app", True):
        import datetime
        await db.alerts.insert_one({
            "user_id": uid,
            "anomaly_id": None,
            "account_id": None,
            "channel": "in_app",
            "status": "sent",
            "message": "Test alert - your notifications are working!",
            "sent_at": datetime.datetime.utcnow(),
            "read": False
        })
        channels_tested.append("in_app")
        results["in_app"] = "success"
        
    if prefs.get("sms") and phone:
        twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
        twilio_from = os.environ.get("TWILIO_PHONE_NUMBER")
        
        if twilio_sid and twilio_token and twilio_from:
            try:
                from twilio.rest import Client
                client = Client(twilio_sid, twilio_token)
                client.messages.create(
                    body="CostPilot: This is a real test alert sent to your verified number!",
                    from_=twilio_from,
                    to=phone
                )
                channels_tested.append("sms")
                results["sms"] = "success"
                await db.alerts.insert_one({
                    "user_id": uid, "channel": "sms", "status": "sent", 
                    "message": "Test prompt: real SMS sent", "sent_at": datetime.datetime.utcnow(), "read": False
                })
            except Exception as e:
                channels_tested.append("sms")
                results["sms"] = f"failed: {str(e)}"
        else:
            print(f"[SMS to {phone}]: This is a CostPilot test alert.")
            channels_tested.append("sms")
            results["sms"] = "simulated_success"
            
    if prefs.get("email"):
        print(f"[EMAIL to {current_user.get('email')}]: This is a CostPilot test alert.")
        channels_tested.append("email")
        results["email"] = "simulated_success"
        
    return success_response({
        "channels_tested": channels_tested,
        "results": results
    }, "Test alerts dispatched")

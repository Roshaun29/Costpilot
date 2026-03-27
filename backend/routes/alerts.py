from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import Optional
from bson import ObjectId

from backend.db.mongodb import get_db
from backend.utils.jwt_utils import get_current_user
from backend.utils.response import success_response, error_response, paginated_response

router = APIRouter(tags=["alerts"])


@router.get("")
async def get_alerts(
    read: Optional[bool] = None,
    channel: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    uid = current_user["_id"]
    match_q = {"user_id": uid}
    if read is not None:
        match_q["read"] = read
    if channel is not None:
        match_q["channel"] = channel

    skip = (page - 1) * limit
    cursor = db.alerts.find(match_q).sort("sent_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(None)
    total = await db.alerts.count_documents(match_q)

    for item in items:
        item["id"] = str(item.pop("_id"))
        item["user_id"] = str(item["user_id"])
        item["anomaly_id"] = str(item.get("anomaly_id")) if item.get("anomaly_id") else None
        item["account_id"] = str(item.get("account_id")) if item.get("account_id") else None

    return paginated_response(items, total, page, limit)


@router.get("/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    uid = current_user["_id"]
    count = await db.alerts.count_documents({"user_id": uid, "read": False})
    return success_response({"count": count})


# Support both PUT and PATCH for read-all (PUT for read-all must come before /{id}/read)
@router.put("/read-all")
@router.patch("/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    uid = current_user["_id"]
    await db.alerts.update_many({"user_id": uid, "read": False}, {"$set": {"read": True}})
    return success_response(None, "All marked as read")


@router.put("/{id}/read")
@router.patch("/{id}/read")
async def mark_read(id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    uid = current_user["_id"]
    try:
        oid = ObjectId(id)
    except Exception:
        return error_response("Invalid alert ID", 400)
    res = await db.alerts.update_one({"_id": oid, "user_id": uid}, {"$set": {"read": True}})
    if res.matched_count == 0:
        return error_response("Alert not found", 404)
    return success_response(None, "Marked as read")


@router.delete("/{id}")
async def delete_alert(id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    uid = current_user["_id"]
    try:
        oid = ObjectId(id)
    except Exception:
        return error_response("Invalid alert ID", 400)
    res = await db.alerts.delete_one({"_id": oid, "user_id": uid})
    if res.deleted_count == 0:
        return error_response("Alert not found", 404)
    return success_response(None, "Deleted successfully")

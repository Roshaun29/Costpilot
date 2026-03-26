from datetime import datetime
from bson import ObjectId

def serialize_doc(doc):
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    elif isinstance(doc, dict):
        new_doc = {}
        for k, v in doc.items():
            if k == "_id":
                new_doc["id"] = str(v)
            else:
                new_doc[k] = serialize_doc(v)
        return new_doc
    elif isinstance(doc, ObjectId):
        return str(doc)
    elif isinstance(doc, datetime):
        return doc.isoformat()
    return doc

def success_response(data=None, message="Success", meta=None):
    resp = {
        "success": True,
        "message": message,
        "data": serialize_doc(data) if data is not None else None
    }
    if meta:
        resp["meta"] = meta
    return resp

def error_response(message="An error occurred", details=None):
    resp = {
        "success": False,
        "message": message
    }
    if details:
        resp["details"] = details
    return resp

def paginated_response(items, total, page, limit, message="Success"):
    return success_response(
        data={
            "items": items,
            "total": total,
            "page": page,
            "limit": limit
        },
        message=message
    )

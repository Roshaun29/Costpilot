from datetime import datetime
import json

def serialize_doc(doc):
    """Recursively serializes data, handling datetimes etc."""
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    elif isinstance(doc, dict):
        new_doc = {}
        for k, v in doc.items():
            new_doc[k] = serialize_doc(v)
        return new_doc
    elif isinstance(doc, datetime):
        return doc.isoformat()
    return doc

def success_response(data=None, message="Success", meta=None):
    return {
        "success": True,
        "message": message,
        "data": serialize_doc(data) if data is not None else None,
        "meta": meta
    }

def error_response(message="An error occurred", details=None):
    return {
        "success": False,
        "message": message,
        "details": details
    }

def paginated_response(items, total, page, limit, message="Success"):
    return success_response(
        data={
            "items": serialize_doc(items),
            "total": total,
            "page": page,
            "limit": limit
        },
        message=message
    )

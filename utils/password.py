import bcrypt


def _normalize_password(password: str) -> bytes:
    encoded = password.encode("utf-8")
    if len(encoded) <= 72:
        return encoded
    return encoded[:72]


def get_password_hash(password: str) -> str:
    normalized = _normalize_password(password)
    hashed = bcrypt.hashpw(normalized, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        normalized = _normalize_password(plain_password)
        return bcrypt.checkpw(normalized, hashed_password.encode("utf-8"))
    except (TypeError, ValueError):
        return False

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from config import get_settings


settings = get_settings()


def _create_token(
    subject: str,
    secret_key: str,
    expires_delta: timedelta,
    token_type: str,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    return jwt.encode(payload, secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str) -> str:
    return _create_token(
        subject=subject,
        secret_key=settings.jwt_secret_key,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
        token_type="access",
    )


def create_refresh_token(subject: str) -> str:
    return _create_token(
        subject=subject,
        secret_key=settings.jwt_refresh_secret_key,
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
        token_type="refresh",
    )


def decode_token(token: str, token_type: str) -> dict:
    secret_key = (
        settings.jwt_secret_key
        if token_type == "access"
        else settings.jwt_refresh_secret_key
    )
    payload = jwt.decode(token, secret_key, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != token_type:
        raise JWTError("Invalid token type")
    return payload

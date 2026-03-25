import os
from functools import lru_cache
from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError

load_dotenv()


class Settings(BaseModel):
    app_name: str = Field(default="FastAPI Auth Service")
    app_env: str = Field(default="development")
    app_debug: bool = Field(default=False)
    mongodb_uri: str
    mongodb_db_name: str
    jwt_secret_key: str
    jwt_refresh_secret_key: str
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=15)
    refresh_token_expire_days: int = Field(default=7)
    bcrypt_rounds: int = Field(default=12)
    aws_region: str = Field(default="us-east-1")
    anomaly_contamination: float = Field(default=0.1)
    anomaly_zscore_threshold: float = Field(default=2.5)
    anomaly_min_samples_per_service: int = Field(default=5)


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings(
            app_name=os.getenv("APP_NAME", "FastAPI Auth Service"),
            app_env=os.getenv("APP_ENV", "development"),
            app_debug=os.getenv("APP_DEBUG", "false").lower() == "true",
            mongodb_uri=os.environ["MONGODB_URI"],
            mongodb_db_name=os.environ["MONGODB_DB_NAME"],
            jwt_secret_key=os.environ["JWT_SECRET_KEY"],
            jwt_refresh_secret_key=os.environ["JWT_REFRESH_SECRET_KEY"],
            jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
            access_token_expire_minutes=int(
                os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15")
            ),
            refresh_token_expire_days=int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")),
            bcrypt_rounds=int(os.getenv("BCRYPT_ROUNDS", "12")),
            aws_region=os.getenv("AWS_REGION", "us-east-1"),
            anomaly_contamination=float(os.getenv("ANOMALY_CONTAMINATION", "0.1")),
            anomaly_zscore_threshold=float(
                os.getenv("ANOMALY_ZSCORE_THRESHOLD", "2.5")
            ),
            anomaly_min_samples_per_service=int(
                os.getenv("ANOMALY_MIN_SAMPLES_PER_SERVICE", "5")
            ),
        )
    except KeyError as exc:
        missing_key = exc.args[0]
        raise RuntimeError(f"Missing required environment variable: {missing_key}") from exc
    except ValidationError as exc:
        raise RuntimeError(f"Invalid application configuration: {exc}") from exc

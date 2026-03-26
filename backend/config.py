from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    # MongoDB
    mongodb_url: str = Field(default="mongodb://localhost:27017/costpilot", env="MONGODB_URL")
    db_name: str = "costpilot"

    # JWT
    jwt_secret: str = Field(default="your-super-secret-key-change-this", env="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", env="JWT_ALGORITHM")
    jwt_expire_minutes: int = Field(default=1440, env="JWT_EXPIRE_MINUTES")

    # Twilio
    twilio_account_sid: Optional[str] = Field(default=None, env="TWILIO_ACCOUNT_SID")
    twilio_auth_token: Optional[str] = Field(default=None, env="TWILIO_AUTH_TOKEN")
    twilio_from_number: Optional[str] = Field(default=None, env="TWILIO_FROM_NUMBER")

    # Simulation
    simulation_tick_interval_seconds: int = Field(
        default=30, env="SIMULATION_TICK_INTERVAL_SECONDS"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


settings = Settings()

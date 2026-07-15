from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongo_uri: str = "mongodb://localhost:27017"
    db_name: str = "quizapp"
    jwt_secret: str = "dev-secret-change-me"
    jwt_expire_minutes: int = 1440
    jwt_algorithm: str = "HS256"
    admin_email: str = "admin@quiz.com"
    admin_password: str = "admin123"
    cors_origins: str = "http://localhost:5173"
    email_host: str = ""
    email_port: int = 587
    email_user: str = ""
    email_password: str = ""
    email_from: str = ""
    email_use_tls: bool = True
    sms_otp_expire_minutes: int = 5

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "iDesigner"
    API_PREFIX: str = "/api"

    DATABASE_URL: str = (
        "postgresql+psycopg://idesigner:idesigner_dev_password@db:5432/idesigner"
    )

    SECRET_KEY: str = "change-me-to-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    UPLOAD_DIR: str = "/app/uploads"

    SEED_DEMO: bool = True
    DEMO_EMAIL: str = "designer@idesigner.app"
    DEMO_PASSWORD: str = "demo1234"

    # CORS — frontend dev server
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


settings = Settings()

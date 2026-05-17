"""Конфигурация сервиса Content.

Берёт параметры Postgres из окружения (.env, см. .env.example).
Content держит собственную БД `content` — database-per-service (ADR 0006).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_user: str = "doctj"
    postgres_password: str = "change-me"
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    content_db: str = "content"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.content_db}"
        )


settings = Settings()

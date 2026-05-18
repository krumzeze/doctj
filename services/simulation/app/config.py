"""Конфигурация сервиса Simulation.

Своя БД `simulation` — database-per-service (ADR 0006). Межсервисные
вызовы идут внутри docker-сети по имени сервиса, без JWT (доверенный
периметр на MVP — см. api-kontrakty).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_user: str = "doctj"
    postgres_password: str = "change-me"
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    simulation_db: str = "simulation"

    rabbitmq_user: str = "doctj"
    rabbitmq_password: str = "change-me"
    rabbitmq_host: str = "rabbitmq"
    rabbitmq_port: int = 5672

    # Базовые URL соседних сервисов в docker-сети (ADR 0006).
    content_base_url: str = "http://content:8000"
    patient_llm_base_url: str = "http://patient-llm:8000"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.simulation_db}"
        )

    @property
    def amqp_url(self) -> str:
        return (
            f"amqp://{self.rabbitmq_user}:{self.rabbitmq_password}"
            f"@{self.rabbitmq_host}:{self.rabbitmq_port}/"
        )


settings = Settings()

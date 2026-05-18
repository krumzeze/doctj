"""Конфигурация сервиса Patient-LLM.

Своего хранилища нет — сервис без состояния: контекст приходит в запросе,
к модели ходит только через LLM-Gateway (ADR 0002, 0006).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Базовый URL LLM-Gateway в docker-сети (ADR 0006).
    llm_gateway_base_url: str = "http://llm-gateway:8000"


settings = Settings()

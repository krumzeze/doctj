"""Конфигурация сервиса LLM-Gateway.

Прячет LLM-провайдера за единым контрактом (ADR 0002, 0007). Провайдер
выбирается переменной `LLM_PROVIDER`: `mock` — детерминированный ответ
без сети (по умолчанию, чтобы диалог симуляции работал офлайн на MVP),
`openai` — любой OpenAI-совместимый эндпоинт (в т.ч. YandexGPT/GigaChat).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # mock | openai
    llm_provider: str = "mock"

    # Параметры OpenAI-совместимого провайдера (нужны при llm_provider=openai).
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    llm_timeout_seconds: float = 60.0

    # Температура по умолчанию для роли, если запрос её не задал (ADR 0002):
    # пациент — живой отыгрыш, оценщик — воспроизводимая разметка.
    temperature_patient_reply: float = 0.8
    temperature_evaluation_markup: float = 0.0


settings = Settings()

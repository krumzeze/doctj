"""Identity — пользователи, роли, токены (ADR 0006).

Доменные эндпоинты пока заглушки: возвращают 501 до реализации MVP.
"""
from fastapi import APIRouter, FastAPI, HTTPException

SERVICE = "identity"
app = FastAPI(title=f"doctj — {SERVICE}")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE}


api = APIRouter(prefix="/api/identity")


@api.post("/auth/token")
def issue_token() -> dict:
    """Логин: проверка учётных данных, выдача JWT."""
    raise HTTPException(status_code=501, detail="not implemented")


@api.post("/users")
def register_user() -> dict:
    """Регистрация пользователя с ролью студент/преподаватель/админ."""
    raise HTTPException(status_code=501, detail="not implemented")


@api.get("/users/me")
def current_user() -> dict:
    """Профиль текущего пользователя по токену."""
    raise HTTPException(status_code=501, detail="not implemented")


app.include_router(api)

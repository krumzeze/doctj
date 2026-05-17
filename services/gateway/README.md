# Gateway

Точка входа платформы (ADR 0006). Берём готовый Traefik, не пишем свой —
ADR 0007.

Отдельного кода и Dockerfile у сервиса нет: Traefik поднимается из образа
в `docker-compose.yml`, маршруты задаются через docker-метки на каждом
сервисе (`PathPrefix(/api/<сервис>)`).

Что появится здесь позже: проверка JWT (forward-auth к Identity), TLS,
rate limiting.

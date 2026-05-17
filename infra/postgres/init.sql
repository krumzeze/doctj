-- Database-per-service (ADR 0006). Один контейнер Postgres, отдельная БД
-- на каждый сервис, хранящий состояние. Gateway (Traefik) БД не имеет.
CREATE DATABASE identity;
CREATE DATABASE content;
CREATE DATABASE simulation;
CREATE DATABASE evaluation;
CREATE DATABASE llm_gateway;

-- pgvector нужен только LLM-Gateway (RAG по гайдлайнам, ADR 0007).
\connect llm_gateway
CREATE EXTENSION IF NOT EXISTS vector;

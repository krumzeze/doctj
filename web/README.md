# web — клиент студента doctj

Vite + React 18 + TypeScript + Tailwind v4 + motion + Radix + Phosphor.
Дизайн-направление и токены — [reference/brandbook.md](../../) в Obsidian-vault
(ADR 0008).

## Запуск в dev

```bash
cd web
npm install
npm run dev
```

Dev-сервер на `http://localhost:5173`, `/api/*` проксируется на Traefik
(`http://localhost`), поэтому бэкенд должен быть поднят рядом:

```bash
# из корня репо
docker compose up -d
```

## Шрифты

Шрифты self-hosted (RU-CDN для IBM Plex нет), бинарники не коммитим. На
MVP положите вручную в `public/fonts/`:

```
IBMPlexSans-Regular.woff2
IBMPlexSans-Medium.woff2
IBMPlexSans-SemiBold.woff2
IBMPlexMono-Regular.woff2
IBMPlexMono-Medium.woff2
Newsreader-Regular.woff2
Newsreader-Medium.woff2
```

Источники (OFL):
- IBM Plex — https://github.com/IBM/plex (вытаскиваем `*-Regular/Medium/SemiBold.woff2` из cyrillic подмножества).
- Newsreader — https://github.com/production-type/newsreader.

Скрипт автоматизации появится отдельным срезом — пока вручную, чтобы
не тащить весь IBM Plex (>20 MB) в репозиторий.

## Структура

```
src/
  index.css              токены брендбука (Tailwind v4 @theme) + @font-face
  lib/
    api.ts               клиент к Gateway (api-kontrakty)
    motion.ts            motion-токены брендбука §8
    cn.ts
  components/
    ui/                  Button, Card, Tag — примитивы по brandbook §6
    layout/AppShell.tsx  обёртка экранов: хедер + контейнер 1200px
  pages/
    CasesPage.tsx        первый экран: GET /api/content/cases
  App.tsx, main.tsx
```

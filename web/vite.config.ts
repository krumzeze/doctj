/**
 * Vite-конфиг веб-клиента doctj.
 *
 * Dev-сервер проксирует `/api/*` на Traefik (порт 80 из docker-compose),
 * чтобы фронт ходил по тем же путям, что и в проде. Без прокси пришлось
 * бы CORS-ить каждый сервис в dev-режиме — мусор.
 */
import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Алиас `@` зеркалит `paths` из tsconfig.json — Vite сам tsconfig.paths
    // не читает, без этой строки `import "@/..."` падает в dev/build.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost",
        changeOrigin: true,
      },
    },
  },
});

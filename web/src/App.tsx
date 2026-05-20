/**
 * Корневой компонент и маршруты.
 *
 * Три экрана MVP: список кейсов → сессия → результат. SessionPage и
 * ResultsPage пока заглушки, чтобы маршрут существовал и `CasesPage`
 * мог честно навигировать после создания сессии.
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { CasesPage } from "@/pages/CasesPage";
import { SessionPage } from "@/pages/SessionPage";
import { ResultsPage } from "@/pages/ResultsPage";

export function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<CasesPage />} />
          <Route path="/sessions/:sessionId" element={<SessionPage />} />
          <Route path="/results/:sessionId" element={<ResultsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}

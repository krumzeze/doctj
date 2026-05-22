/**
 * Корневой компонент и маршруты.
 *
 * Экраны студента: список кейсов → сессия → результат. Раздел автора:
 * /editor — список кейсов с правкой, /editor/new — создание,
 * /editor/:caseId/:version — правка версии. Доступ к редактору пока
 * открыт по ссылке; закроем по роли, когда подключим Identity.
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { CasesPage } from "@/pages/CasesPage";
import { SessionPage } from "@/pages/SessionPage";
import { ResultsPage } from "@/pages/ResultsPage";
import { CaseManagePage } from "@/pages/CaseManagePage";
import { EditorPage } from "@/pages/EditorPage";

export function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<CasesPage />} />
          <Route path="/sessions/:sessionId" element={<SessionPage />} />
          <Route path="/results/:sessionId" element={<ResultsPage />} />
          <Route path="/editor" element={<CaseManagePage />} />
          <Route path="/editor/new" element={<EditorPage />} />
          <Route path="/editor/:caseId/:version" element={<EditorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}

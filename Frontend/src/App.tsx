import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { ActiveCallsPage } from './pages/ActiveCallsPage';
import { CallHistoryPage } from './pages/CallHistoryPage';
import { AnalysisReportsPage } from './pages/AnalysisReportsPage';
import { EvidenceViewerPage } from './pages/EvidenceViewerPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpPage } from './pages/HelpPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="active-calls" element={<ActiveCallsPage />} />
          <Route path="call-history" element={<CallHistoryPage />} />
          <Route path="reports" element={<AnalysisReportsPage />} />
          <Route path="evidence" element={<EvidenceViewerPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;

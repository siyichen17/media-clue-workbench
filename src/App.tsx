import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell.tsx'
import { CompetePage } from './pages/CompetePage.tsx'
import { HotPage } from './pages/HotPage.tsx'
import { LeadsPage } from './pages/LeadsPage.tsx'
import { OverviewPage } from './pages/OverviewPage.tsx'
import { ReportPage } from './pages/ReportPage.tsx'
import { ReportsPage } from './pages/ReportsPage.tsx'
import { ScreenEditPage } from './pages/ScreenEditPage.tsx'
import { ScreenListPage } from './pages/ScreenListPage.tsx'
import { ScreenViewPage } from './pages/ScreenViewPage.tsx'
import { DataSourcePage } from './pages/DataSourcePage.tsx'
import { AlertsPage } from './pages/AlertsPage.tsx'
import { KpiPage } from './pages/KpiPage.tsx'
import { SystemPage } from './pages/SystemPage.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/screen/view/:id" element={<ScreenViewPage />} />
      <Route path="*" element={(
        <AppShell>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/compete" element={<CompetePage />} />
            <Route path="/hot" element={<HotPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/:id" element={<ReportPage />} />
            <Route path="/screen" element={<ScreenListPage />} />
            <Route path="/screen/edit/:id" element={<ScreenEditPage />} />
            <Route path="/source" element={<DataSourcePage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/kpi" element={<KpiPage />} />
            <Route path="/settings" element={<SystemPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      )} />
    </Routes>
  )
}

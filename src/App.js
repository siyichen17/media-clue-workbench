import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell.tsx';
import { CompetePage } from './pages/CompetePage.tsx';
import { HotPage } from './pages/HotPage.tsx';
import { LeadsPage } from './pages/LeadsPage.tsx';
import { OverviewPage } from './pages/OverviewPage.tsx';
import { ReportPage } from './pages/ReportPage.tsx';
export default function App() {
    return (_jsx(AppShell, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(OverviewPage, {}) }), _jsx(Route, { path: "/compete", element: _jsx(CompetePage, {}) }), _jsx(Route, { path: "/hot", element: _jsx(HotPage, {}) }), _jsx(Route, { path: "/leads", element: _jsx(LeadsPage, {}) }), _jsx(Route, { path: "/reports/:id", element: _jsx(ReportPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }));
}

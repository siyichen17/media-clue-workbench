import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from '../icons.tsx';
const GROUPS = [
    {
        label: '监测发现',
        items: [
            { id: 'overview', label: '线索总览', icon: 'overview' },
            { id: 'hot', label: '热搜追踪', icon: 'hot' },
            { id: 'compete', label: '竞品监控', icon: 'compete' },
        ],
    },
    {
        label: '线索处理',
        items: [
            { id: 'leads', label: '线索管理', icon: 'leads' },
            { id: 'reports', label: '报告中心', icon: 'reports' },
        ],
    },
    {
        label: '展示',
        items: [{ id: 'screen', label: '可视化大屏', icon: 'screen' }],
    },
    {
        label: '管理',
        items: [
            { id: 'source', label: '数据源管理', icon: 'source' },
            { id: 'alerts', label: '告警中心', icon: 'bell' },
            { id: 'kpi', label: 'KPI监控', icon: 'kpi' },
            { id: 'settings', label: '系统管理', icon: 'settings' },
        ],
    },
];
function itemActive(id, pathname) {
    if (id === 'overview')
        return pathname === '/';
    if (id === 'compete')
        return pathname === '/compete' || pathname.startsWith('/reports/');
    if (id === 'hot')
        return pathname === '/hot';
    if (id === 'leads')
        return pathname === '/leads';
    return false;
}
export function AppShell({ children }) {
    const { pathname } = useLocation();
    return (_jsxs("div", { className: "app-shell", children: [_jsxs("aside", { className: "sidebar", children: [_jsxs("div", { className: "brand", children: [_jsx("span", { className: "brand-mark", "aria-hidden": "true", children: "\u7EBF" }), _jsxs("span", { children: [_jsx("strong", { children: "\u5168\u7F51\u7EBF\u7D22" }), _jsx("small", { children: "\u5DE5\u4F5C\u53F0" })] })] }), _jsx("nav", { className: "nav", "aria-label": "\u4E3B\u5BFC\u822A", children: GROUPS.map((group) => (_jsxs("section", { className: "nav-group", children: [_jsx("h2", { children: group.label }), group.items.map((item) => {
                                    const enabled = item.id === 'overview' || item.id === 'compete' || item.id === 'hot' || item.id === 'leads';
                                    if (!enabled) {
                                        return (_jsxs("button", { type: "button", className: "nav-item", disabled: true, children: [_jsx(Icon, { name: item.icon }), _jsx("span", { children: item.label }), _jsx("em", { children: "\u5F85\u5EFA\u8BBE" })] }, item.id));
                                    }
                                    const to = item.id === 'overview' ? '/' : item.id === 'hot' ? '/hot' : item.id === 'leads' ? '/leads' : '/compete';
                                    return (_jsxs(NavLink, { to: to, className: itemActive(item.id, pathname) ? 'nav-item active' : 'nav-item', "aria-current": itemActive(item.id, pathname) ? 'page' : undefined, children: [_jsx(Icon, { name: item.icon }), _jsx("span", { children: item.label })] }, item.id));
                                })] }, group.label))) }), _jsx("p", { className: "sidebar-foot", children: "\u7EBF\u7D22\u603B\u89C8\u3001\u70ED\u641C\u8FFD\u8E2A\u3001\u7ADE\u54C1\u76D1\u63A7\u4E0E\u7EBF\u7D22\u7BA1\u7406\u53EF\u8FDB\u5165" })] }), _jsx("div", { className: "workspace", children: children })] }));
}

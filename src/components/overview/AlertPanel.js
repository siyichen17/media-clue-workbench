import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { ALERT_KIND_LABEL, sortAlerts } from '../../lib/alerts.ts';
import { formatStamp } from '../../lib/dates.ts';
import { WATCH_KEYWORDS } from '../../data/demo/index.ts';
export function AlertPanel({ alerts, readIds, onOpen, onToggleRead, }) {
    const [mode, setMode] = useState('latest');
    const sorted = useMemo(() => sortAlerts(alerts, mode), [alerts, mode]);
    let previousKind = null;
    return (_jsxs("div", { className: "alert-panel", children: [_jsx("div", { className: "alert-toolbar", children: _jsxs("div", { className: "segmented", role: "group", "aria-label": "\u63D0\u9192\u6392\u5E8F", children: [_jsx("button", { type: "button", "aria-pressed": mode === 'latest', onClick: () => setMode('latest'), children: "\u6700\u65B0" }), _jsx("button", { type: "button", "aria-pressed": mode === 'magnitude', onClick: () => setMode('magnitude'), children: "\u53D8\u5316\u5E45\u5EA6" })] }) }), _jsxs("p", { className: "chart-note", children: ["\u9884\u8BBE\u5173\u6CE8\u5173\u952E\u8BCD\uFF1A", WATCH_KEYWORDS.join('、'), "\u3002\u62A5\u9053\u589E\u52A0\u53EA\u5728\u76F8\u90BB\u65E5\u671F\u7684\u65B0\u95FB\u6761\u6570\u81F3\u5C11\u591A 2 \u6761\u65F6\u751F\u6210\u3002"] }), mode === 'magnitude' && (_jsx("p", { className: "chart-note", children: "\u53D8\u5316\u5E45\u5EA6\u6309\u63D0\u9192\u7C7B\u578B\u5206\u7EC4\u3002\u6392\u540D\u53D8\u5316\u53EA\u4E0E\u6392\u540D\u53D8\u5316\u6BD4\u8F83\uFF0C\u62A5\u9053\u6761\u6570\u53EA\u4E0E\u62A5\u9053\u6761\u6570\u6BD4\u8F83\u3002" })), sorted.length === 0 ? (_jsx("div", { className: "empty-state", children: "\u5F53\u524D\u7B5B\u9009\u4E0B\u6CA1\u6709\u53EF\u6838\u67E5\u7684\u52A8\u6001\u63D0\u9192" })) : (_jsx("ul", { className: "alert-list", "data-testid": "alert-list", children: sorted.map((alert) => {
                    const showGroup = mode === 'magnitude' && alert.kind !== previousKind;
                    previousKind = alert.kind;
                    const read = readIds.has(alert.id);
                    return (_jsxs("li", { children: [showGroup && _jsx("p", { className: "alert-group", children: ALERT_KIND_LABEL[alert.kind] }), _jsxs("article", { className: read ? 'alert-item read' : 'alert-item', children: [_jsxs("button", { type: "button", className: "alert-main", onClick: () => onOpen(alert), children: [_jsx("span", { className: "alert-kind", children: ALERT_KIND_LABEL[alert.kind] }), _jsx("strong", { children: alert.topicName }), _jsx("span", { className: "alert-time", children: formatStamp(alert.triggerAt) }), _jsx("span", { className: "alert-summary", children: alert.summary }), _jsx("span", { className: "alert-magnitude", children: alert.magnitudeLabel })] }), _jsx("button", { type: "button", className: "btn tiny", onClick: () => onToggleRead(alert.id), children: read ? '标为未读' : '标为已读' })] })] }, alert.id));
                }) }))] }));
}

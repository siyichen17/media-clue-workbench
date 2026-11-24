import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ChartCard({ title, caption, extra, empty, emptyText = '没有符合条件的新闻', children, testId, className, }) {
    return (_jsxs("section", { className: className ? `card ${className}` : 'card', "data-testid": testId, children: [_jsxs("header", { className: "card-head", children: [_jsxs("div", { children: [_jsx("h2", { children: title }), _jsx("p", { children: caption })] }), extra] }), _jsx("div", { className: "card-body", children: empty ? _jsx("div", { className: "empty-state", children: emptyText }) : children })] }));
}

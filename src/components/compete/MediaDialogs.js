import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
function splitKeywords(value) {
    return value
        .split(/[，,]/)
        .map((item) => item.trim())
        .filter(Boolean);
}
export function MediaManager({ state, onClose, onSave, }) {
    const [draft, setDraft] = useState(state);
    const [name, setName] = useState('');
    function update(id, patch) {
        setDraft((current) => ({
            ...current,
            profiles: current.profiles.map((item) => (item.id === id ? { ...item, ...patch } : item)),
            ownMediaId: patch.enabled === false && current.ownMediaId === id ? 'cover' : current.ownMediaId,
        }));
    }
    return (_jsxs("div", { className: "modal-root", children: [_jsx("button", { type: "button", className: "drawer-mask", "aria-label": "\u5173\u95ED\u5A92\u4F53\u7BA1\u7406", onClick: onClose }), _jsxs("section", { className: "modal-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "media-manager-title", children: [_jsxs("header", { className: "drawer-head", children: [_jsxs("div", { children: [_jsx("h2", { id: "media-manager-title", children: "\u7BA1\u7406\u5A92\u4F53" }), _jsx("p", { className: "chart-note", children: "\u505C\u7528\u540E\u4E0D\u518D\u8FDB\u5165\u9ED8\u8BA4\u5BF9\u7167\uFF0C\u5DF2\u6709\u65B0\u95FB\u4ECD\u4FDD\u7559\u3002\u6CA1\u6709\u62A5\u9053\u7684\u5A92\u4F53\u4F1A\u663E\u793A\u6682\u65E0\u6570\u636E\u3002" })] }), _jsx("button", { type: "button", className: "icon-button", onClick: onClose, "aria-label": "\u5173\u95ED", children: "\u00D7" })] }), _jsxs("div", { className: "drawer-scroll", children: [_jsxs("label", { className: "field", children: ["\u672C\u5A92\u4F53", _jsx("select", { value: draft.ownMediaId, onChange: (event) => setDraft((current) => ({ ...current, ownMediaId: event.target.value })), children: draft.profiles.filter((item) => item.enabled).map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id))) })] }), draft.profiles.map((item) => (_jsxs("article", { className: "editor-block", children: [_jsxs("div", { className: "title-row", children: [_jsx("strong", { children: item.builtin ? item.name : '自建媒体' }), _jsxs("label", { className: "check-line", children: [_jsx("input", { type: "checkbox", checked: item.enabled, onChange: (event) => update(item.id, { enabled: event.target.checked }) }), "\u542F\u7528"] }), !item.builtin && (_jsx("button", { type: "button", className: "btn tiny", onClick: () => setDraft((current) => ({
                                                    ...current,
                                                    profiles: current.profiles.filter((profile) => profile.id !== item.id),
                                                })), children: "\u5220\u9664" }))] }), _jsxs("label", { className: "field", children: ["\u540D\u79F0", _jsx("input", { value: item.name, onChange: (event) => update(item.id, { name: event.target.value }) })] }), _jsxs("label", { className: "field", children: ["\u5B98\u7F51", _jsx("input", { value: item.site, placeholder: "https://", onChange: (event) => update(item.id, { site: event.target.value }) })] }), _jsxs("label", { className: "field", children: ["\u5173\u6CE8\u5173\u952E\u8BCD", _jsx("input", { value: item.keywords.join('，'), onChange: (event) => update(item.id, { keywords: splitKeywords(event.target.value) }) })] }), _jsxs("label", { className: "field", children: ["\u5907\u6CE8", _jsx("input", { value: item.note, onChange: (event) => update(item.id, { note: event.target.value }) })] })] }, item.id))), _jsxs("div", { className: "title-row", children: [_jsx("input", { "aria-label": "\u65B0\u5A92\u4F53\u540D\u79F0", value: name, placeholder: "\u65B0\u5A92\u4F53\u540D\u79F0", onChange: (event) => setName(event.target.value) }), _jsx("button", { type: "button", className: "btn", disabled: !name.trim(), onClick: () => {
                                            const id = `custom-${Date.now().toString(36)}`;
                                            setDraft((current) => ({
                                                ...current,
                                                profiles: [
                                                    ...current.profiles,
                                                    { id, name: name.trim(), site: '', keywords: [], note: '', enabled: true, builtin: false },
                                                ],
                                            }));
                                            setName('');
                                        }, children: "\u65B0\u589E\u5A92\u4F53" })] })] }), _jsxs("footer", { className: "modal-foot", children: [_jsx("button", { type: "button", className: "btn ghost", onClick: onClose, children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "btn active", onClick: () => onSave(draft), children: "\u4FDD\u5B58" })] })] })] }));
}
export function AlertRuleDialog({ mediaName, mediaId, rules, onClose, onSave, }) {
    const [draft, setDraft] = useState(() => {
        const kinds = ['daily_count', 'keyword', 'hot_event'];
        return kinds.map((kind) => {
            return (rules.find((rule) => rule.mediaId === mediaId && rule.kind === kind) ?? {
                id: `${mediaId}:${kind}`,
                mediaId,
                kind,
                enabled: false,
                threshold: 5,
                keywords: [],
            });
        });
    });
    function patch(kind, next) {
        setDraft((current) => current.map((rule) => (rule.kind === kind ? { ...rule, ...next } : rule)));
    }
    return (_jsxs("div", { className: "modal-root", children: [_jsx("button", { type: "button", className: "drawer-mask", "aria-label": "\u5173\u95ED\u9884\u8B66\u8BBE\u7F6E", onClick: onClose }), _jsxs("section", { className: "modal-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "alert-rule-title", children: [_jsxs("header", { className: "drawer-head", children: [_jsxs("div", { children: [_jsxs("h2", { id: "alert-rule-title", children: ["\u8BBE\u7F6E\u9884\u8B66 \u00B7 ", mediaName] }), _jsx("p", { className: "chart-note", children: "\u89C4\u5219\u53EA\u6839\u636E\u5DF2\u6536\u5F55\u62A5\u9053\u548C\u70ED\u699C\u5FEB\u7167\u8BA1\u7B97\uFF0C\u4E0D\u8C03\u7528\u6A21\u578B\u3002\u6A21\u62DF\u6570\u636E\u89E6\u53D1\u7684\u8BB0\u5F55\u4F1A\u6807\u660E\u6A21\u62DF\u3002" })] }), _jsx("button", { type: "button", className: "icon-button", onClick: onClose, "aria-label": "\u5173\u95ED", children: "\u00D7" })] }), _jsx("div", { className: "drawer-scroll", children: draft.map((rule) => (_jsxs("article", { className: "editor-block", children: [_jsxs("label", { className: "check-line", children: [_jsx("input", { type: "checkbox", checked: rule.enabled, onChange: (event) => patch(rule.kind, { enabled: event.target.checked }) }), rule.kind === 'daily_count' && '单日已收录报道数达到阈值', rule.kind === 'keyword' && '新增报道命中关键词', rule.kind === 'hot_event' && '报道所属话题出现在热榜'] }), rule.kind === 'daily_count' && (_jsxs("label", { className: "field", children: ["\u9608\u503C", _jsx("input", { type: "number", min: 1, value: rule.threshold, onChange: (event) => patch(rule.kind, { threshold: Number(event.target.value) || 1 }) })] })), rule.kind === 'keyword' && (_jsxs("label", { className: "field", children: ["\u5173\u952E\u8BCD\uFF0C\u7528\u9017\u53F7\u5206\u9694", _jsx("input", { value: rule.keywords.join('，'), onChange: (event) => patch(rule.kind, { keywords: splitKeywords(event.target.value) }) })] }))] }, rule.kind))) }), _jsxs("footer", { className: "modal-foot", children: [_jsx("button", { type: "button", className: "btn ghost", onClick: onClose, children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "btn active", onClick: () => onSave(draft), children: "\u4FDD\u5B58\u89C4\u5219" })] })] })] }));
}

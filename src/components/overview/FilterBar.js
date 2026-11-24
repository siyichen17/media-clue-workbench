import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PLATFORMS } from '../../data/demo/index.ts';
import { DATA_END, DATA_START, dateRangeOf, presetLabel } from '../../lib/dates.ts';
function keepDay(filters) {
    if (!filters.selectedDay)
        return filters;
    const { start, end } = dateRangeOf(filters);
    if (filters.selectedDay < start || filters.selectedDay > end) {
        return { ...filters, selectedDay: null };
    }
    return filters;
}
export function FilterBar({ filters, onChange, }) {
    const range = dateRangeOf(filters);
    const tags = [
        { id: 'range', label: `${presetLabel(filters.preset)} · ${range.start} 至 ${range.end}` },
        ...(filters.selectedDay ? [{ id: 'day', label: `单日 ${filters.selectedDay}` }] : []),
        ...(filters.platform !== 'all' ? [{ id: 'platform', label: `平台 ${filters.platform}` }] : []),
        ...(filters.keyword.trim() ? [{ id: 'keyword', label: `关键词 ${filters.keyword.trim()}` }] : []),
    ];
    function setPreset(preset) {
        onChange(keepDay({ ...filters, preset }));
    }
    function clearTag(id) {
        if (id === 'range') {
            onChange(keepDay({
                ...filters,
                preset: '7d',
                customStart: '2026-11-04',
                customEnd: DATA_END,
            }));
            return;
        }
        if (id === 'day')
            onChange({ ...filters, selectedDay: null });
        if (id === 'platform')
            onChange({ ...filters, platform: 'all' });
        if (id === 'keyword')
            onChange({ ...filters, keyword: '' });
    }
    return (_jsxs("section", { className: "filter-bar", "aria-label": "\u7B5B\u9009", children: [_jsxs("div", { className: "filter-controls", children: [_jsxs("div", { className: "field", children: [_jsx("span", { children: "\u65E5\u671F\u8303\u56F4" }), _jsxs("div", { className: "segmented", role: "group", "aria-label": "\u65E5\u671F\u8303\u56F4", children: [_jsx("button", { type: "button", "aria-pressed": filters.preset === '7d', onClick: () => setPreset('7d'), children: "\u6700\u8FD17\u5929" }), _jsx("button", { type: "button", "aria-pressed": filters.preset === '14d', onClick: () => setPreset('14d'), children: "\u6700\u8FD114\u5929" }), _jsx("button", { type: "button", "aria-pressed": filters.preset === 'custom', onClick: () => setPreset('custom'), children: "\u81EA\u5B9A\u4E49" })] })] }), filters.preset === 'custom' && (_jsxs("div", { className: "field dates", children: [_jsxs("label", { children: ["\u5F00\u59CB", _jsx("input", { type: "date", min: DATA_START, max: DATA_END, value: filters.customStart, onChange: (event) => onChange(keepDay({ ...filters, preset: 'custom', customStart: event.target.value })) })] }), _jsxs("label", { children: ["\u7ED3\u675F", _jsx("input", { type: "date", min: DATA_START, max: DATA_END, value: filters.customEnd, onChange: (event) => onChange(keepDay({ ...filters, preset: 'custom', customEnd: event.target.value })) })] })] })), _jsxs("label", { className: "field", children: [_jsx("span", { children: "\u53D1\u5E03\u5E73\u53F0" }), _jsxs("select", { value: filters.platform, onChange: (event) => onChange({ ...filters, platform: event.target.value }), children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u5E73\u53F0" }), PLATFORMS.map((platform) => (_jsx("option", { value: platform, children: platform }, platform)))] })] }), _jsxs("label", { className: "field grow", children: [_jsx("span", { children: "\u5173\u952E\u8BCD" }), _jsx("input", { type: "search", placeholder: "\u641C\u7D22\u6807\u9898\u3001\u8BDD\u9898\u3001\u4E8B\u4EF6\u6216\u5A92\u4F53", value: filters.keyword, onChange: (event) => onChange({ ...filters, keyword: event.target.value }) })] }), _jsx("button", { type: "button", className: "btn ghost", onClick: () => onChange({
                            preset: '7d',
                            customStart: '2026-11-04',
                            customEnd: DATA_END,
                            selectedDay: null,
                            platform: 'all',
                            keyword: '',
                        }), children: "\u91CD\u7F6E\u7B5B\u9009" })] }), _jsx("div", { className: "tag-row", children: tags.map((tag) => (_jsxs("button", { type: "button", className: "filter-tag", onClick: () => clearTag(tag.id), children: [tag.label, _jsx("span", { "aria-hidden": "true", children: "\u00D7" }), _jsx("span", { className: "sr-only", children: "\u53D6\u6D88" })] }, tag.id))) })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES } from '../../data/demo/catalog.ts';
import { MONITOR_NEWS } from '../../data/demo/monitor.ts';
import { AiRequestError } from '../../lib/aiClient.ts';
import { filterMonitorNews, sharedEvents } from '../../lib/competeSelectors.ts';
import { profileName } from '../../lib/competeStorage.ts';
import { dateRangeOf, formatStamp, presetLabel } from '../../lib/dates.ts';
import { generateReportDocument } from '../../lib/generateReport.ts';
import { levelLabel, materialLevel, natureLabel } from '../../lib/material.ts';
import { buildReportStats, snapshotMaterial } from '../../lib/reportStats.ts';
const STAGES = ['准备材料', '提取要点', '生成对比', '校验结果'];
const ITEM_LIMIT = 12;
const CHAR_LIMIT = 36000;
function charsOf(items) {
    return items.reduce((total, item) => total + item.title.length + item.summary.length + item.body.length, 0);
}
export function ReportWizard({ filters, profiles, initialType, initialEventId, initialRange, onClose, onCreated, }) {
    const [step, setStep] = useState(1);
    const [kind, setKind] = useState(initialType);
    const [scopeFilters, setScopeFilters] = useState(() => initialRange ? { ...filters, preset: 'custom', customStart: initialRange.start, customEnd: initialRange.end } : filters);
    const [eventId, setEventId] = useState(initialEventId ?? '');
    const [picked, setPicked] = useState(null);
    const [samplingNote, setSamplingNote] = useState(null);
    const [openId, setOpenId] = useState(null);
    const [stage, setStage] = useState(null);
    const [error, setError] = useState('');
    const [running, setRunning] = useState(false);
    const range = dateRangeOf(scopeFilters);
    const scopeKey = `${kind}|${eventId}|${range.start}|${range.end}|${scopeFilters.categoryId}|${scopeFilters.ownMediaId}|${scopeFilters.peerIds.join(',')}|${scopeFilters.nature}`;
    useEffect(() => {
        setPicked(null);
        setSamplingNote(null);
    }, [scopeKey]);
    const scoped = useMemo(() => filterMonitorNews(scopeFilters).news, [scopeFilters]);
    const events = useMemo(() => {
        const grouped = new Map();
        for (const item of scoped) {
            const list = grouped.get(item.eventId) ?? [];
            list.push(item);
            grouped.set(item.eventId, list);
        }
        return [...grouped.entries()].map(([id, rows]) => ({
            id,
            name: rows[0].eventName,
            mediaCount: new Set(rows.map((item) => item.mediaId)).size,
        }));
    }, [scoped]);
    const eventNews = kind === 'event' ? scoped.filter((item) => item.eventId === eventId) : scoped;
    const materials = useMemo(() => eventNews.map((item) => snapshotMaterial(item, profiles)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), [eventNews, profiles]);
    const selectedIds = picked ?? new Set(materials.map((item) => item.articleId));
    const selected = materials.filter((item) => selectedIds.has(item.articleId));
    const mediaIds = [scopeFilters.ownMediaId, ...scopeFilters.peerIds.filter((id) => id !== scopeFilters.ownMediaId)];
    const covered = new Set(selected.map((item) => item.mediaId));
    const readyMedia = mediaIds.filter((id) => covered.has(id));
    const tooLarge = selected.length > ITEM_LIMIT || charsOf(selected) > CHAR_LIMIT;
    const canGenerate = readyMedia.length >= 2 && !tooLarge && !running && (kind === 'date' || Boolean(eventId));
    function toggle(id) {
        const next = new Set(selectedIds);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);
        setPicked(next);
        setSamplingNote(null);
    }
    function applySample() {
        const next = new Set();
        for (const mediaId of mediaIds) {
            materials
                .filter((item) => item.mediaId === mediaId)
                .slice(0, 3)
                .forEach((item) => next.add(item.articleId));
        }
        const omitted = materials.length - next.size;
        setPicked(next);
        setSamplingNote(omitted > 0 ? `已确认抽样：每家媒体保留最新 3 篇，其余 ${omitted} 篇不进入模型。` : null);
    }
    async function generate() {
        if (!canGenerate || running)
            return;
        setRunning(true);
        setError('');
        const event = events.find((item) => item.id === eventId) ?? null;
        const reportFilters = { ...scopeFilters, preset: 'custom', customStart: range.start, customEnd: range.end };
        const reportScope = {
            kind,
            filters: reportFilters,
            eventId: kind === 'event' ? eventId : null,
            eventName: kind === 'event' ? event?.name ?? null : null,
            mediaIds,
            samplingNote,
        };
        const stats = buildReportStats(kind === 'event' ? eventNews : filterMonitorNews(reportFilters, MONITOR_NEWS).news, selected, reportScope, profiles);
        const title = kind === 'event' ? `${event?.name ?? '事件'}内容对比` : `${range.start} 至 ${range.end} 报道结构对比`;
        try {
            const report = await generateReportDocument({
                title,
                scope: reportScope,
                stats,
                materials: selected,
                onStage: setStage,
            });
            onCreated(report.id, selected.length);
        }
        catch (caught) {
            const message = caught instanceof AiRequestError ? caught.message : caught instanceof Error ? caught.message : '报告生成失败';
            setError(message);
            setStage(null);
            setRunning(false);
        }
    }
    return (_jsxs("div", { className: "modal-root", children: [_jsx("button", { type: "button", className: "drawer-mask", "aria-label": "\u5173\u95ED\u62A5\u544A\u914D\u7F6E", onClick: running ? undefined : onClose }), _jsxs("section", { className: "modal-panel wide", role: "dialog", "aria-modal": "true", "aria-labelledby": "wizard-title", children: [_jsxs("header", { className: "drawer-head", children: [_jsxs("div", { children: [_jsx("h2", { id: "wizard-title", children: "\u751F\u6210\u5BF9\u6BD4\u62A5\u544A" }), _jsxs("p", { className: "chart-note", children: ["\u7B2C ", step, " \u6B65 / 3 \u00B7 ", ['确定范围', '确认材料', '生成'][step - 1]] })] }), _jsx("button", { type: "button", className: "icon-button", onClick: onClose, disabled: running, "aria-label": "\u5173\u95ED", children: "\u00D7" })] }), _jsxs("div", { className: "drawer-scroll", children: [step === 1 && (_jsxs("div", { className: "stack", children: [_jsxs("div", { className: "segmented", role: "group", "aria-label": "\u62A5\u544A\u7C7B\u578B", children: [_jsx("button", { type: "button", "aria-pressed": kind === 'date', onClick: () => setKind('date'), children: "\u65E5\u671F\u5BF9\u6BD4\u62A5\u544A" }), _jsx("button", { type: "button", "aria-pressed": kind === 'event', onClick: () => setKind('event'), children: "\u540C\u4E00\u4E8B\u4EF6\u5BF9\u6BD4\u62A5\u544A" })] }), _jsx("p", { className: "chart-note", children: kind === 'date'
                                            ? '比较这段时间各家关注什么、报道结构有什么差异。不同事件不做事实覆盖比较。'
                                            : '只比较同一个事件里各家写了什么。未收录不等于没有报道。' }), _jsxs("div", { className: "filter-controls", children: [_jsx("div", { className: "segmented", children: ['7d', '14d', 'custom'].map((preset) => (_jsx("button", { type: "button", "aria-pressed": scopeFilters.preset === preset, onClick: () => setScopeFilters((current) => ({ ...current, preset })), children: presetLabel(preset) }, preset))) }), _jsxs("label", { className: "field", children: ["\u5F00\u59CB", _jsx("input", { type: "date", value: range.start, onChange: (event) => setScopeFilters((current) => ({ ...current, preset: 'custom', customStart: event.target.value })) })] }), _jsxs("label", { className: "field", children: ["\u7ED3\u675F", _jsx("input", { type: "date", value: range.end, onChange: (event) => setScopeFilters((current) => ({ ...current, preset: 'custom', customEnd: event.target.value })) })] })] }), _jsxs("label", { className: "field", children: ["\u672C\u5A92\u4F53", _jsx("select", { value: scopeFilters.ownMediaId, onChange: (event) => setScopeFilters((current) => ({
                                                    ...current,
                                                    ownMediaId: event.target.value,
                                                    peerIds: current.peerIds.filter((id) => id !== event.target.value),
                                                })), children: profiles.filter((item) => item.enabled).map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id))) })] }), _jsxs("fieldset", { className: "check-grid", children: [_jsx("legend", { children: "\u5BF9\u7167\u5A92\u4F53" }), profiles
                                                .filter((item) => item.enabled && item.id !== scopeFilters.ownMediaId)
                                                .map((item) => (_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: scopeFilters.peerIds.includes(item.id), onChange: (event) => setScopeFilters((current) => ({
                                                            ...current,
                                                            peerIds: event.target.checked
                                                                ? [...current.peerIds, item.id]
                                                                : current.peerIds.filter((id) => id !== item.id),
                                                        })) }), item.name] }, item.id)))] }), _jsxs("label", { className: "field", children: ["\u5206\u7C7B", _jsxs("select", { value: scopeFilters.categoryId, onChange: (event) => setScopeFilters((current) => ({ ...current, categoryId: event.target.value })), children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u5206\u7C7B" }), CATEGORIES.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] })] }), kind === 'event' && (_jsxs("label", { className: "field", children: ["\u4E8B\u4EF6", _jsxs("select", { value: eventId, onChange: (event) => setEventId(event.target.value), children: [_jsx("option", { value: "", children: "\u9009\u62E9\u4E8B\u4EF6" }), events.map((item) => (_jsxs("option", { value: item.id, children: [item.name, " \u00B7 ", item.mediaCount, " \u5BB6\u5A92\u4F53"] }, item.id)))] })] })), _jsxs("p", { className: "chart-note", children: ["\u5F53\u524D\u8303\u56F4\u5185\u6709\u5171\u540C\u4E8B\u4EF6 ", sharedEvents(scoped, scopeFilters.ownMediaId).length, " \u4E2A\u3002\u4E8B\u4EF6\u6309 eventId \u533A\u5206\uFF0C\u4E0D\u6309\u5173\u952E\u8BCD\u5408\u5E76\u3002"] })] })), step === 2 && (_jsxs("div", { className: "stack", children: [_jsxs("div", { className: "title-row", children: [_jsxs("strong", { children: ["\u5DF2\u9009 ", selected.length, " \u7BC7 / \u8303\u56F4\u5185 ", materials.length, " \u7BC7"] }), _jsx("button", { type: "button", className: "btn tiny", onClick: () => setPicked(new Set(materials.map((item) => item.articleId))), children: "\u5168\u9009\u5F53\u524D\u7B5B\u9009\u7ED3\u679C" }), _jsx("button", { type: "button", className: "btn tiny", onClick: () => setPicked(new Set()), children: "\u5168\u90E8\u53D6\u6D88" })] }), _jsxs("p", { className: "chart-note", children: ["\u7EDF\u8BA1\u8303\u56F4\u662F\u5F53\u524D\u6761\u4EF6\u4E0B\u7684\u5DF2\u6536\u5F55\u62A5\u9053 ", eventNews.length, " \u7BC7\u3002\u6A21\u578B\u53EA\u9605\u8BFB\u52FE\u9009\u7684 ", selected.length, " \u7BC7\uFF0C\u5176\u4E2D\u5168\u6587 ", selected.filter((item) => item.completeness === 'full').length, "\u3001\u6458\u8981 ", selected.filter((item) => item.completeness === 'summary').length, "\u3001\u4EC5\u6807\u9898 ", selected.filter((item) => item.completeness === 'title').length, "\u3002"] }), selected.some((item) => item.completeness === 'title') && (_jsx("p", { className: "sim-banner", children: "\u5B58\u5728\u4EC5\u6807\u9898\u6750\u6599\u3002\u8FD9\u7C7B\u6750\u6599\u53EA\u80FD\u505A\u4E3B\u9898\u5BF9\u7167\uFF0C\u4E0D\u80FD\u6BD4\u8F83\u6B63\u6587\u5185\u5BB9\u3002" })), mediaIds.filter((id) => !covered.has(id)).length > 0 && (_jsxs("p", { className: "chart-note", children: ["\u4EE5\u4E0B\u5A92\u4F53\u5728\u6240\u9009\u6750\u6599\u4E2D\u4E3A\u7A7A\uFF0C\u62A5\u544A\u4F1A\u4FDD\u7559\u7A7A\u5217\uFF1A", mediaIds.filter((id) => !covered.has(id)).map((id) => profileName(profiles, id)).join('、')] })), mediaIds.map((mediaId) => {
                                        const rows = materials.filter((item) => item.mediaId === mediaId);
                                        return (_jsxs("section", { children: [_jsxs("h3", { children: [profileName(profiles, mediaId), " \u00B7 \u5DF2\u9009 ", rows.filter((item) => selectedIds.has(item.articleId)).length, " / ", rows.length] }), rows.length === 0 ? (_jsx("p", { className: "chart-note", children: "\u6240\u9009\u6761\u4EF6\u4E0B\u6CA1\u6709\u8BE5\u5A92\u4F53\u7684\u6750\u6599\u3002" })) : (rows.map((item) => (_jsxs("article", { className: "pick-row", children: [_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: selectedIds.has(item.articleId), onChange: () => toggle(item.articleId) }), _jsx("span", { children: item.title })] }), _jsxs("span", { className: "news-meta", children: [_jsx("span", { children: formatStamp(item.publishedAt) }), _jsx("span", { children: levelLabel(item.completeness) }), _jsx("span", { children: natureLabel(item.nature) })] }), _jsx("button", { type: "button", className: "btn tiny", onClick: () => setOpenId(openId === item.articleId ? null : item.articleId), children: openId === item.articleId ? '收起正文' : '查看正文' }), openId === item.articleId && (_jsxs("div", { className: "editor-block", children: [_jsx("p", { className: "sim-banner", children: item.nature === 'simulated' ? '模拟报道，非该媒体实际发布。此处只展示站内全文。' : '站内保存的原文。' }), _jsx("p", { children: item.summary || '没有摘要。' }), (item.body || item.title).split('\n\n').map((paragraph) => (_jsx("p", { children: paragraph }, paragraph.slice(0, 24))))] }))] }, item.articleId))))] }, mediaId));
                                    })] })), step === 3 && (_jsxs("div", { className: "stack", children: [_jsxs("p", { children: [kind === 'date' ? '日期对比' : '事件对比', " \u00B7 ", range.start, " \u81F3 ", range.end, " \u00B7 \u5C06\u5206\u6790 ", selected.length, " \u7BC7\u3002"] }), tooLarge && (_jsxs("div", { className: "sim-banner", children: [_jsxs("p", { children: ["\u5F53\u524D\u9009\u62E9\u8D85\u8FC7\u5355\u6B21\u5904\u7406\u9650\u5236\uFF08\u6700\u591A ", ITEM_LIMIT, " \u7BC7\u6216 ", CHAR_LIMIT, " \u5B57\uFF09\u3002\u8BF7\u8FD4\u56DE\u7F29\u5C0F\u9009\u62E9\uFF0C\u6216\u660E\u786E\u91C7\u7528\u62BD\u6837\u3002"] }), _jsx("button", { type: "button", className: "btn", onClick: applySample, children: "\u6BCF\u5BB6\u5A92\u4F53\u4FDD\u7559\u6700\u65B0 3 \u7BC7" })] })), samplingNote && _jsx("p", { className: "chart-note", children: samplingNote }), readyMedia.length < 2 && _jsx("p", { className: "sim-banner", children: "\u81F3\u5C11\u9700\u8981\u4E24\u5BB6\u5A92\u4F53\u5404\u6709\u4E00\u6761\u5DF2\u9009\u6750\u6599\u3002" }), selected.some((item) => materialLevel(item) === 'title') && (_jsx("p", { className: "chart-note", children: "\u4EC5\u6807\u9898\u6750\u6599\u4E0D\u4F1A\u88AB\u7528\u6765\u5224\u65AD\u6B63\u6587\u6DF1\u5EA6\u3002" })), stage && (_jsx("ol", { className: "stage-list", children: STAGES.map((item) => (_jsxs("li", { className: item === stage ? 'active' : undefined, children: [item, item === stage ? ' · 进行中' : ''] }, item))) })), error && (_jsxs("div", { className: "sim-banner", children: [_jsx("p", { children: error }), _jsx("p", { children: "\u9009\u62E9\u5DF2\u4FDD\u7559\uFF0C\u53EF\u4EE5\u91CD\u8BD5\u3002\u5931\u8D25\u65F6\u4E0D\u4F1A\u7528\u6837\u4F8B\u62A5\u544A\u4EE3\u66FF\u3002" })] }))] }))] }), _jsxs("footer", { className: "modal-foot", children: [step > 1 && (_jsx("button", { type: "button", className: "btn ghost", disabled: running, onClick: () => setStep((value) => value - 1), children: "\u4E0A\u4E00\u6B65" })), step < 3 && (_jsx("button", { type: "button", className: "btn active", disabled: kind === 'event' && !eventId, onClick: () => setStep((value) => value + 1), children: "\u4E0B\u4E00\u6B65" })), step === 3 && (_jsx("button", { type: "button", className: "btn active", disabled: !canGenerate, onClick: () => void generate(), children: running ? '正在生成' : error ? '重试' : '开始生成' }))] })] })] }));
}

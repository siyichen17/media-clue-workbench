import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AiRequestError, requestSection } from '../lib/aiClient.ts';
import { toAiMaterial } from '../lib/generateReport.ts';
import { profileName, loadMediaState } from '../lib/competeStorage.ts';
import { formatStamp } from '../lib/dates.ts';
import { levelLabel, natureLabel } from '../lib/material.ts';
import { attachReport, visibleLeads } from '../lib/leads.ts';
import { loadReport, saveReport } from '../lib/reportStore.ts';
const TOC = [
    ['scope', '比较范围与材料说明'],
    ['stats', '数据概览'],
    ['compare', '核心对比'],
    ['diff', '主要差异'],
    ['summary', '对比总结'],
    ['actions', '下一步建议'],
    ['refs', '参考材料'],
];
export function ReportPage() {
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const leadFromState = location.state?.leadId;
    const linkedLeadId = leadFromState || visibleLeads().find((lead) => lead.reportRefs.some((ref) => ref.reportId === id))?.id;
    const [report, setReport] = useState(null);
    const [missing, setMissing] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [editing, setEditing] = useState(null);
    const [evidenceId, setEvidenceId] = useState(null);
    const [activeToc, setActiveToc] = useState('scope');
    const [preview, setPreview] = useState(null);
    const [instruction, setInstruction] = useState('');
    const [sectionError, setSectionError] = useState('');
    const [busy, setBusy] = useState(false);
    const [leaveOpen, setLeaveOpen] = useState(false);
    const profiles = loadMediaState().profiles;
    useEffect(() => {
        let cancelled = false;
        void loadReport(id).then((loaded) => {
            if (cancelled)
                return;
            if (!loaded)
                setMissing(true);
            else
                setReport(loaded);
        });
        return () => {
            cancelled = true;
        };
    }, [id]);
    useEffect(() => {
        if (!dirty)
            return;
        const onLeave = (event) => {
            event.preventDefault();
        };
        window.addEventListener('beforeunload', onLeave);
        return () => window.removeEventListener('beforeunload', onLeave);
    }, [dirty]);
    useEffect(() => {
        const nodes = TOC.map(([key]) => document.getElementById(`sec-${key}`)).filter((node) => Boolean(node));
        if (!nodes.length)
            return;
        const observer = new IntersectionObserver((entries) => {
            const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (visible?.target.id)
                setActiveToc(visible.target.id.replace('sec-', ''));
        }, { rootMargin: '-20% 0px -60% 0px' });
        nodes.forEach((node) => observer.observe(node));
        return () => observer.disconnect();
    }, [report]);
    const evidence = report?.materials.find((item) => item.articleId === evidenceId) ?? null;
    const extract = report?.extraction.find((item) => item.articleId === evidenceId) ?? null;
    const numberOf = useMemo(() => {
        const map = new Map();
        report?.materials.forEach((item, index) => map.set(item.articleId, index + 1));
        return map;
    }, [report]);
    function patch(mutator) {
        setReport((current) => (current ? mutator(current) : current));
        setDirty(true);
    }
    async function persist(next, markSaved) {
        const saved = { ...next, status: markSaved ? 'saved' : next.status, updatedAt: new Date().toISOString() };
        await saveReport(saved);
        if (markSaved && leadFromState)
            attachReport(leadFromState, saved.id, saved.materials.length);
        setReport(saved);
        setDirty(false);
    }
    function tryLeave() {
        if (dirty)
            setLeaveOpen(true);
        else
            navigate('/compete');
    }
    async function regenerate(section) {
        if (!report || busy)
            return;
        setBusy(true);
        setSectionError('');
        try {
            const result = await requestSection({
                section,
                instruction,
                kind: report.type,
                stats: report.stats,
                materials: report.materials.map(toAiMaterial),
                extracts: report.extraction,
                mediaIds: report.scope.mediaIds,
                sections: report.sections,
            });
            setPreview({ section, result });
        }
        catch (error) {
            setSectionError(error instanceof AiRequestError ? error.message : '这一节没有生成');
        }
        finally {
            setBusy(false);
        }
    }
    function applyPreview() {
        if (!report || !preview)
            return;
        const sections = structuredClone(report.sections);
        const history = { ...report.history };
        if (preview.section === 'comparison' && preview.result.comparisonDimensions) {
            history.comparison = [...(history.comparison ?? []), report.sections.comparisonDimensions];
            sections.comparisonDimensions = preview.result.comparisonDimensions;
        }
        if (preview.section === 'differences' && preview.result.keyDifferences) {
            history.differences = [...(history.differences ?? []), report.sections.keyDifferences];
            sections.keyDifferences = preview.result.keyDifferences;
        }
        if (preview.section === 'summary' && preview.result.summary) {
            history.summary = [...(history.summary ?? []), report.sections.summary];
            sections.summary = preview.result.summary;
        }
        if (preview.section === 'actions' && preview.result.nextActions) {
            history.actions = [...(history.actions ?? []), report.sections.nextActions];
            sections.nextActions = preview.result.nextActions;
        }
        const next = { ...report, sections, history, status: 'draft' };
        void persist(next, false);
        setPreview(null);
        setEditing(null);
    }
    function restore(section) {
        if (!report)
            return;
        const sections = structuredClone(report.sections);
        const history = { ...report.history };
        if (section === 'comparison' && history.comparison?.length)
            sections.comparisonDimensions = history.comparison.pop();
        if (section === 'differences' && history.differences?.length)
            sections.keyDifferences = history.differences.pop();
        if (section === 'summary' && history.summary?.length)
            sections.summary = history.summary.pop();
        if (section === 'actions' && history.actions?.length)
            sections.nextActions = history.actions.pop();
        void persist({ ...report, sections, history, status: 'draft' }, false);
    }
    if (missing) {
        return (_jsxs("main", { className: "page", children: [_jsx("h1", { children: "\u6CA1\u6709\u627E\u5230\u62A5\u544A" }), _jsx("button", { type: "button", className: "btn", onClick: () => navigate('/compete'), children: "\u8FD4\u56DE\u7ADE\u54C1\u76D1\u63A7" })] }));
    }
    if (!report)
        return _jsx("main", { className: "page", children: "\u6B63\u5728\u8BFB\u53D6\u62A5\u544A" });
    const names = (mediaId) => profileName(profiles, mediaId) || report.materials.find((item) => item.mediaId === mediaId)?.mediaName || mediaId;
    return (_jsxs("main", { className: "report-page", children: [_jsxs("header", { className: "report-toolbar no-print", children: [_jsx("button", { type: "button", className: "btn ghost", onClick: tryLeave, children: "\u8FD4\u56DE\u7ADE\u54C1\u76D1\u63A7" }), linkedLeadId && _jsx("button", { type: "button", className: "btn ghost", onClick: () => navigate(`/leads?lead=${linkedLeadId}`), children: "\u8FD4\u56DE\u7EBF\u7D22" }), _jsxs("div", { children: [editing === 'title' ? (_jsx("input", { "aria-label": "\u62A5\u544A\u6807\u9898", value: report.title, onChange: (event) => patch((current) => ({ ...current, title: event.target.value })) })) : (_jsx("h1", { children: report.title })), _jsxs("p", { className: "chart-note", children: [report.status === 'saved' && !dirty ? '已保存' : '草稿', dirty ? ' · 有未保存修改' : ''] })] }), _jsx("button", { type: "button", className: "btn tiny", onClick: () => setEditing(editing === 'title' ? null : 'title'), children: "\u7F16\u8F91\u6807\u9898" }), _jsx("button", { type: "button", className: "btn active", onClick: () => void persist(report, true), children: "\u4FDD\u5B58" }), _jsx("button", { type: "button", className: "btn", onClick: () => {
                            if (dirty) {
                                setLeaveOpen(true);
                                return;
                            }
                            navigate('/compete', { state: { wizard: { type: report.type, eventId: report.scope.eventId ?? undefined } } });
                        }, children: "\u4FEE\u6539\u6BD4\u8F83\u8303\u56F4" }), _jsx("button", { type: "button", className: "btn", onClick: () => {
                            if (dirty) {
                                setSectionError('请先保存。导出使用已保存的编辑版本。');
                                return;
                            }
                            window.print();
                        }, children: "\u5BFC\u51FA PDF" })] }), _jsxs("div", { className: "report-layout", children: [_jsx("nav", { className: "report-toc no-print", "aria-label": "\u7AE0\u8282", children: TOC.map(([key, label]) => (_jsx("a", { href: `#sec-${key}`, className: activeToc === key ? 'active' : undefined, children: label }, key))) }), _jsxs("article", { className: "report-sheet", children: [_jsx("p", { className: "sim-banner", children: report.stats.simulatedCount && !report.stats.realCount ? '模拟演示报告。结论只描述本次选中的演示材料，不是媒体真实发表内容。' : '报告包含真实与模拟材料，请按参考材料中的标记区分。' }), _jsxs("p", { className: "chart-note", children: ["\u6570\u91CF\u4EE5\u751F\u6210\u65F6\u7684\u7CFB\u7EDF\u7EDF\u8BA1\u4E3A\u51C6\u3002\u5F15\u7528\u53EA\u6821\u9A8C\u662F\u5426\u5C5E\u4E8E\u6240\u9009\u6750\u6599\uFF0C\u4E0D\u80FD\u8BC1\u660E\u5168\u90E8\u4E8B\u5B9E\u5DF2\u7ECF\u6838\u5B9E\u3002\u63D0\u793A\u8BCD ", report.promptVersion, "\u3002"] }), sectionError && _jsx("p", { className: "sim-banner no-print", children: sectionError }), _jsxs("section", { id: "sec-scope", children: [_jsx("h2", { children: "\u6BD4\u8F83\u8303\u56F4\u4E0E\u6750\u6599\u8BF4\u660E" }), _jsx("p", { children: report.type === 'date' ? '这是日期对比，回答各家在这段时间关注什么、报道结构有何差异。' : `这是事件对比，只讨论「${report.scope.eventName}」。` }), _jsxs("p", { children: ["\u7EDF\u8BA1\u533A\u95F4 ", report.stats.rangeLabel, "\u3002\u6A21\u578B\u5B9E\u9645\u9605\u8BFB ", report.stats.analyzedCount, " \u7BC7\uFF0C\u5176\u4E2D\u5168\u6587 ", report.stats.fullCount, "\u3001\u6458\u8981 ", report.stats.summaryCount, "\u3001\u4EC5\u6807\u9898 ", report.stats.titleCount, "\u3002\u6A21\u62DF ", report.stats.simulatedCount, " \u7BC7\uFF0C\u771F\u5B9E ", report.stats.realCount, " \u7BC7\u3002"] }), report.scope.samplingNote && _jsx("p", { children: report.scope.samplingNote }), _jsx("ul", { children: report.sections.limitations.map((item) => _jsx("li", { children: item }, item)) })] }), _jsxs("section", { id: "sec-stats", children: [_jsx("h2", { children: "\u6570\u636E\u6982\u89C8" }), _jsxs("p", { children: ["\u5DF2\u6536\u5F55\u62A5\u9053 ", report.stats.newsCount, " \u7BC7\uFF0C\u4E8B\u4EF6 ", report.stats.eventCount, " \u4E2A\uFF0C\u6D89\u53CA\u4E0A\u699C\u8BDD\u9898\u7684\u62A5\u9053 ", report.stats.hotNewsCount, " \u7BC7\u3002\u4E0B\u8868\u6765\u81EA\u751F\u6210\u65F6\u7684\u7EDF\u8BA1\u5FEB\u7167\u3002"] }), _jsx(StatTable, { report: report, names: names })] }), _jsxs("section", { id: "sec-compare", children: [_jsx(SectionHead, { title: "\u6838\u5FC3\u5BF9\u6BD4", editing: editing === 'comparison', canRestore: Boolean(report.history.comparison?.length), onEdit: () => setEditing(editing === 'comparison' ? null : 'comparison'), onRegen: () => void regenerate('comparison'), onRestore: () => restore('comparison'), busy: busy }), _jsx("div", { className: "compare-board", children: report.sections.comparisonDimensions.map((dimension, dimensionIndex) => (_jsxs("section", { className: "compare-dimension", children: [_jsx("h3", { children: dimension.dimension }), _jsx("div", { className: "compare-findings", children: report.scope.mediaIds.map((mediaId) => {
                                                        const finding = dimension.mediaFindings.find((item) => item.mediaId === mediaId);
                                                        return (_jsxs("article", { className: "compare-finding", children: [_jsx("h4", { children: names(mediaId) }), !finding ? (_jsx("p", { children: "\u6240\u9009\u6750\u6599\u4E2D\u6CA1\u6709\u8BE5\u5A92\u4F53\u7684\u62A5\u9053" })) : (_jsxs(_Fragment, { children: [editing === 'comparison' ? (_jsx("textarea", { value: finding.text, onChange: (event) => patch((current) => {
                                                                                const sections = structuredClone(current.sections);
                                                                                const target = sections.comparisonDimensions[dimensionIndex].mediaFindings.find((item) => item.mediaId === mediaId);
                                                                                if (target)
                                                                                    target.text = event.target.value;
                                                                                return { ...current, sections };
                                                                            }) })) : (_jsx("p", { children: finding.text })), _jsx(CiteList, { ids: finding.articleIds, numberOf: numberOf, onOpen: setEvidenceId }), editing === 'comparison' && (_jsx(CitationEditor, { mediaId: mediaId, materials: report.materials, ids: finding.articleIds, onChange: (articleIds) => patch((current) => {
                                                                                const sections = structuredClone(current.sections);
                                                                                const target = sections.comparisonDimensions[dimensionIndex].mediaFindings.find((item) => item.mediaId === mediaId);
                                                                                if (target)
                                                                                    target.articleIds = articleIds;
                                                                                return { ...current, sections };
                                                                            }) }))] }))] }, mediaId));
                                                    }) })] }, dimension.dimension))) })] }), _jsxs("section", { id: "sec-diff", children: [_jsx(SectionHead, { title: "\u4E3B\u8981\u5DEE\u5F02", editing: editing === 'differences', canRestore: Boolean(report.history.differences?.length), onEdit: () => setEditing(editing === 'differences' ? null : 'differences'), onRegen: () => void regenerate('differences'), onRestore: () => restore('differences'), busy: busy }), report.sections.keyDifferences.length === 0 ? _jsx("p", { children: "\u672C\u6B21\u6750\u6599\u91CC\u6CA1\u6709\u8DB3\u591F\u4F9D\u636E\u5199\u51FA\u660E\u786E\u5DEE\u5F02\u3002" }) : (_jsx("ol", { children: report.sections.keyDifferences.map((item, index) => (_jsxs("li", { children: [editing === 'differences' ? (_jsx("textarea", { value: item.text, onChange: (event) => patch((current) => {
                                                        const sections = structuredClone(current.sections);
                                                        sections.keyDifferences[index].text = event.target.value;
                                                        return { ...current, sections };
                                                    }) })) : item.text, _jsx(CiteList, { ids: item.articleIds, numberOf: numberOf, onOpen: setEvidenceId })] }, `${item.text.slice(0, 12)}-${index}`))) }))] }), _jsxs("section", { id: "sec-summary", children: [_jsx(SectionHead, { title: "\u5BF9\u6BD4\u603B\u7ED3", editing: editing === 'summary', canRestore: Boolean(report.history.summary?.length), onEdit: () => setEditing(editing === 'summary' ? null : 'summary'), onRegen: () => void regenerate('summary'), onRestore: () => restore('summary'), busy: busy }), editing === 'summary' ? (_jsx("textarea", { value: report.sections.summary.text, onChange: (event) => patch((current) => ({ ...current, sections: { ...current.sections, summary: { ...current.sections.summary, text: event.target.value } } })) })) : _jsx("p", { children: report.sections.summary.text }), _jsx(CiteList, { ids: report.sections.summary.articleIds, numberOf: numberOf, onOpen: setEvidenceId })] }), _jsxs("section", { id: "sec-actions", children: [_jsx(SectionHead, { title: "\u4E0B\u4E00\u6B65\u5EFA\u8BAE", editing: editing === 'actions', canRestore: Boolean(report.history.actions?.length), onEdit: () => setEditing(editing === 'actions' ? null : 'actions'), onRegen: () => void regenerate('actions'), onRestore: () => restore('actions'), busy: busy }), _jsx("ul", { children: report.sections.nextActions.map((item, index) => (_jsxs("li", { children: [editing === 'actions' ? (_jsx("textarea", { value: item.text, onChange: (event) => patch((current) => {
                                                        const sections = structuredClone(current.sections);
                                                        sections.nextActions[index].text = event.target.value;
                                                        return { ...current, sections };
                                                    }) })) : item.text, _jsx(CiteList, { ids: item.basedOnArticleIds, numberOf: numberOf, onOpen: setEvidenceId })] }, index))) }), _jsxs("label", { className: "field", children: ["\u7528\u6237\u5907\u6CE8", _jsx("textarea", { value: report.notes, onChange: (event) => patch((current) => ({ ...current, notes: event.target.value })) })] })] }), _jsxs("section", { id: "sec-refs", children: [_jsx("h2", { children: "\u53C2\u8003\u6750\u6599" }), _jsx("ol", { className: "ref-list", children: report.materials.map((item) => (_jsxs("li", { id: `ref-${item.articleId}`, children: [_jsx("button", { type: "button", className: "text-button", onClick: () => setEvidenceId(item.articleId), children: item.title }), _jsxs("span", { className: "news-meta", children: [_jsx("span", { children: item.mediaName }), _jsx("span", { children: formatStamp(item.publishedAt) }), _jsx("span", { children: levelLabel(item.completeness) }), _jsx("span", { children: natureLabel(item.nature) })] })] }, item.articleId))) })] })] }), _jsx("aside", { className: evidence ? 'evidence' : 'evidence hidden', "aria-label": "\u8BC1\u636E", children: evidence && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "title-row", children: [_jsx("h2", { children: "\u8BC1\u636E" }), _jsx("button", { type: "button", className: "icon-button", "aria-label": "\u5173\u95ED\u8BC1\u636E", onClick: () => setEvidenceId(null), children: "\u00D7" })] }), _jsx("p", { children: evidence.title }), _jsxs("p", { className: "news-meta", children: [_jsx("span", { children: evidence.mediaName }), _jsx("span", { children: evidence.columnName }), _jsx("span", { children: formatStamp(evidence.publishedAt) })] }), _jsx("p", { className: "sim-banner", children: evidence.nature === 'simulated' ? '模拟材料。下面是站内全文，不是媒体官网链接。' : '真实材料。原文保存在站内，不另造外部链接。' }), _jsx("button", { type: "button", className: "btn tiny", onClick: () => document.getElementById('evidence-body')?.scrollIntoView({ block: 'nearest' }), children: evidence.nature === 'simulated' ? '站内全文' : '查看原文' }), extract && (_jsxs("ul", { children: [extract.facts.map((fact) => _jsxs("li", { children: ["\u6458\u5F55\uFF1A", fact.quote] }, fact.quote)), extract.attributed.map((fact) => _jsxs("li", { children: [fact.who, "\uFF1A", fact.quote] }, fact.quote))] })), _jsx("div", { id: "evidence-body", children: (evidence.body || evidence.summary || evidence.title).split('\n\n').map((paragraph) => _jsx("p", { children: paragraph }, paragraph.slice(0, 20))) })] })) })] }), _jsxs("label", { className: "field no-print regen-note", children: ["\u91CD\u65B0\u751F\u6210\u65F6\u7684\u4FEE\u6539\u8981\u6C42", _jsx("input", { value: instruction, onChange: (event) => setInstruction(event.target.value), placeholder: "\u4F8B\u5982\uFF1A\u53EA\u4FDD\u7559\u80FD\u5728\u6458\u5F55\u91CC\u6838\u5BF9\u7684\u5DEE\u5F02" })] }), preview && (_jsxs("div", { className: "modal-root", children: [_jsx("div", { className: "drawer-mask" }), _jsxs("section", { className: "modal-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "preview-title", children: [_jsx("header", { className: "drawer-head", children: _jsx("h2", { id: "preview-title", children: "\u786E\u8BA4\u66FF\u6362\u8FD9\u4E00\u8282" }) }), _jsxs("div", { className: "drawer-scroll", children: [_jsx("p", { children: "\u5F53\u524D\u7F16\u8F91\u4E0D\u4F1A\u88AB\u76F4\u63A5\u8986\u76D6\uFF0C\u786E\u8BA4\u540E\u624D\u66FF\u6362\uFF0C\u5E76\u4FDD\u7559\u4E0A\u4E00\u7248\u3002" }), _jsx("pre", { className: "preview-block", children: JSON.stringify(preview.result, null, 2) })] }), _jsxs("footer", { className: "modal-foot", children: [_jsx("button", { type: "button", className: "btn ghost", onClick: () => setPreview(null), children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "btn active", onClick: applyPreview, children: "\u786E\u8BA4\u66FF\u6362" })] })] })] })), leaveOpen && (_jsxs("div", { className: "modal-root", children: [_jsx("div", { className: "drawer-mask" }), _jsxs("section", { className: "modal-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "leave-title", children: [_jsx("header", { className: "drawer-head", children: _jsx("h2", { id: "leave-title", children: "\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539" }) }), _jsx("p", { className: "drawer-scroll", children: "\u53EF\u4EE5\u5148\u4FDD\u5B58\u5F53\u524D\u7F16\u8F91\uFF0C\u6216\u653E\u5F03\u8FD9\u4E9B\u4FEE\u6539\u540E\u79BB\u5F00\u3002" }), _jsxs("footer", { className: "modal-foot", children: [_jsx("button", { type: "button", className: "btn ghost", onClick: () => setLeaveOpen(false), children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "btn", onClick: () => navigate('/compete'), children: "\u653E\u5F03\u4FEE\u6539" }), _jsx("button", { type: "button", className: "btn active", onClick: () => void persist(report, true).then(() => navigate('/compete')), children: "\u4FDD\u5B58\u5E76\u79BB\u5F00" })] })] })] }))] }));
}
function StatTable({ report, names }) {
    return (_jsxs("div", { className: "table-wrap", children: [_jsxs("table", { className: "data-table compare-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u5A92\u4F53" }), _jsx("th", { children: "\u5DF2\u6536\u5F55" }), _jsx("th", { children: "\u4E8B\u4EF6" }), _jsx("th", { children: "\u6D89\u53CA\u4E0A\u699C\u62A5\u9053" }), _jsx("th", { children: "\u8FDB\u5165\u5206\u6790" }), _jsx("th", { children: "\u6240\u9009\u6700\u65E9" }), _jsx("th", { children: "\u6240\u9009\u6700\u8FD1" })] }) }), _jsx("tbody", { children: report.stats.byMedia.map((item) => (_jsxs("tr", { children: [_jsx("th", { children: names(item.mediaId) }), _jsx("td", { children: item.newsCount }), _jsx("td", { children: item.eventCount }), _jsx("td", { children: item.hotNewsCount }), _jsx("td", { children: item.selectedCount }), _jsx("td", { children: item.earliest ? formatStamp(item.earliest) : '—' }), _jsx("td", { children: item.latest ? formatStamp(item.latest) : '—' })] }, item.mediaId))) })] }), report.type === 'date' && (_jsxs("table", { className: "data-table", children: [_jsx("caption", { children: "\u5206\u7C7B\u6536\u5F55\uFF0C\u6309\u751F\u6210\u65F6\u5FEB\u7167" }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u5206\u7C7B" }), report.scope.mediaIds.map((id) => _jsx("th", { children: names(id) }, id))] }) }), _jsx("tbody", { children: report.stats.byCategory.map((row) => (_jsxs("tr", { children: [_jsx("th", { children: row.name }), report.scope.mediaIds.map((id) => _jsx("td", { children: row.counts[id] ?? 0 }, id))] }, row.name))) })] }))] }));
}
function SectionHead({ title, editing, canRestore, busy, onEdit, onRegen, onRestore, }) {
    return (_jsxs("div", { className: "title-row", children: [_jsx("h2", { children: title }), _jsx("button", { type: "button", className: "btn tiny no-print", onClick: onEdit, children: editing ? '完成编辑' : '编辑' }), _jsx("button", { type: "button", className: "btn tiny no-print", disabled: busy, onClick: onRegen, children: "\u91CD\u65B0\u751F\u6210" }), canRestore && _jsx("button", { type: "button", className: "btn tiny no-print", onClick: onRestore, children: "\u6062\u590D\u4E0A\u4E00\u7248" })] }));
}
function CiteList({ ids, numberOf, onOpen }) {
    if (!ids.length)
        return null;
    return (_jsx("span", { className: "cite-list", children: ids.map((id) => (_jsxs("button", { type: "button", className: "cite", onClick: () => onOpen(id), children: ["[", numberOf.get(id) ?? '?', "]"] }, id))) }));
}
function CitationEditor({ mediaId, materials, ids, onChange, }) {
    const choices = materials.filter((item) => item.mediaId === mediaId);
    return (_jsxs("label", { className: "field no-print", children: ["\u5F15\u7528", _jsxs("select", { value: "", onChange: (event) => {
                    const articleId = event.target.value;
                    if (!articleId || ids.includes(articleId))
                        return;
                    onChange([...ids, articleId]);
                }, children: [_jsx("option", { value: "", children: "\u6DFB\u52A0\u5F15\u7528" }), choices.map((item) => _jsx("option", { value: item.articleId, children: item.title }, item.articleId))] }), ids.map((id) => (_jsxs("button", { type: "button", className: "btn tiny", onClick: () => onChange(ids.filter((item) => item !== id)), children: ["\u79FB\u9664 ", id] }, id)))] }));
}

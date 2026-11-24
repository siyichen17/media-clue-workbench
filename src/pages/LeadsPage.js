import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { NewsDrawer } from '../components/news/NewsDrawer.tsx';
import { TOPICS, categoryById } from '../data/demo/catalog.ts';
import { DATA_END, DATA_START, formatStamp } from '../lib/dates.ts';
import { eventCatalog, hotNews } from '../lib/hotSelectors.ts';
import { loadExplainCache, loadProgressCache } from '../lib/hotStorage.ts';
import { DEMO_ACTORS, actorName, absorbDraft, addManualArticles, archiveLead, assignOwner, attachReport, createManualLead, currentActor, detachReport, downloadCsv, entryLabel, findLead, freshArticles, leadTopic, leadsToCsv, markSeen, materialNatureMix, outcomeLabel, removeManualArticle, renameLead, restoreLead, returnPending, sameTitleLeads, saveNotes, setCurrentActor, startLead, statusLabel, syncEventArticles, visibleLeads, } from '../lib/leads.ts';
import { levelLabel, materialLevel, materialNature, natureLabel } from '../lib/material.ts';
import { listReports } from '../lib/reportStore.ts';
import './leads.css';
const PAGE_SIZE = 20;
const VIEW_KEY = 'clue-leads-view-v1';
const DEFAULT_VIEW = {
    status: 'all', q: '', owner: '', topic: '', entry: '', mine: false, fresh: false, from: '', to: '', sort: 'default', page: 1,
};
function readView() {
    try {
        const raw = sessionStorage.getItem(VIEW_KEY);
        return raw ? { ...DEFAULT_VIEW, ...JSON.parse(raw) } : DEFAULT_VIEW;
    }
    catch {
        return DEFAULT_VIEW;
    }
}
function statusRank(status) {
    if (status === 'pending')
        return 0;
    if (status === 'active')
        return 1;
    return 2;
}
export function LeadsPage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const news = useMemo(() => hotNews(), []);
    const newsById = useMemo(() => new Map(news.map((item) => [item.id, item])), [news]);
    const [rows, setRows] = useState(() => visibleLeads());
    const [actor, setActor] = useState(currentActor());
    const [view, setView] = useState(readView);
    const [selected, setSelected] = useState([]);
    const [reports, setReports] = useState([]);
    const [openId, setOpenId] = useState(params.get('lead'));
    const [tab, setTab] = useState('info');
    const [noteDraft, setNoteDraft] = useState('');
    const [noteDirty, setNoteDirty] = useState(false);
    const [leaveAsk, setLeaveAsk] = useState(false);
    const [archiveFor, setArchiveFor] = useState(null);
    const [outcome, setOutcome] = useState('topic');
    const [outcomeNote, setOutcomeNote] = useState('');
    const [archiveError, setArchiveError] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [picker, setPicker] = useState(false);
    const [notice, setNotice] = useState('');
    const [batchNote, setBatchNote] = useState('');
    const [materialFilter, setMaterialFilter] = useState('all');
    const [drawerItems, setDrawerItems] = useState(null);
    const [mergeDraft, setMergeDraft] = useState(null);
    const queryLead = params.get('lead');
    const returnFocus = useRef(null);
    const events = useMemo(() => eventCatalog(news), [news]);
    function reload() {
        syncEventArticles(news);
        setRows(visibleLeads());
    }
    useEffect(() => {
        reload();
        void listReports().then(setReports).catch(() => setNotice('报告列表读取失败，线索列表仍可使用。'));
        const saved = Number(sessionStorage.getItem('clue-leads-scroll') || '0');
        window.scrollTo(0, saved);
        const onScroll = () => sessionStorage.setItem('clue-leads-scroll', String(window.scrollY));
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    useEffect(() => {
        sessionStorage.setItem(VIEW_KEY, JSON.stringify(view));
    }, [view]);
    useEffect(() => {
        if (!queryLead)
            return;
        const lead = findLead(queryLead);
        if (!lead || lead.mergedInto)
            return;
        setOpenId((current) => {
            if (current !== queryLead)
                setTab('info');
            return queryLead;
        });
        setNoteDraft(lead.notes);
        setNoteDirty(false);
    }, [queryLead]);
    function patchView(partial, resetPage = true) {
        setSelected([]);
        setView((current) => ({ ...current, ...partial, page: resetPage ? 1 : partial.page ?? current.page }));
    }
    function matches(lead, status) {
        if (status !== 'all' && lead.status !== status)
            return false;
        const topic = leadTopic(lead, news);
        const eventName = lead.eventId ? news.find((item) => item.eventId === lead.eventId)?.eventName ?? '' : '';
        const bag = `${lead.title} ${eventName} ${lead.notes}`.toLowerCase();
        if (view.q && !bag.includes(view.q.trim().toLowerCase()))
            return false;
        if (view.owner === 'none' && lead.ownerId)
            return false;
        if (view.owner && view.owner !== 'none' && lead.ownerId !== view.owner)
            return false;
        if (view.topic && topic?.topic.id !== view.topic && topic?.category.id !== view.topic)
            return false;
        if (view.entry && !lead.entryPoints.includes(view.entry))
            return false;
        if (view.mine && lead.ownerId !== actor)
            return false;
        if (view.fresh && (lead.status === 'archived' || freshArticles(lead, actor).length === 0))
            return false;
        const day = lead.lastActionAt.slice(0, 10);
        if (view.from && day < view.from)
            return false;
        if (view.to && day > view.to)
            return false;
        return true;
    }
    const scoped = rows.filter((lead) => matches(lead, 'all'));
    const counts = {
        all: scoped.length,
        pending: scoped.filter((lead) => lead.status === 'pending').length,
        active: scoped.filter((lead) => lead.status === 'active').length,
        archived: scoped.filter((lead) => lead.status === 'archived').length,
    };
    const filtered = scoped.filter((lead) => matches(lead, view.status));
    const sorted = [...filtered].sort((a, b) => {
        if (view.sort === 'created')
            return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
        if (view.sort === 'action')
            return b.lastActionAt.localeCompare(a.lastActionAt) || a.id.localeCompare(b.id);
        const freshDelta = Number(freshArticles(b, actor).length > 0 && b.status !== 'archived') - Number(freshArticles(a, actor).length > 0 && a.status !== 'archived');
        return statusRank(a.status) - statusRank(b.status) || freshDelta || b.lastActionAt.localeCompare(a.lastActionAt) || a.id.localeCompare(b.id);
    });
    const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const page = Math.min(view.page, pages);
    const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const opened = openId ? findLead(openId) : null;
    function openLead(id) {
        const lead = findLead(id);
        if (!lead || lead.mergedInto)
            return;
        returnFocus.current = document.activeElement;
        setOpenId(id);
        setTab('info');
        setNoteDraft(lead.notes);
        setNoteDirty(false);
        setMaterialFilter('all');
        setParams((current) => {
            const next = new URLSearchParams(current);
            next.set('lead', id);
            return next;
        }, { replace: true });
    }
    function closeLead() {
        setOpenId(null);
        setParams((current) => {
            const next = new URLSearchParams(current);
            next.delete('lead');
            return next;
        }, { replace: true });
        returnFocus.current?.focus();
    }
    function askClose() {
        if (noteDirty)
            setLeaveAsk(true);
        else
            closeLead();
    }
    useEffect(() => {
        if (!openId && !createOpen && !archiveFor)
            return;
        const onKey = (event) => {
            if (event.key === 'Escape') {
                if (archiveFor)
                    setArchiveFor(null);
                else if (createOpen)
                    setCreateOpen(false);
                else
                    askClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });
    function run(ids, action) {
        let ok = 0;
        let skipped = 0;
        ids.forEach((id) => {
            const before = findLead(id);
            const after = action(id);
            if (before && after && after.updatedAt !== before.updatedAt)
                ok += 1;
            else
                skipped += 1;
        });
        reload();
        return { ok, skipped };
    }
    function exportRows(list, label) {
        downloadCsv(`线索清单-${label}.csv`, leadsToCsv(list, news));
    }
    const pageIds = pageRows.map((lead) => lead.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
    return (_jsxs("main", { className: "leads-page", children: [_jsxs("header", { className: "lead-top", children: [_jsxs("div", { children: [_jsx("h1", { children: "\u7EBF\u7D22\u7BA1\u7406" }), _jsx("p", { children: "\u6C47\u96C6\u8DDF\u8FDB\u4E8B\u9879\uFF0C\u4FDD\u7559\u6750\u6599\u4E0E\u5904\u7406\u8FDB\u5EA6" })] }), _jsxs("div", { className: "lead-actions", children: [_jsx("button", { type: "button", className: "btn-primary", onClick: () => setCreateOpen(true), children: "\u65B0\u5EFA\u7EBF\u7D22" }), _jsx("button", { type: "button", className: "btn-quiet", onClick: () => exportRows(filtered, '当前筛选'), children: "\u5BFC\u51FA\u5F53\u524D\u7B5B\u9009\u5168\u90E8" }), _jsx("button", { type: "button", className: "btn-text", disabled: true, title: "\u6750\u6599\u5BFC\u5165\u5C1A\u672A\u63A5\u5165\u3002\u8FD9\u91CC\u4E0D\u4F1A\u56E0\u4E3A\u5BFC\u5165\u62A5\u9053\u81EA\u52A8\u521B\u5EFA\u8DDF\u8FDB\u8BB0\u5F55\u3002", children: "\u5BFC\u5165\u6750\u6599\u672A\u63A5\u5165" })] })] }), _jsx("div", { className: "lead-tabs", role: "tablist", "aria-label": "\u7EBF\u7D22\u72B6\u6001", children: [['all', '全部'], ['pending', '待处理'], ['active', '跟进中'], ['archived', '已归档']].map(([id, label]) => (_jsxs("button", { type: "button", "aria-pressed": view.status === id, onClick: () => patchView({ status: id }), children: [label, " ", counts[id]] }, id))) }), _jsxs("section", { className: "lead-card", children: [_jsxs("div", { className: "lead-filters", children: [_jsx("input", { type: "search", value: view.q, placeholder: "\u641C\u7D22\u6807\u9898\u3001\u4E8B\u4EF6\u6216\u5907\u6CE8", "aria-label": "\u641C\u7D22\u7EBF\u7D22", onChange: (event) => patchView({ q: event.target.value }) }), _jsxs("select", { "aria-label": "\u8D1F\u8D23\u4EBA", value: view.owner, onChange: (event) => patchView({ owner: event.target.value }), children: [_jsx("option", { value: "", children: "\u5168\u90E8\u8D1F\u8D23\u4EBA" }), _jsx("option", { value: "none", children: "\u672A\u5206\u914D" }), DEMO_ACTORS.map((item) => _jsx("option", { value: item.id, children: item.name }, item.id))] }), _jsxs("select", { "aria-label": "\u4E3B\u9898\u6216\u5206\u7C7B", value: view.topic, onChange: (event) => patchView({ topic: event.target.value }), children: [_jsx("option", { value: "", children: "\u5168\u90E8\u4E3B\u9898" }), Object.values(categoryById).map((item) => _jsx("option", { value: item.id, children: item.name }, item.id)), TOPICS.map((item) => _jsx("option", { value: item.id, children: item.name }, item.id))] }), _jsxs("select", { "aria-label": "\u52A0\u5165\u9014\u5F84", value: view.entry, onChange: (event) => patchView({ entry: event.target.value }), children: [_jsx("option", { value: "", children: "\u5168\u90E8\u9014\u5F84" }), _jsx("option", { value: "overview", children: "\u7EBF\u7D22\u603B\u89C8" }), _jsx("option", { value: "hot", children: "\u70ED\u641C\u8FFD\u8E2A" }), _jsx("option", { value: "compete", children: "\u7ADE\u54C1\u76D1\u63A7" }), _jsx("option", { value: "manual", children: "\u624B\u5DE5\u65B0\u5EFA" }), _jsx("option", { value: "legacy", children: "\u65E9\u671F\u8DDF\u8FDB" })] }), _jsxs("label", { className: "lead-check", children: [_jsx("input", { type: "checkbox", checked: view.mine, onChange: (event) => patchView({ mine: event.target.checked }) }), "\u53EA\u770B\u6211\u7684"] }), _jsxs("label", { className: "lead-check", children: [_jsx("input", { type: "checkbox", checked: view.fresh, onChange: (event) => patchView({ fresh: event.target.checked }) }), "\u6709\u66F4\u65B0"] }), _jsx("input", { type: "date", "aria-label": "\u6700\u8FD1\u64CD\u4F5C\u8D77", min: DATA_START, max: DATA_END, value: view.from, onChange: (event) => patchView({ from: event.target.value }) }), _jsx("input", { type: "date", "aria-label": "\u6700\u8FD1\u64CD\u4F5C\u6B62", min: DATA_START, max: DATA_END, value: view.to, onChange: (event) => patchView({ to: event.target.value }) }), _jsxs("select", { "aria-label": "\u6392\u5E8F", value: view.sort, onChange: (event) => patchView({ sort: event.target.value }, false), children: [_jsx("option", { value: "default", children: "\u5F85\u5904\u7406\u4F18\u5148" }), _jsx("option", { value: "action", children: "\u6700\u8FD1\u64CD\u4F5C" }), _jsx("option", { value: "created", children: "\u521B\u5EFA\u65F6\u95F4" })] }), _jsxs("label", { className: "lead-check", children: ["\u5F53\u524D\u8EAB\u4EFD", _jsx("select", { "aria-label": "\u5F53\u524D\u6F14\u793A\u8EAB\u4EFD", value: actor, onChange: (event) => { setCurrentActor(event.target.value); setActor(event.target.value); }, children: DEMO_ACTORS.map((item) => _jsx("option", { value: item.id, children: item.name }, item.id)) })] }), _jsx("button", { type: "button", className: "btn-text", onClick: () => patchView(DEFAULT_VIEW), children: "\u91CD\u7F6E\u7B5B\u9009" })] }), _jsx("p", { className: "lead-faint", children: "\u5F53\u524D\u8EAB\u4EFD\u53EA\u4FDD\u5B58\u5728\u8FD9\u53F0\u6D4F\u89C8\u5668\uFF0C\u7528\u6765\u8BA1\u7B97\u201C\u53EA\u770B\u6211\u7684\u201D\u548C\u5DF2\u770B\u72B6\u6001\uFF0C\u4E0D\u4F1A\u53D1\u9001\u901A\u77E5\u3002" }), selected.length > 0 && (_jsxs("div", { className: "lead-bulk", children: [_jsxs("strong", { children: ["\u5DF2\u9009 ", selected.length, " \u6761"] }), _jsxs("select", { "aria-label": "\u6279\u91CF\u5206\u914D\u8D1F\u8D23\u4EBA", defaultValue: "", onChange: (event) => { if (!event.target.value)
                                    return; const result = run(selected, (id) => assignOwner(id, event.target.value === 'none' ? null : event.target.value)); setBatchNote(`负责人已更新 ${result.ok} 条，跳过 ${result.skipped} 条。没有发送通知。`); event.target.value = ''; }, children: [_jsx("option", { value: "", children: "\u5206\u914D\u8D1F\u8D23\u4EBA" }), _jsx("option", { value: "none", children: "\u672A\u5206\u914D" }), DEMO_ACTORS.map((item) => _jsx("option", { value: item.id, children: item.name }, item.id))] }), _jsx("button", { type: "button", className: "btn-quiet", onClick: () => { const result = run(selected, returnPending); setBatchNote(`改为待处理 ${result.ok} 条，${result.skipped} 条状态不适用。`); }, children: "\u6539\u4E3A\u5F85\u5904\u7406" }), _jsx("button", { type: "button", className: "btn-quiet", onClick: () => { const result = run(selected, startLead); setBatchNote(`开始跟进 ${result.ok} 条，${result.skipped} 条不是待处理。`); }, children: "\u5F00\u59CB\u8DDF\u8FDB" }), _jsx("button", { type: "button", className: "btn-quiet", onClick: () => { setArchiveError(''); setArchiveFor(selected); }, children: "\u5F52\u6863" }), _jsx("button", { type: "button", className: "btn-text", onClick: () => exportRows(rows.filter((lead) => selected.includes(lead.id)), '已选'), children: "\u5BFC\u51FA\u5DF2\u9009" })] })), batchNote && _jsx("p", { className: "lead-banner", children: batchNote }), notice && _jsx("p", { className: "lead-banner", children: notice }), sorted.length === 0 ? (_jsx("div", { children: rows.length === 0 ? (_jsx("p", { children: "\u8FD8\u6CA1\u6709\u8DDF\u8FDB\u7EBF\u7D22\u3002\u53EF\u4EE5\u5728\u70ED\u641C\u8FFD\u8E2A\u6216\u7ADE\u54C1\u76D1\u63A7\u91CC\u5BF9\u4E8B\u4EF6\u9009\u62E9\u201C\u8DDF\u8FDB\u4E8B\u4EF6\u201D\uFF0C\u4E5F\u53EF\u4EE5\u624B\u5DE5\u65B0\u5EFA\u3002\u5173\u6CE8\u4E3B\u9898\u548C\u6536\u85CF\u62A5\u9053\u4E0D\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002" })) : view.status !== 'all' && scoped.length > 0 ? (_jsx("p", { children: "\u8FD9\u4E2A\u72B6\u6001\u4E0B\u6CA1\u6709\u7EBF\u7D22\u3002" })) : (_jsxs("p", { children: ["\u6CA1\u6709\u7B26\u5408\u7B5B\u9009\u7684\u7EBF\u7D22\u3002", _jsx("button", { type: "button", className: "btn-text", onClick: () => patchView(DEFAULT_VIEW), children: "\u6E05\u9664\u7B5B\u9009" })] })) })) : (_jsx("div", { className: "lead-table-wrap", children: _jsxs("table", { className: "lead-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: _jsx("input", { type: "checkbox", "aria-label": "\u5168\u9009\u5F53\u524D\u9875", checked: allPageSelected, onChange: (event) => setSelected(event.target.checked ? pageIds : []) }) }), _jsx("th", { children: "\u7EBF\u7D22" }), _jsx("th", { children: "\u8D1F\u8D23\u4EBA" }), _jsx("th", { children: "\u72B6\u6001" }), _jsx("th", { children: "\u5173\u8054\u6750\u6599" }), _jsx("th", { className: "lead-hide-narrow", children: "\u6700\u8FD1\u64CD\u4F5C" }), _jsx("th", { children: "\u64CD\u4F5C" })] }) }), _jsx("tbody", { children: pageRows.map((lead) => {
                                        const topic = leadTopic(lead, news);
                                        const fresh = lead.status === 'archived' ? [] : freshArticles(lead, actor);
                                        const eventName = lead.eventId ? news.find((item) => item.eventId === lead.eventId)?.eventName : '';
                                        return (_jsxs("tr", { "data-selected": selected.includes(lead.id) ? 'true' : 'false', children: [_jsx("td", { children: _jsx("input", { type: "checkbox", "aria-label": `选择 ${lead.title}`, checked: selected.includes(lead.id), onChange: (event) => setSelected((current) => event.target.checked ? [...current, lead.id] : current.filter((id) => id !== lead.id)) }) }), _jsxs("td", { children: [_jsx("div", { className: "lead-title", title: lead.title, children: lead.title }), _jsxs("p", { className: "lead-faint", children: [topic ? `${topic.category.name} / ${topic.topic.name}` : lead.eventId && !eventName ? '关联对象暂不可用' : '未关联事件', " \u00B7 ", lead.entryPoints.map(entryLabel).join('、'), " \u00B7 ", materialNatureMix(lead.articles.map((item) => item.articleId), newsById) || '无材料'] })] }), _jsx("td", { children: actorName(lead.ownerId) }), _jsx("td", { children: _jsx("span", { className: `lead-tag ${lead.status}`, children: statusLabel(lead.status) }) }), _jsxs("td", { children: [lead.articles.length, " \u7BC7", fresh.length > 0 && _jsxs("button", { type: "button", className: "btn-text", onClick: () => { openLead(lead.id); setTab('materials'); setMaterialFilter('fresh'); }, children: ["\u65B0\u589E", fresh.length, "\u7BC7"] })] }), _jsx("td", { className: "lead-hide-narrow", children: lead.lastActionAt }), _jsx("td", { children: _jsxs("div", { className: "lead-ops", children: [_jsx("button", { type: "button", className: "btn-quiet", onClick: () => openLead(lead.id), children: "\u6253\u5F00" }), lead.status === 'pending' && _jsx("button", { type: "button", className: "btn-text", onClick: () => { run([lead.id], startLead); setBatchNote('已开始跟进。'); }, children: "\u5F00\u59CB\u8DDF\u8FDB" }), lead.status === 'active' && _jsx("button", { type: "button", className: "btn-text", onClick: () => { setArchiveError(''); setArchiveFor([lead.id]); }, children: "\u5F52\u6863" }), lead.status === 'archived' && _jsx("button", { type: "button", className: "btn-text", onClick: () => { run([lead.id], restoreLead); setBatchNote('已恢复为待处理。'); }, children: "\u6062\u590D" }), _jsxs("details", { children: [_jsx("summary", { className: "btn-text", children: "\u66F4\u591A" }), _jsxs("div", { children: [lead.status === 'active' && _jsx("button", { type: "button", className: "btn-text", onClick: () => { run([lead.id], returnPending); setBatchNote('已退回待处理。'); }, children: "\u9000\u56DE\u5F85\u5904\u7406" }), lead.status !== 'archived' && _jsx("button", { type: "button", className: "btn-text", onClick: () => { setArchiveError(''); setArchiveFor([lead.id]); }, children: "\u5F52\u6863" })] })] })] }) })] }, lead.id));
                                    }) })] }) })), _jsxs("div", { className: "lead-pager", children: [_jsxs("span", { className: "lead-faint", children: ["\u5171 ", sorted.length, " \u6761 \u00B7 \u7B2C ", page, "/", pages, " \u9875 \u00B7 \u6BCF\u9875 ", PAGE_SIZE, " \u6761 \u00B7 \u5168\u9009\u53EA\u4F5C\u7528\u4E8E\u5F53\u524D\u9875"] }), _jsxs("div", { children: [_jsx("button", { type: "button", className: "btn-quiet", disabled: page <= 1, onClick: () => { setSelected([]); setView((current) => ({ ...current, page: page - 1 })); }, children: "\u4E0A\u4E00\u9875" }), _jsx("button", { type: "button", className: "btn-quiet", disabled: page >= pages, onClick: () => { setSelected([]); setView((current) => ({ ...current, page: page + 1 })); }, children: "\u4E0B\u4E00\u9875" })] })] })] }), opened && _jsx(LeadDrawer, { lead: opened, news: news, newsById: newsById, reports: reports, actor: actor, tab: tab, setTab: setTab, noteDraft: noteDraft, noteDirty: noteDirty, materialFilter: materialFilter, setMaterialFilter: setMaterialFilter, onNote: (value) => { setNoteDraft(value); setNoteDirty(value !== opened.notes); }, onClose: askClose, onSaveNote: () => { const saved = saveNotes(opened.id, noteDraft); if (!saved)
                    setNotice('备注保存失败。');
                else {
                    setNoteDirty(false);
                    reload();
                } }, onCancelNote: () => { setNoteDraft(opened.notes); setNoteDirty(false); }, onReload: reload, onArchive: () => { setArchiveError(''); setArchiveFor([opened.id]); }, onOpenNews: setDrawerItems, onPick: () => setPicker(true), onNotice: setNotice }), leaveAsk && (_jsx("div", { className: "lead-mask", children: _jsxs("section", { className: "lead-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "leave-title", children: [_jsx("h2", { id: "leave-title", children: "\u5907\u6CE8\u8FD8\u6CA1\u4FDD\u5B58" }), _jsx("p", { children: "\u5173\u95ED\u540E\u8FD9\u6B21\u4FEE\u6539\u4F1A\u4E22\u6389\u3002\u4FDD\u5B58\u4F1A\u5199\u5165\u5DE5\u4F5C\u5907\u6CE8\uFF0C\u4E0D\u4F1A\u6539\u65B0\u95FB\u6B63\u6587\u3002" }), _jsxs("div", { className: "lead-actions", children: [_jsx("button", { type: "button", className: "btn-primary", onClick: () => { if (opened)
                                        saveNotes(opened.id, noteDraft); setNoteDirty(false); setLeaveAsk(false); reload(); closeLead(); }, children: "\u4FDD\u5B58\u5E76\u5173\u95ED" }), _jsx("button", { type: "button", className: "btn-quiet", onClick: () => { setLeaveAsk(false); setNoteDirty(false); closeLead(); }, children: "\u653E\u5F03\u4FEE\u6539" }), _jsx("button", { type: "button", className: "btn-text", onClick: () => setLeaveAsk(false), children: "\u7EE7\u7EED\u7F16\u8F91" })] })] }) })), archiveFor && (_jsx("div", { className: "lead-mask", children: _jsxs("section", { className: "lead-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "archive-title", children: [_jsxs("h2", { id: "archive-title", children: ["\u5F52\u6863 ", archiveFor.length, " \u6761\u7EBF\u7D22"] }), _jsx("p", { children: "\u5F52\u6863\u540E\u4E0D\u518D\u4E3B\u52A8\u63D0\u793A\u65B0\u589E\u6750\u6599\uFF0C\u62A5\u9053\u548C\u62A5\u544A\u90FD\u8FD8\u5728\u3002\u53EF\u4EE5\u4EE5\u540E\u6062\u590D\u3002" }), _jsxs("label", { children: ["\u5904\u7406\u7ED3\u679C", _jsxs("select", { value: outcome, onChange: (event) => setOutcome(event.target.value), children: [_jsx("option", { value: "topic", children: "\u5DF2\u5F62\u6210\u9009\u9898" }), _jsx("option", { value: "handoff", children: "\u5DF2\u4EA4\u63A5" }), _jsx("option", { value: "pause", children: "\u6682\u4E0D\u8DDF\u8FDB" }), _jsx("option", { value: "other", children: "\u5176\u4ED6" })] })] }), _jsx("p", { className: "lead-faint", children: "\u201C\u5DF2\u4EA4\u63A5\u201D\u53EA\u8BB0\u5728\u8FD9\u6761\u7EBF\u7D22\u4E0A\uFF0C\u7CFB\u7EDF\u6CA1\u6709\u53D1\u9001\u6D88\u606F\uFF0C\u5BF9\u65B9\u4E5F\u8FD8\u6CA1\u6709\u786E\u8BA4\u3002" }), _jsx("textarea", { "aria-label": "\u5904\u7406\u8BF4\u660E", value: outcomeNote, onChange: (event) => setOutcomeNote(event.target.value), placeholder: outcome === 'other' ? '请填写说明' : '可选的简短结论' }), archiveError && _jsx("p", { className: "lead-banner", children: archiveError }), _jsxs("div", { className: "lead-actions", children: [_jsx("button", { type: "button", className: "btn-primary", onClick: () => {
                                        try {
                                            const result = run(archiveFor, (id) => archiveLead(id, outcome, outcomeNote));
                                            setBatchNote(`已归档 ${result.ok} 条，${result.skipped} 条没有变化。`);
                                            setArchiveFor(null);
                                            setOutcomeNote('');
                                        }
                                        catch (error) {
                                            setArchiveError(error instanceof Error ? error.message : '归档失败');
                                        }
                                    }, children: "\u786E\u8BA4\u5F52\u6863" }), _jsx("button", { type: "button", className: "btn-quiet", onClick: () => setArchiveFor(null), children: "\u53D6\u6D88" })] })] }) })), createOpen && _jsx(CreateDialog, { news: news, events: events, onClose: () => setCreateOpen(false), onDone: (id) => { setCreateOpen(false); reload(); if (id)
                    openLead(id); }, onExists: (draft) => setMergeDraft(draft) }), mergeDraft && (_jsx("div", { className: "lead-mask", children: _jsxs("section", { className: "lead-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "merge-title", children: [_jsx("h2", { id: "merge-title", children: "\u8FD9\u4E2A\u4E8B\u4EF6\u5DF2\u6709\u7EBF\u7D22" }), _jsx("p", { children: "\u53EF\u4EE5\u6253\u5F00\u5DF2\u6709\u8BB0\u5F55\uFF0C\u6216\u628A\u5F53\u524D\u8349\u7A3F\u5E76\u8FDB\u53BB\u3002\u5DF2\u6709\u6807\u9898\u548C\u8D1F\u8D23\u4EBA\u4FDD\u6301\u4E0D\u53D8\uFF0C\u5907\u6CE8\u8FFD\u52A0\uFF0C\u6750\u6599\u6309\u62A5\u9053\u7F16\u53F7\u53BB\u91CD\u3002\u518D\u6B21\u5408\u5E76\u4E0D\u4F1A\u91CD\u590D\u5199\u5165\u3002" }), _jsxs("p", { className: "lead-faint", children: ["\u8349\u7A3F\u6807\u9898\u300C", mergeDraft.title, "\u300D\uFF0C\u8BF4\u660E\uFF1A", mergeDraft.notes || '无', "\uFF0C\u6750\u6599 ", mergeDraft.articleIds.length, " \u7BC7\u3002"] }), _jsxs("div", { className: "lead-actions", children: [_jsx("button", { type: "button", className: "btn-primary", onClick: () => { const id = mergeDraft.targetId; setMergeDraft(null); setCreateOpen(false); openLead(id); }, children: "\u6253\u5F00\u5DF2\u6709\u8BB0\u5F55" }), _jsx("button", { type: "button", className: "btn-quiet", onClick: () => { const saved = absorbDraft(mergeDraft.targetId, mergeDraft); setMergeDraft(null); setCreateOpen(false); reload(); if (saved)
                                        openLead(saved.id); }, children: "\u5408\u5E76\u8349\u7A3F" }), _jsx("button", { type: "button", className: "btn-text", onClick: () => setMergeDraft(null), children: "\u53D6\u6D88" })] })] }) })), picker && opened && _jsx(Picker, { news: news, exclude: new Set(opened.articles.map((item) => item.articleId)), onClose: () => setPicker(false), onAdd: (ids) => { addManualArticles(opened.id, ids); setPicker(false); reload(); } }), _jsx(NewsDrawer, { model: drawerItems ? { kind: 'news', tags: [{ id: 'lead', label: '线索材料' }], items: drawerItems, note: '从线索打开的报道。关注按钮只收藏材料，不会新建线索。' } : null, followedIds: new Set(), entry: "overview", onClose: () => setDrawerItems(null), onToggleFollow: () => undefined })] }));
}
function LeadDrawer({ lead, news, newsById, reports, actor, tab, setTab, noteDraft, noteDirty, materialFilter, setMaterialFilter, onNote, onClose, onSaveNote, onCancelNote, onReload, onArchive, onOpenNews, onPick, onNotice, }) {
    const navigate = useNavigate();
    const topic = leadTopic(lead, news);
    const eventName = lead.eventId ? news.find((item) => item.eventId === lead.eventId)?.eventName : '';
    const fresh = freshArticles(lead, actor);
    const shown = lead.articles
        .map((item) => ({ meta: item, news: newsById.get(item.articleId) ?? null }))
        .filter((item) => materialFilter === 'all' || fresh.some((row) => row.articleId === item.meta.articleId))
        .sort((a, b) => (b.news?.publishedAt ?? '').localeCompare(a.news?.publishedAt ?? ''));
    const eventReports = reports.filter((item) => item.scope.eventId && item.scope.eventId === lead.eventId);
    const manualReports = reports.filter((item) => lead.reportRefs.some((ref) => ref.reportId === item.id) && !eventReports.some((row) => row.id === item.id));
    const progress = loadProgressCache().filter((item) => item.eventId === lead.eventId);
    const linkedExplain = lead.analysisRefs.filter((item) => item.kind === 'explain');
    const explainRows = loadExplainCache().filter((item) => linkedExplain.some((ref) => ref.key === item.key));
    useEffect(() => {
        const close = document.getElementById('lead-close');
        close?.focus();
    }, [lead.id]);
    return (_jsx("div", { className: "lead-mask", onClick: onClose, children: _jsxs("aside", { className: "lead-drawer", role: "dialog", "aria-modal": "true", "aria-labelledby": "lead-drawer-title", onClick: (event) => event.stopPropagation(), children: [_jsxs("header", { children: [_jsxs("div", { className: "lead-row", children: [_jsxs("div", { children: [_jsx("h2", { id: "lead-drawer-title", children: lead.title }), _jsxs("p", { className: "lead-faint", children: [_jsx("span", { className: `lead-tag ${lead.status}`, children: statusLabel(lead.status) }), " \u00B7 ", actorName(lead.ownerId)] })] }), _jsx("button", { id: "lead-close", type: "button", className: "btn-quiet", onClick: onClose, children: "\u5173\u95ED" })] }), _jsx("div", { className: "lead-tabs", children: [['info', '跟进信息'], ['materials', '关联材料'], ['analysis', '分析与报告'], ['log', '操作记录']].map(([id, label]) => (_jsx("button", { type: "button", role: "tab", "aria-selected": tab === id, onClick: () => setTab(id), children: label }, id))) })] }), _jsxs("div", { className: "lead-scroll", children: [tab === 'info' && (_jsxs(_Fragment, { children: [_jsxs("p", { children: ["\u5173\u8054\u4E8B\u4EF6\uFF1A", lead.eventId ? (eventName || '关联对象暂不可用') : '未关联事件'] }), _jsxs("p", { className: "lead-faint", children: ["\u4E3B\u9898 ", topic?.topic.name ?? '无', " \u00B7 \u5206\u7C7B ", topic?.category.name ?? '无'] }), _jsxs("p", { className: "lead-faint", children: ["\u52A0\u5165\u9014\u5F84 ", lead.entryPoints.map(entryLabel).join('、'), " \u00B7 \u521B\u5EFA\u4E8E ", lead.createdAt] }), _jsx(TitleField, { leadId: lead.id, title: lead.title, onReload: onReload }), _jsxs("label", { children: ["\u8D1F\u8D23\u4EBA", _jsxs("select", { "aria-label": "\u8D1F\u8D23\u4EBA", value: lead.ownerId ?? '', onChange: (event) => { assignOwner(lead.id, event.target.value || null); onNotice('负责人已更新'); onReload(); }, children: [_jsx("option", { value: "", children: "\u672A\u5206\u914D" }), DEMO_ACTORS.map((item) => _jsx("option", { value: item.id, children: item.name }, item.id))] })] }), _jsxs("label", { children: ["\u5DE5\u4F5C\u5907\u6CE8", _jsx("textarea", { value: noteDraft, "aria-label": "\u5DE5\u4F5C\u5907\u6CE8", onChange: (event) => onNote(event.target.value) })] }), _jsxs("p", { className: "lead-faint", children: [noteDirty ? '未保存' : '已保存', " \u00B7 \u5907\u6CE8\u53EA\u7ED9\u8DDF\u8FDB\u4EBA\u770B\uFF0C\u4E0D\u4F1A\u6539\u5199\u65B0\u95FB\u6216\u5DF2\u6709\u5206\u6790\u3002"] }), _jsxs("div", { className: "lead-actions", children: [_jsx("button", { type: "button", className: "btn-primary", disabled: !noteDirty, onClick: onSaveNote, children: "\u4FDD\u5B58\u5907\u6CE8" }), _jsx("button", { type: "button", className: "btn-text", disabled: !noteDirty, onClick: onCancelNote, children: "\u53D6\u6D88" })] }), _jsxs("p", { children: ["\u5F53\u524D\u5904\u7406\u7ED3\u8BBA\uFF1A", lead.currentOutcome ? `${outcomeLabel(lead.currentOutcome.outcome)} ${lead.currentOutcome.note}` : '无'] }), lead.archiveHistory.length > 0 && _jsxs("p", { className: "lead-faint", children: ["\u5386\u53F2\u5F52\u6863\uFF1A", lead.archiveHistory.map((item) => `${item.at} ${outcomeLabel(item.outcome)}`).join('；')] }), _jsxs("div", { className: "lead-actions", children: [lead.status === 'pending' && _jsx("button", { type: "button", className: "btn-primary", onClick: () => { startLead(lead.id); onReload(); }, children: "\u5F00\u59CB\u8DDF\u8FDB" }), lead.status === 'active' && _jsx("button", { type: "button", className: "btn-quiet", onClick: () => { returnPending(lead.id); onReload(); }, children: "\u9000\u56DE\u5F85\u5904\u7406" }), lead.status !== 'archived' && _jsx("button", { type: "button", className: "btn-quiet", onClick: onArchive, children: "\u5F52\u6863" }), lead.status === 'archived' && _jsx("button", { type: "button", className: "btn-primary", onClick: () => { restoreLead(lead.id); onReload(); }, children: "\u6062\u590D\u8DDF\u8FDB" })] })] })), tab === 'materials' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "lead-actions", children: [_jsxs("button", { type: "button", "aria-pressed": materialFilter === 'all', className: "btn-quiet", onClick: () => setMaterialFilter('all'), children: ["\u5168\u90E8 ", lead.articles.length] }), _jsxs("button", { type: "button", "aria-pressed": materialFilter === 'fresh', className: "btn-quiet", onClick: () => setMaterialFilter('fresh'), children: ["\u65B0\u589E ", fresh.length] }), _jsx("button", { type: "button", className: "btn-quiet", onClick: onPick, children: "\u4ECE\u65B0\u95FB\u5E93\u8865\u5145" }), _jsx("button", { type: "button", className: "btn-text", onClick: () => { markSeen(lead.id, fresh.map((item) => item.articleId), actor); onReload(); }, children: "\u6807\u8BB0\u5F53\u524D\u66F4\u65B0\u5DF2\u770B" })] }), lead.status === 'archived' && fresh.length > 0 && _jsxs("p", { className: "lead-banner", children: ["\u5F52\u6863\u671F\u95F4\u65B0\u589E ", fresh.length, " \u7BC7\uFF0C\u6062\u590D\u540E\u4ECD\u4FDD\u6301\u672A\u770B\uFF0C\u76F4\u5230\u4F60\u6807\u8BB0\u3002"] }), shown.map((item) => (_jsxs("article", { className: "lead-news", children: [_jsxs("div", { children: [_jsx("h3", { children: item.news?.title ?? '关联对象暂不可用' }), _jsxs("p", { className: "lead-faint", children: [item.news ? `${item.news.mediaName} · ${formatStamp(item.news.publishedAt)} · ${levelLabel(materialLevel(item.news))} · ${natureLabel(materialNature(item.news))}` : item.meta.articleId, " \u00B7 ", item.meta.source === 'manual' ? '手动补充' : '事件材料'] })] }), _jsxs("div", { className: "lead-ops", children: [item.news && _jsx("button", { type: "button", className: "btn-text", onClick: () => onOpenNews([item.news]), children: "\u67E5\u770B\u5168\u6587" }), item.meta.source === 'manual' && _jsx("button", { type: "button", className: "btn-text", onClick: () => { removeManualArticle(lead.id, item.meta.articleId); onReload(); }, children: "\u89E3\u9664\u5173\u8054" })] })] }, item.meta.articleId))), shown.length === 0 && _jsx("p", { className: "lead-faint", children: "\u6CA1\u6709\u8981\u663E\u793A\u7684\u6750\u6599\u3002" })] })), tab === 'analysis' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "lead-actions", children: [_jsx("button", { type: "button", className: "btn-quiet", onClick: () => navigate('/hot'), children: "\u67E5\u770B\u5DF2\u6709\u5206\u6790" }), lead.eventId && _jsx("button", { type: "button", className: "btn-primary", onClick: () => navigate('/compete', { state: { wizard: { type: 'event', eventId: lead.eventId, start: DATA_START, end: DATA_END, leadId: lead.id } } }), children: "\u751F\u6210\u4E8B\u4EF6\u5BF9\u6BD4\u62A5\u544A" })] }), progress.map((item) => (_jsx("article", { className: "lead-news", children: _jsxs("div", { children: [_jsx("h3", { children: "\u70ED\u70B9\u8FDB\u5C55\u6982\u62EC" }), _jsxs("p", { className: "lead-faint", children: [item.createdAt, " \u00B7 \u57FA\u4E8E ", item.materialIds.length, " \u7BC7"] }), lead.eventId && news.filter((row) => row.eventId === lead.eventId).some((row) => !item.materialIds.includes(row.id)) && _jsxs("p", { className: "lead-banner", children: ["\u8BE5\u5206\u6790\u57FA\u4E8E\u6B64\u524D ", item.materialIds.length, " \u7BC7\u6750\u6599\uFF0C\u5F53\u524D\u6709\u65B0\u589E\u5185\u5BB9\u3002\u65E7\u7ED3\u679C\u4E0D\u4F1A\u81EA\u52A8\u6539\u5199\u3002"] })] }) }, item.key))), explainRows.map((item) => (_jsx("article", { className: "lead-news", children: _jsxs("div", { children: [_jsx("h3", { children: "\u4E3B\u9898\u53D8\u5316\u89E3\u91CA" }), _jsxs("p", { className: "lead-faint", children: ["\u7528\u6237\u66FE\u5173\u8054 \u00B7 ", item.createdAt] })] }) }, item.key))), [...eventReports, ...manualReports].map((item) => {
                                    const ref = lead.reportRefs.find((row) => row.reportId === item.id);
                                    const base = ref?.materialCount ?? item.materials.length;
                                    const current = lead.eventId ? news.filter((row) => row.eventId === lead.eventId).length : item.materials.length;
                                    return (_jsxs("article", { className: "lead-news", children: [_jsxs("div", { children: [_jsx("h3", { children: item.title }), _jsxs("p", { className: "lead-faint", children: [item.type === 'event' ? '事件对比' : '日期对比', " \u00B7 ", item.updatedAt, " \u00B7 ", eventReports.some((row) => row.id === item.id) ? '按事件关联' : '手动关联'] }), current > base && _jsxs("p", { className: "lead-banner", children: ["\u8BE5\u5206\u6790\u57FA\u4E8E\u6B64\u524D ", base, " \u7BC7\u6750\u6599\uFF0C\u5F53\u524D\u6709\u65B0\u589E\u5185\u5BB9\u3002"] })] }), _jsxs("div", { className: "lead-ops", children: [_jsx("button", { type: "button", className: "btn-text", onClick: () => navigate(`/reports/${item.id}`, { state: { leadId: lead.id } }), children: "\u6253\u5F00" }), ref && _jsx("button", { type: "button", className: "btn-text", onClick: () => { detachReport(lead.id, item.id); onReload(); }, children: "\u89E3\u9664\u5F15\u7528" })] })] }, item.id));
                                }), _jsxs("label", { children: ["\u5173\u8054\u5DF2\u6709\u62A5\u544A", _jsxs("select", { "aria-label": "\u5173\u8054\u5DF2\u6709\u62A5\u544A", defaultValue: "", onChange: (event) => { if (!event.target.value)
                                                return; const report = reports.find((item) => item.id === event.target.value); attachReport(lead.id, event.target.value, report?.materials.length ?? 0); onReload(); event.target.value = ''; }, children: [_jsx("option", { value: "", children: "\u9009\u62E9\u62A5\u544A" }), reports.filter((item) => !lead.reportRefs.some((ref) => ref.reportId === item.id)).map((item) => _jsx("option", { value: item.id, children: item.title }, item.id))] })] }), progress.length + explainRows.length + eventReports.length + manualReports.length === 0 && _jsx("p", { className: "lead-faint", children: "\u8FD8\u6CA1\u6709\u5173\u8054\u5230\u8FD9\u6761\u7EBF\u7D22\u7684\u5206\u6790\u6216\u62A5\u544A\u3002" })] })), tab === 'log' && lead.logs.map((item) => (_jsx("article", { className: "lead-news", children: _jsxs("div", { children: [_jsx("h3", { children: item.action }), _jsxs("p", { className: "lead-faint", children: [item.at, " \u00B7 ", item.by === '系统' ? '系统' : actorName(item.by), " \u00B7 ", item.detail] })] }) }, item.id)))] })] }) }));
}
function TitleField({ leadId, title, onReload }) {
    const [value, setValue] = useState(title);
    useEffect(() => setValue(title), [leadId, title]);
    return (_jsxs("label", { children: ["\u7EBF\u7D22\u6807\u9898", _jsx("input", { type: "text", value: value, "aria-label": "\u7EBF\u7D22\u6807\u9898", onChange: (event) => setValue(event.target.value), onBlur: () => { if (value.trim() && value.trim() !== title) {
                    renameLead(leadId, value);
                    onReload();
                } } })] }));
}
function CreateDialog({ news, events, onClose, onDone, onExists }) {
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [ownerId, setOwnerId] = useState('');
    const [eventId, setEventId] = useState('');
    const [error, setError] = useState('');
    const names = sameTitleLeads(title);
    return (_jsx("div", { className: "lead-mask", onClick: onClose, children: _jsxs("section", { className: "lead-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "create-title", onClick: (event) => event.stopPropagation(), children: [_jsx("h2", { id: "create-title", children: "\u65B0\u5EFA\u7EBF\u7D22" }), _jsxs("label", { children: ["\u6807\u9898", _jsx("input", { type: "text", value: title, "aria-label": "\u7EBF\u7D22\u6807\u9898", onChange: (event) => setTitle(event.target.value) })] }), _jsxs("label", { children: ["\u8BF4\u660E", _jsx("textarea", { value: notes, "aria-label": "\u8BF4\u660E", onChange: (event) => setNotes(event.target.value) })] }), _jsxs("label", { children: ["\u8D1F\u8D23\u4EBA", _jsxs("select", { "aria-label": "\u65B0\u5EFA\u8D1F\u8D23\u4EBA", value: ownerId, onChange: (event) => setOwnerId(event.target.value), children: [_jsx("option", { value: "", children: "\u672A\u5206\u914D" }), DEMO_ACTORS.map((item) => _jsx("option", { value: item.id, children: item.name }, item.id))] })] }), _jsxs("label", { children: ["\u5173\u8054\u4E8B\u4EF6", _jsxs("select", { "aria-label": "\u5173\u8054\u4E8B\u4EF6", value: eventId, onChange: (event) => setEventId(event.target.value), children: [_jsx("option", { value: "", children: "\u4E0D\u5173\u8054" }), events.map((item) => _jsx("option", { value: item.id, children: item.name }, item.id))] })] }), !eventId && names.length > 0 && _jsxs("p", { className: "lead-banner", children: ["\u5DF2\u6709\u540C\u540D\u7EBF\u7D22\u300C", names[0].title, "\u300D\u3002\u6CA1\u6709\u4E8B\u4EF6\u7F16\u53F7\u65F6\u4E0D\u4F1A\u81EA\u52A8\u5408\u5E76\u3002"] }), error && _jsx("p", { className: "lead-banner", children: error }), _jsxs("div", { className: "lead-actions", children: [_jsx("button", { type: "button", className: "btn-primary", onClick: () => {
                                try {
                                    const eventName = events.find((item) => item.id === eventId)?.name;
                                    const articleIds = eventId ? news.filter((item) => item.eventId === eventId).map((item) => item.id) : [];
                                    const result = createManualLead({ title, notes, ownerId: ownerId || null, eventId: eventId || null, eventName, articleIds });
                                    if (result.kind === 'exists') {
                                        onExists({ title: title.trim(), notes, articleIds, targetId: result.lead.id });
                                        return;
                                    }
                                    onDone(result.lead.id);
                                }
                                catch (caught) {
                                    setError(caught instanceof Error ? caught.message : '保存失败');
                                }
                            }, children: "\u4FDD\u5B58" }), _jsx("button", { type: "button", className: "btn-quiet", onClick: onClose, children: "\u53D6\u6D88" })] })] }) }));
}
function Picker({ news, exclude, onClose, onAdd }) {
    const [q, setQ] = useState('');
    const [picked, setPicked] = useState([]);
    const rows = news.filter((item) => !exclude.has(item.id) && (!q || item.title.includes(q) || item.eventName.includes(q))).slice(0, 30);
    return (_jsx("div", { className: "lead-mask", onClick: onClose, children: _jsxs("section", { className: "lead-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "pick-title", onClick: (event) => event.stopPropagation(), children: [_jsx("h2", { id: "pick-title", children: "\u8865\u5145\u6750\u6599" }), _jsx("input", { type: "search", value: q, "aria-label": "\u641C\u7D22\u65B0\u95FB", placeholder: "\u641C\u7D22\u6807\u9898\u6216\u4E8B\u4EF6", onChange: (event) => setQ(event.target.value) }), rows.map((item) => (_jsxs("label", { className: "lead-check", children: [_jsx("input", { type: "checkbox", checked: picked.includes(item.id), onChange: (event) => setPicked((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)) }), item.title] }, item.id))), _jsxs("div", { className: "lead-actions", children: [_jsx("button", { type: "button", className: "btn-primary", disabled: !picked.length, onClick: () => onAdd(picked), children: "\u52A0\u5165\u6240\u9009" }), _jsx("button", { type: "button", className: "btn-quiet", onClick: onClose, children: "\u53D6\u6D88" })] })] }) }));
}

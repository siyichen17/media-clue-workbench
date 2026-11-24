import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertRuleDialog, MediaManager } from '../components/compete/MediaDialogs.tsx';
import { CompeteCategoryChart, CompeteTrendChart } from '../components/compete/CompeteCharts.tsx';
import { ReportWizard } from '../components/compete/ReportWizard.tsx';
import { ChartCard } from '../components/overview/ChartCard.tsx';
import { NewsDrawer } from '../components/news/NewsDrawer.tsx';
import { CATEGORIES, categoryById } from '../data/demo/catalog.ts';
import { MONITOR_NEWS } from '../data/demo/monitor.ts';
import { alertKindLabel, buildCompeteAlerts, categorySeries, dailySeries, filterMonitorNews, hotTopicIds, mediaMetrics, selectedMediaIds, sharedEvents, } from '../lib/competeSelectors.ts';
import { loadAlertRules, loadFilters, loadHandledAlerts, loadMediaState, profileName, saveAlertRules, saveFilters, saveHandledAlerts, saveMediaState, } from '../lib/competeStorage.ts';
import { DATA_AS_OF_LABEL, dateRangeOf, formatStamp, presetLabel } from '../lib/dates.ts';
import { attachReport, followEvent, restoreLead } from '../lib/leads.ts';
import { levelLabel, materialLevel, materialNature, natureLabel } from '../lib/material.ts';
import { mediaColor } from '../lib/mediaColor.ts';
import { listReports } from '../lib/reportStore.ts';
import { loadFollows, saveFollows } from '../lib/storage.ts';
const PAGE_SIZE = 8;
export function CompetePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const initialMedia = loadMediaState();
    const [mediaState, setMediaState] = useState(initialMedia);
    const [filters, setFilters] = useState(() => loadFilters(loadFiltersFallback(initialMedia)));
    const [rules, setRules] = useState(() => loadAlertRules());
    const [handled, setHandled] = useState(() => loadHandledAlerts());
    const [follows, setFollows] = useState(() => loadFollows());
    const [tab, setTab] = useState('news');
    const [query, setQuery] = useState('');
    const [tableMedia, setTableMedia] = useState('all');
    const [sort, setSort] = useState('latest');
    const [page, setPage] = useState(0);
    const [alertStatus, setAlertStatus] = useState('open');
    const [chartIds, setChartIds] = useState(null);
    const [drawer, setDrawer] = useState(null);
    const [managerOpen, setManagerOpen] = useState(false);
    const [ruleMediaId, setRuleMediaId] = useState(null);
    const [wizard, setWizard] = useState(() => {
        const state = location.state;
        return state?.wizard ?? null;
    });
    const [reportsOpen, setReportsOpen] = useState(false);
    const [leadHint, setLeadHint] = useState(null);
    const [reports, setReports] = useState([]);
    useEffect(() => {
        if (location.state)
            navigate(location.pathname, { replace: true, state: null });
    }, [location.pathname, location.state, navigate]);
    const range = dateRangeOf(filters);
    const mediaIds = selectedMediaIds(filters);
    const { news } = useMemo(() => filterMonitorNews(filters), [filters]);
    const hotTopics = useMemo(() => hotTopicIds(range.start, range.end), [range.start, range.end]);
    const metrics = useMemo(() => mediaMetrics(news, mediaIds, hotTopics), [news, mediaIds, hotTopics]);
    const days = useMemo(() => dailySeries(news, mediaIds, range.start, range.end), [news, mediaIds, range.start, range.end]);
    const categories = useMemo(() => categorySeries(news, mediaIds), [news, mediaIds]);
    const events = useMemo(() => sharedEvents(news, filters.ownMediaId), [news, filters.ownMediaId]);
    const alerts = useMemo(() => buildCompeteAlerts(news, rules, range.start, range.end), [news, rules, range.start, range.end]);
    const visibleChartIds = (chartIds ?? mediaIds.slice(0, 4)).filter((id) => mediaIds.includes(id));
    const names = (id) => profileName(mediaState.profiles, id);
    function updateFilters(next) {
        const peerIds = next.peerIds.filter((id) => id !== next.ownMediaId);
        const resolved = { ...next, peerIds };
        setFilters(resolved);
        saveFilters(resolved);
        setPage(0);
        if (resolved.ownMediaId !== mediaState.ownMediaId) {
            const saved = { ...mediaState, ownMediaId: resolved.ownMediaId };
            setMediaState(saved);
            saveMediaState(saved);
        }
    }
    function openNews(items, labels) {
        setDrawer({ kind: 'news', tags: labels, items });
    }
    const searched = news.filter((item) => {
        if (tableMedia !== 'all' && item.mediaId !== tableMedia)
            return false;
        return !query.trim() || item.title.includes(query.trim());
    });
    const sorted = [...searched].sort((a, b) => sort === 'latest' ? b.publishedAt.localeCompare(a.publishedAt) : a.publishedAt.localeCompare(b.publishedAt));
    const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const pageRows = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    const visibleAlerts = alerts.filter((item) => {
        const done = handled.has(item.id);
        if (alertStatus === 'open')
            return !done;
        if (alertStatus === 'done')
            return done;
        return true;
    });
    const totalFromCards = metrics.reduce((sum, item) => sum + item.newsCount, 0);
    return (_jsxs("main", { className: "page", children: [_jsxs("header", { className: "page-head", children: [_jsxs("div", { children: [_jsxs("div", { className: "title-row", children: [_jsx("h1", { children: "\u7ADE\u54C1\u76D1\u63A7" }), _jsx("span", { className: "demo-pill", children: "\u6A21\u62DF\u6F14\u793A\u6570\u636E" })] }), _jsx("p", { children: "\u8DDF\u8E2A\u540C\u884C\u62A5\u9053\u52A8\u6001\uFF0C\u5BF9\u6BD4\u5173\u6CE8\u91CD\u70B9\u4E0E\u5185\u5BB9\u5DEE\u5F02" })] }), _jsxs("div", { className: "head-actions", children: [_jsx("button", { type: "button", className: "btn ghost", onClick: () => {
                                    void listReports().then((rows) => {
                                        setReports(rows);
                                        setReportsOpen(true);
                                    });
                                }, children: "\u6700\u8FD1\u62A5\u544A" }), _jsx("button", { type: "button", className: "btn ghost", onClick: () => setManagerOpen(true), children: "\u7BA1\u7406\u5A92\u4F53" }), _jsx("button", { type: "button", className: "btn active", onClick: () => setWizard({ type: 'date' }), children: "\u751F\u6210\u5BF9\u6BD4\u62A5\u544A" }), _jsxs("div", { className: "cutoff", children: [_jsx("span", { children: "\u6F14\u793A\u6570\u636E\u622A\u6B62\u65F6\u95F4" }), _jsx("strong", { children: DATA_AS_OF_LABEL })] })] })] }), _jsxs("section", { className: "filter-bar", "aria-label": "\u7B5B\u9009", children: [_jsxs("div", { className: "filter-controls", children: [_jsx("div", { className: "segmented", role: "group", "aria-label": "\u65E5\u671F\u8303\u56F4", children: ['7d', '14d', 'custom'].map((preset) => (_jsx("button", { type: "button", "aria-pressed": filters.preset === preset, onClick: () => updateFilters({ ...filters, preset }), children: presetLabel(preset) }, preset))) }), _jsxs("label", { className: "field", children: ["\u5F00\u59CB", _jsx("input", { type: "date", value: range.start, onChange: (event) => updateFilters({ ...filters, preset: 'custom', customStart: event.target.value }) })] }), _jsxs("label", { className: "field", children: ["\u7ED3\u675F", _jsx("input", { type: "date", value: range.end, onChange: (event) => updateFilters({ ...filters, preset: 'custom', customEnd: event.target.value }) })] }), _jsxs("label", { className: "field", children: ["\u672C\u5A92\u4F53", _jsx("select", { value: filters.ownMediaId, onChange: (event) => updateFilters({ ...filters, ownMediaId: event.target.value }), children: mediaState.profiles.filter((item) => item.enabled).map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id))) })] }), _jsxs("label", { className: "field", children: ["\u5206\u7C7B", _jsxs("select", { value: filters.categoryId, onChange: (event) => updateFilters({ ...filters, categoryId: event.target.value }), children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u5206\u7C7B" }), CATEGORIES.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] })] }), _jsxs("label", { className: "field", children: ["\u6570\u636E\u6027\u8D28", _jsxs("select", { value: filters.nature, onChange: (event) => updateFilters({ ...filters, nature: event.target.value }), children: [_jsx("option", { value: "all", children: "\u5168\u90E8" }), _jsx("option", { value: "real", children: "\u771F\u5B9E" }), _jsx("option", { value: "simulated", children: "\u6A21\u62DF" })] })] })] }), _jsxs("fieldset", { className: "check-grid", children: [_jsx("legend", { children: "\u5BF9\u7167\u5A92\u4F53" }), mediaState.profiles.filter((item) => item.enabled && item.id !== filters.ownMediaId).map((item) => (_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: filters.peerIds.includes(item.id), onChange: (event) => updateFilters({
                                            ...filters,
                                            peerIds: event.target.checked ? [...filters.peerIds, item.id] : filters.peerIds.filter((id) => id !== item.id),
                                        }) }), item.name] }, item.id)))] }), _jsxs("p", { className: "chart-note", children: ["\u65E5\u671F\u6309\u5317\u4EAC\u65F6\u95F4\uFF0C\u7ED3\u675F\u65E5\u5305\u542B\u5F53\u5929\u3002\u6536\u5F55\u6570\u53EA\u7EDF\u8BA1\u5F53\u524D\u6761\u4EF6\u4E0B\u7684\u62A5\u9053\uFF0C\u4E0D\u4EE3\u8868\u5A92\u4F53\u771F\u5B9E\u5168\u90E8\u53D1\u7A3F\u91CF\u3002\u5361\u7247\u5408\u8BA1 ", totalFromCards, " \u7BC7\uFF0C\u4E0E\u5F53\u524D\u5217\u8868\u4E00\u81F4\u3002"] })] }), _jsx("section", { className: "media-grid", "aria-label": "\u5A92\u4F53\u6982\u51B5", children: metrics.map((item) => {
                    const profile = mediaState.profiles.find((profileItem) => profileItem.id === item.mediaId);
                    const customEmpty = profile && !profile.builtin && !item.hasNews;
                    return (_jsxs("article", { className: "card media-card", children: [_jsxs("div", { className: "title-row", children: [_jsx("span", { className: "media-mark", style: { background: mediaColor(item.mediaId) }, children: names(item.mediaId).slice(0, 1) }), _jsx("strong", { children: names(item.mediaId) }), item.mediaId === filters.ownMediaId && _jsx("span", { className: "static-tag", children: "\u672C\u5A92\u4F53" })] }), customEmpty ? (_jsx("p", { className: "chart-note", children: "\u6682\u65E0\u6570\u636E\u3002\u5C1A\u672A\u63A5\u5165\u8BE5\u5A92\u4F53\u7684\u62A5\u9053\uFF0C\u4E0D\u4F1A\u663E\u793A\u4E3A\u91C7\u96C6\u6210\u529F\u3002" })) : (_jsxs("dl", { className: "metric-mini", children: [_jsxs("div", { children: [_jsx("dt", { children: "\u5DF2\u6536\u5F55\u62A5\u9053" }), _jsx("dd", { children: item.newsCount })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u4E8B\u4EF6" }), _jsx("dd", { children: item.eventCount })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u6D89\u53CA\u4E0A\u699C\u4E8B\u4EF6\u7684\u62A5\u9053" }), _jsx("dd", { children: item.hotNewsCount })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u7C89\u4E1D\u91CF" }), _jsx("dd", { children: "\u2014" })] })] })), _jsxs("div", { className: "news-actions", children: [_jsx("button", { type: "button", className: "btn tiny", onClick: () => openNews(news.filter((row) => row.mediaId === item.mediaId), [
                                            { id: 'range', label: `${range.start} 至 ${range.end}` },
                                            { id: 'media', label: names(item.mediaId) },
                                        ]), children: "\u67E5\u770B\u62A5\u9053" }), _jsx("button", { type: "button", className: "btn tiny", onClick: () => setRuleMediaId(item.mediaId), children: "\u8BBE\u7F6E\u9884\u8B66" })] })] }, item.mediaId));
                }) }), _jsxs("section", { className: "split-50", children: [_jsx(ChartCard, { title: "\u6BCF\u65E5\u5DF2\u6536\u5F55\u62A5\u9053\u6570", caption: "\u6309\u53D1\u5E03\u65F6\u95F4\u8BA1\u5165\u5F53\u5929\u3002\u70B9\u51FB\u7EBF\u6761\u4E0A\u7684\u65E5\u671F\uFF0C\u67E5\u770B\u8BE5\u5A92\u4F53\u5F53\u5929\u7684\u62A5\u9053\u3002\u989C\u8272\u4E0E\u5A92\u4F53\u5361\u7247\u4E00\u81F4\u3002", extra: _jsx(ChartMediaToggle, { ids: mediaIds, visible: visibleChartIds, nameOf: names, onChange: setChartIds }), empty: !news.length, children: _jsx(CompeteTrendChart, { dates: days.map((item) => item.date), series: visibleChartIds.map((id) => ({ id, name: names(id), data: days.map((day) => day.counts[id] ?? 0) })), onSelect: (mediaId, date) => openNews(news.filter((item) => item.mediaId === mediaId && item.publishedAt.slice(0, 10) === date), [
                                { id: 'date', label: date },
                                { id: 'media', label: names(mediaId) },
                            ]) }) }), _jsx(ChartCard, { title: "\u8BDD\u9898\u5206\u7C7B\u5206\u5E03", caption: "\u4E00\u7BC7\u62A5\u9053\u53EA\u8BA1\u5165\u4E3B\u8981\u5206\u7C7B\u3002\u70B9\u51FB\u67F1\u5F62\u67E5\u770B\u8BE5\u5A92\u4F53\u3001\u8BE5\u5206\u7C7B\u7684\u62A5\u9053\u3002", empty: !categories.length, children: _jsx(CompeteCategoryChart, { categories: categories.map((item) => ({ id: item.categoryId, name: item.name })), series: visibleChartIds.map((id) => ({ id, name: names(id), data: categories.map((item) => item.counts[id] ?? 0) })), onSelect: (mediaId, categoryId) => openNews(news.filter((item) => item.mediaId === mediaId && item.categoryId === categoryId), [
                                { id: 'range', label: `${range.start} 至 ${range.end}` },
                                { id: 'media', label: names(mediaId) },
                                { id: 'category', label: categoryById[categoryId]?.name ?? categoryId },
                            ]) }) })] }), _jsxs("section", { className: "card", children: [_jsx("div", { className: "card-head", children: _jsxs("div", { className: "segmented", role: "tablist", "aria-label": "\u5185\u5BB9", children: [_jsx("button", { type: "button", "aria-selected": tab === 'news', onClick: () => setTab('news'), children: "\u6700\u65B0\u62A5\u9053" }), _jsx("button", { type: "button", "aria-selected": tab === 'events', onClick: () => setTab('events'), children: "\u5171\u540C\u4E8B\u4EF6" }), _jsx("button", { type: "button", "aria-selected": tab === 'alerts', onClick: () => setTab('alerts'), children: "\u9884\u8B66\u8BB0\u5F55" })] }) }), _jsxs("div", { className: "card-body", children: [tab === 'news' && (_jsxs("div", { className: "stack", children: [_jsxs("div", { className: "filter-controls", children: [_jsxs("label", { className: "field grow", children: ["\u6807\u9898", _jsx("input", { value: query, onChange: (event) => { setQuery(event.target.value); setPage(0); }, placeholder: "\u641C\u7D22\u6807\u9898" })] }), _jsxs("label", { className: "field", children: ["\u5A92\u4F53", _jsxs("select", { value: tableMedia, onChange: (event) => { setTableMedia(event.target.value); setPage(0); }, children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u6240\u9009\u5A92\u4F53" }), mediaIds.map((id) => _jsx("option", { value: id, children: names(id) }, id))] })] }), _jsxs("div", { className: "segmented", children: [_jsx("button", { type: "button", "aria-pressed": sort === 'latest', onClick: () => setSort('latest'), children: "\u6700\u65B0" }), _jsx("button", { type: "button", "aria-pressed": sort === 'earliest', onClick: () => setSort('earliest'), children: "\u6700\u65E9" })] })] }), _jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u5A92\u4F53" }), _jsx("th", { children: "\u6807\u9898" }), _jsx("th", { children: "\u53D1\u5E03\u65F6\u95F4" }), _jsx("th", { children: "\u5206\u7C7B" }), _jsx("th", { children: "\u4E8B\u4EF6" }), _jsx("th", { children: "\u6750\u6599" }), _jsx("th", { children: "\u6027\u8D28" }), _jsx("th", { children: "\u64CD\u4F5C" })] }) }), _jsx("tbody", { children: pageRows.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 8, children: "\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u62A5\u9053" }) })) : pageRows.map((item) => (_jsxs("tr", { children: [_jsx("td", { children: names(item.mediaId) }), _jsx("td", { children: item.title }), _jsx("td", { children: formatStamp(item.publishedAt) }), _jsx("td", { children: categoryById[item.categoryId]?.name }), _jsx("td", { children: item.eventName }), _jsx("td", { children: levelLabel(materialLevel(item)) }), _jsx("td", { children: natureLabel(materialNature(item)) }), _jsx("td", { children: _jsx("button", { type: "button", className: "btn tiny", onClick: () => openNews([item], [{ id: 'one', label: item.eventName }]), children: "\u67E5\u770B\u8BE6\u60C5" }) })] }, item.id))) })] }) }), _jsxs("div", { className: "title-row", children: [_jsxs("span", { className: "chart-note", children: ["\u5171 ", sorted.length, " \u6761"] }), _jsx("button", { type: "button", className: "btn tiny", disabled: page === 0, onClick: () => setPage((value) => value - 1), children: "\u4E0A\u4E00\u9875" }), _jsxs("span", { className: "chart-note", children: [page + 1, " / ", pageCount] }), _jsx("button", { type: "button", className: "btn tiny", disabled: page + 1 >= pageCount, onClick: () => setPage((value) => value + 1), children: "\u4E0B\u4E00\u9875" })] })] })), tab === 'events' && (_jsxs("div", { className: "table-wrap", children: [leadHint && _jsxs("p", { className: "hint", children: [leadHint.text, " ", _jsx("button", { type: "button", className: "btn tiny", onClick: () => navigate(`/leads?lead=${leadHint.id}`), children: "\u67E5\u770B\u7EBF\u7D22" }), leadHint.archived && _jsx("button", { type: "button", className: "btn tiny", onClick: () => { restoreLead(leadHint.id); setLeadHint({ id: leadHint.id, text: '已恢复为待处理。' }); }, children: "\u6062\u590D\u8DDF\u8FDB" })] }), _jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u4E8B\u4EF6" }), _jsx("th", { children: "\u5A92\u4F53\u6570" }), _jsx("th", { children: "\u62A5\u9053\u6570" }), _jsx("th", { children: "\u6700\u8FD1\u62A5\u9053" }), _jsx("th", { children: "\u672C\u5A92\u4F53" }), _jsx("th", { children: "\u64CD\u4F5C" })] }) }), _jsx("tbody", { children: events.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, children: "\u5F53\u524D\u6761\u4EF6\u4E0B\u6CA1\u6709\u81F3\u5C11\u4E24\u5BB6\u5A92\u4F53\u5171\u540C\u6536\u5F55\u7684\u4E8B\u4EF6" }) })) : events.map((item) => (_jsxs("tr", { children: [_jsx("td", { children: item.eventName }), _jsx("td", { children: item.mediaIds.length }), _jsx("td", { children: item.newsCount }), _jsx("td", { children: formatStamp(item.latestAt) }), _jsx("td", { children: item.ownRecorded ? '有收录记录' : '本媒体未收录' }), _jsxs("td", { className: "news-actions", children: [_jsx("button", { type: "button", className: "btn tiny", onClick: () => openNews(news.filter((row) => row.eventId === item.eventId), [{ id: 'event', label: item.eventName }]), children: "\u67E5\u770B\u6750\u6599" }), _jsx("button", { type: "button", className: "btn tiny", onClick: () => setWizard({ type: 'event', eventId: item.eventId }), children: "\u751F\u6210\u4E8B\u4EF6\u5BF9\u6BD4\u62A5\u544A" }), _jsx("button", { type: "button", className: "btn tiny", onClick: () => {
                                                                        const result = followEvent({
                                                                            eventId: item.eventId,
                                                                            eventName: item.eventName,
                                                                            articleIds: news.filter((row) => row.eventId === item.eventId).map((row) => row.id),
                                                                            entry: 'compete',
                                                                        });
                                                                        setLeadHint({
                                                                            id: result.lead.id,
                                                                            archived: result.kind === 'archived',
                                                                            text: result.kind === 'archived'
                                                                                ? `「${item.eventName}」已归档，没有自动恢复。`
                                                                                : result.kind === 'created'
                                                                                    ? `已加入「${item.eventName}」。`
                                                                                    : `已合并到原线索「${item.eventName}」，备注、负责人和报告关联保持不变。`,
                                                                        });
                                                                    }, children: "\u8DDF\u8FDB\u4E8B\u4EF6" })] })] }, item.eventId))) })] })] })), tab === 'alerts' && (_jsxs("div", { className: "stack", children: [_jsxs("div", { className: "segmented", children: [_jsx("button", { type: "button", "aria-pressed": alertStatus === 'open', onClick: () => setAlertStatus('open'), children: "\u5F85\u5904\u7406" }), _jsx("button", { type: "button", "aria-pressed": alertStatus === 'done', onClick: () => setAlertStatus('done'), children: "\u5DF2\u5904\u7406" }), _jsx("button", { type: "button", "aria-pressed": alertStatus === 'all', onClick: () => setAlertStatus('all'), children: "\u5168\u90E8" })] }), _jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u65F6\u95F4" }), _jsx("th", { children: "\u5A92\u4F53" }), _jsx("th", { children: "\u7C7B\u578B" }), _jsx("th", { children: "\u89E6\u53D1\u8BF4\u660E" }), _jsx("th", { children: "\u4F9D\u636E" }), _jsx("th", { children: "\u72B6\u6001" }), _jsx("th", { children: "\u64CD\u4F5C" })] }) }), _jsx("tbody", { children: visibleAlerts.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, children: "\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u9884\u8B66\u8BB0\u5F55" }) })) : visibleAlerts.map((item) => (_jsxs("tr", { children: [_jsx("td", { children: formatStamp(item.triggerAt) }), _jsx("td", { children: names(item.mediaId) }), _jsxs("td", { children: [alertKindLabel(item.kind), item.simulated ? ' · 模拟' : ''] }), _jsx("td", { children: item.summary }), _jsx("td", { children: item.basis }), _jsx("td", { children: handled.has(item.id) ? '已处理' : '待处理' }), _jsxs("td", { className: "news-actions", children: [_jsx("button", { type: "button", className: "btn tiny", onClick: () => openNews(MONITOR_NEWS.filter((row) => item.newsIds.includes(row.id)), [{ id: 'alert', label: item.summary }]), children: "\u67E5\u770B\u4F9D\u636E" }), _jsx("button", { type: "button", className: "btn tiny", onClick: () => {
                                                                            const next = new Set(handled);
                                                                            if (next.has(item.id))
                                                                                next.delete(item.id);
                                                                            else
                                                                                next.add(item.id);
                                                                            setHandled(next);
                                                                            saveHandledAlerts(next);
                                                                        }, children: handled.has(item.id) ? '标为待处理' : '标记已处理' })] })] }, item.id))) })] }) })] }))] })] }), _jsx(NewsDrawer, { entry: "compete", model: drawer, followedIds: follows, onClose: () => setDrawer(null), onToggleFollow: (id) => {
                    const next = new Set(follows);
                    if (next.has(id))
                        next.delete(id);
                    else
                        next.add(id);
                    setFollows(next);
                    saveFollows(next);
                } }), managerOpen && (_jsx(MediaManager, { state: mediaState, onClose: () => setManagerOpen(false), onSave: (next) => {
                    setMediaState(next);
                    saveMediaState(next);
                    updateFilters({
                        ...filters,
                        ownMediaId: next.ownMediaId,
                        peerIds: filters.peerIds.filter((id) => next.profiles.some((item) => item.id === id && item.enabled && id !== next.ownMediaId)),
                    });
                    setManagerOpen(false);
                } })), ruleMediaId && (_jsx(AlertRuleDialog, { mediaId: ruleMediaId, mediaName: names(ruleMediaId), rules: rules, onClose: () => setRuleMediaId(null), onSave: (nextRules) => {
                    const kept = rules.filter((rule) => rule.mediaId !== ruleMediaId);
                    const merged = [...kept, ...nextRules];
                    setRules(merged);
                    saveAlertRules(merged);
                    setRuleMediaId(null);
                } })), wizard && (_jsx(ReportWizard, { filters: filters, profiles: mediaState.profiles, initialType: wizard.type, initialEventId: wizard.eventId, initialRange: wizard.start && wizard.end ? { start: wizard.start, end: wizard.end } : undefined, onClose: () => setWizard(null), onCreated: (id, materialCount) => {
                    if (wizard.leadId)
                        attachReport(wizard.leadId, id, materialCount);
                    navigate(`/reports/${id}`, { state: { leadId: wizard.leadId } });
                } })), reportsOpen && (_jsxs("div", { className: "modal-root", children: [_jsx("button", { type: "button", className: "drawer-mask", "aria-label": "\u5173\u95ED\u6700\u8FD1\u62A5\u544A", onClick: () => setReportsOpen(false) }), _jsxs("section", { className: "modal-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "recent-reports-title", children: [_jsxs("header", { className: "drawer-head", children: [_jsx("h2", { id: "recent-reports-title", children: "\u6700\u8FD1\u62A5\u544A" }), _jsx("button", { type: "button", className: "icon-button", onClick: () => setReportsOpen(false), "aria-label": "\u5173\u95ED", children: "\u00D7" })] }), _jsx("div", { className: "drawer-scroll", children: reports.length === 0 ? _jsx("div", { className: "empty-state", children: "\u8FD8\u6CA1\u6709\u4FDD\u5B58\u7684\u62A5\u544A" }) : reports.map((item) => (_jsxs("button", { type: "button", className: "pick-row", onClick: () => navigate(`/reports/${item.id}`), children: [_jsx("strong", { children: item.title }), _jsxs("span", { className: "news-meta", children: [item.type === 'date' ? '日期对比' : '事件对比', " \u00B7 ", item.status === 'saved' ? '已保存' : '草稿', " \u00B7 ", item.updatedAt.slice(0, 16).replace('T', ' ')] })] }, item.id))) })] })] }))] }));
}
function loadFiltersFallback(state) {
    const peerIds = state.profiles.filter((item) => item.enabled && item.id !== state.ownMediaId).map((item) => item.id);
    return {
        preset: '7d',
        customStart: '2026-11-04',
        customEnd: '2026-11-10',
        ownMediaId: state.ownMediaId,
        peerIds,
        categoryId: 'all',
        nature: 'all',
    };
}
function ChartMediaToggle({ ids, visible, nameOf, onChange, }) {
    if (ids.length <= 4)
        return null;
    return (_jsx("div", { className: "check-grid compact", children: ids.map((id) => (_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: visible.includes(id), onChange: (event) => {
                        const next = event.target.checked ? [...visible, id] : visible.filter((item) => item !== id);
                        onChange(next.length ? next : [id]);
                    } }), nameOf(id)] }, id))) }));
}

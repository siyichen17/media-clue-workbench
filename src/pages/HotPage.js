import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EXPLAIN_PROMPT_VERSION, HOT_PROMPT_VERSION } from '../../shared/aiTypes.ts';
import { EChart } from '../components/overview/EChart.tsx';
import { NewsDrawer } from '../components/news/NewsDrawer.tsx';
import { categoryById, topicById } from '../data/demo/catalog.ts';
import { MEDIA } from '../data/demo/index.ts';
import { DEMO_COVERAGE } from '../data/demo/hotBatch.ts';
import './hot.css';
import { AiRequestError, fetchAiStatus, requestExplain, requestProgress } from '../lib/aiClient.ts';
import { DATA_AS_OF_LABEL, DATA_END, DATA_START, dateRangeOf, formatStamp, presetLabel } from '../lib/dates.ts';
import { allTopics, boardTimes, buildExplain, dailyBoardCounts, dailyNewsCounts, drillEvents, eventCatalog, eventsForTopic, followDelta, hotNews, latestBoard, newsForEvent, rankDelta, rankFacts, rankSeries, resolveEventId, rowsAt, snapshotsOnDay, topicName, topicNews, topicOfEvent, } from '../lib/hotSelectors.ts';
import { demoBatchLoaded, loadEventFollows, loadExplainCache, loadKeywords, loadProgressCache, loadTopicFollows, loadViewState, markDemoBatchLoaded, saveKeywords, saveManualLink, saveTopicFollows, saveViewState, upsertExplainCache, upsertProgressCache, } from '../lib/hotStorage.ts';
import { findLeadByEvent, followEvent, restoreLead } from '../lib/leads.ts';
import { materialLevel, materialNature } from '../lib/material.ts';
import { loadFollows, saveFollows } from '../lib/storage.ts';
function materialOf(item) {
    return {
        articleId: item.id,
        eventId: item.eventId,
        mediaId: item.mediaId,
        mediaName: item.mediaName,
        publishedAt: item.publishedAt,
        completeness: materialLevel(item),
        nature: materialNature(item),
        title: item.title,
        summary: item.summary,
        body: item.body,
    };
}
function progressKey(eventId, start, end, ids, scope) {
    const base = `${HOT_PROMPT_VERSION}:${eventId}:${start}:${end}:${ids.join(',')}`;
    return scope === 'asof' ? `${base}:asof` : base;
}
function explainKey(topicId, start, mode, ids) {
    return `${EXPLAIN_PROMPT_VERSION}:${topicId}:${start}:${mode}:${ids.join(',')}`;
}
function displayTitle(title) {
    return title.replace(/（[^）]*）$/, '');
}
function shortDay(day) {
    if (day.length < 10)
        return day;
    return `${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日`;
}
function heatText(value) {
    if (value >= 10000)
        return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
    return value.toLocaleString('zh-CN');
}
function nodeKind(type) {
    if (type === 'commentary')
        return { label: '相关解读', className: 'read' };
    if (type === 'unverified')
        return { label: '信息待核实', className: 'check' };
    return { label: '事实进展', className: 'fact' };
}
export function HotPage() {
    const navigate = useNavigate();
    const saved = useRef(loadViewState()).current;
    const [platform, setPlatform] = useState(saved?.platform ?? '微博');
    const [snapshotId, setSnapshotId] = useState(saved?.snapshotId ?? null);
    const [itemId, setItemId] = useState(saved?.itemId ?? null);
    const [eventId, setEventId] = useState(saved?.eventId ?? null);
    const [topicLocked, setTopicLocked] = useState(saved?.topicLocked ?? false);
    const [topicId, setTopicId] = useState(saved?.topicId ?? null);
    const [preset, setPreset] = useState(saved?.preset ?? '7d');
    const [customStart, setCustomStart] = useState(saved?.customStart ?? DATA_START);
    const [customEnd, setCustomEnd] = useState(saved?.customEnd ?? DATA_END);
    const [metric, setMetric] = useState(saved?.metric ?? 'news');
    const [selectedDay, setSelectedDay] = useState(saved?.selectedDay ?? null);
    const [mediaId, setMediaId] = useState(saved?.mediaId ?? 'all');
    const [news, setNews] = useState(() => hotNews());
    const [follows, setFollows] = useState(() => loadTopicFollows());
    const [leads, setLeads] = useState(() => loadEventFollows());
    const [keywords, setKeywords] = useState(() => loadKeywords());
    const [keywordOnly, setKeywordOnly] = useState(false);
    const [keywordOpen, setKeywordOpen] = useState(false);
    const [followOpen, setFollowOpen] = useState(false);
    const [leadOpen, setLeadOpen] = useState(false);
    const [followNotice, setFollowNotice] = useState(null);
    const [archivedAsk, setArchivedAsk] = useState(null);
    const [keywordDraft, setKeywordDraft] = useState('');
    const [linkQuery, setLinkQuery] = useState('');
    const [progressMode, setProgressMode] = useState('summary');
    const [progress, setProgress] = useState(null);
    const [progressStale, setProgressStale] = useState(0);
    const [progressError, setProgressError] = useState('');
    const [progressBusy, setProgressBusy] = useState(false);
    const [explain, setExplain] = useState(null);
    const [explainError, setExplainError] = useState('');
    const [explainBusy, setExplainBusy] = useState(false);
    const [aiReady, setAiReady] = useState(null);
    const [drawerItems, setDrawerItems] = useState(null);
    const [articleFollows, setArticleFollows] = useState(() => loadFollows());
    const [compareHint, setCompareHint] = useState('');
    const [openNodes, setOpenNodes] = useState(saved?.openNodes ?? []);
    const [rankOpen, setRankOpen] = useState(false);
    const [materialMode, setMaterialMode] = useState(saved?.materialMode ?? 'later');
    const [reportSort, setReportSort] = useState(saved?.reportSort ?? 'latest');
    const [progressNote, setProgressNote] = useState('');
    const [followDialog, setFollowDialog] = useState(false);
    const [followDraft, setFollowDraft] = useState('');
    const [evidenceIds, setEvidenceIds] = useState([]);
    const [eventLimit, setEventLimit] = useState(6);
    const listRef = useRef(null);
    const requestRef = useRef(0);
    const explainRef = useRef(0);
    const times = boardTimes(platform);
    const activeTime = snapshotId && times.includes(snapshotId) ? snapshotId : latestBoard(platform);
    const rows = activeTime ? rowsAt(platform, activeTime) : [];
    const visibleRows = keywordOnly ? rows.filter((row) => keywords.some((word) => row.title.includes(word))) : rows;
    const selected = visibleRows.find((row) => row.itemId === itemId) ?? rows.find((row) => row.itemId === itemId) ?? null;
    const resolvedEvent = selected ? resolveEventId(selected) : null;
    const range = dateRangeOf({ preset, customStart, customEnd });
    const events = eventCatalog(news);
    const currentEvent = events.find((item) => item.id === eventId) ?? null;
    const eventNews = eventId
        ? newsForEvent(eventId, news).filter((item) => {
            const day = item.publishedAt.slice(0, 10);
            if (day < range.start || day > range.end)
                return false;
            if (materialMode === 'asof' && selected && item.publishedAt > selected.observedAt)
                return false;
            return true;
        })
        : [];
    const materialIds = eventNews.map((item) => item.id).sort();
    const activeTopic = topicId;
    const counts = activeTopic ? dailyNewsCounts(activeTopic, range.start, range.end, mediaId) : [];
    const boardCounts = activeTopic ? dailyBoardCounts(activeTopic, range.start, range.end) : [];
    const drillStart = selectedDay ?? range.start;
    const drillEnd = selectedDay ?? range.end;
    const drilled = activeTopic ? drillEvents(activeTopic, drillStart, drillEnd, news) : [];
    const explainWindow = selectedDay ? { start: selectedDay, end: selectedDay } : preset === 'custom' ? range : null;
    const explainStats = activeTopic && explainWindow ? buildExplain(activeTopic, explainWindow.start, explainWindow.end, news) : null;
    const rank = selected ? rankFacts(selected.platform, selected.itemId) : null;
    const followedEvent = leads.find((item) => item.eventId === eventId);
    useEffect(() => {
        void fetchAiStatus().then((status) => setAiReady(status.configured));
    }, []);
    useEffect(() => {
        if (!keywordOpen && !followOpen && !leadOpen && !followDialog)
            return;
        const onKey = (event) => {
            if (event.key !== 'Escape')
                return;
            setKeywordOpen(false);
            setFollowOpen(false);
            setLeadOpen(false);
            setFollowDialog(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [keywordOpen, followOpen, leadOpen, followDialog]);
    useEffect(() => {
        const frame = requestAnimationFrame(() => window.scrollTo(0, saved?.scroll ?? 0));
        return () => cancelAnimationFrame(frame);
    }, [saved]);
    useEffect(() => {
        saveViewState({
            platform,
            snapshotId: activeTime,
            itemId,
            eventId,
            topicLocked,
            topicId,
            preset,
            customStart,
            customEnd,
            metric,
            selectedDay,
            mediaId,
            scroll: window.scrollY,
            materialMode,
            openNodes,
            reportSort,
        });
    }, [platform, activeTime, itemId, eventId, topicLocked, topicId, preset, customStart, customEnd, metric, selectedDay, mediaId, materialMode, openNodes, reportSort]);
    useEffect(() => {
        const onScroll = () => {
            const current = loadViewState();
            if (current)
                saveViewState({ ...current, platform, snapshotId: activeTime, itemId, eventId, topicLocked, topicId, preset, customStart, customEnd, metric, selectedDay, mediaId, scroll: window.scrollY, materialMode, openNodes, reportSort });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [platform, activeTime, itemId, eventId, topicLocked, topicId, preset, customStart, customEnd, metric, selectedDay, mediaId, materialMode, openNodes, reportSort]);
    useEffect(() => {
        const current = listRef.current?.querySelector('[aria-current="true"]');
        current?.scrollIntoView({ block: 'nearest' });
    }, [selected?.id, platform, activeTime]);
    useEffect(() => {
        if (!eventId) {
            setProgress(null);
            setProgressStale(0);
            setProgressNote('');
            return;
        }
        const key = progressKey(eventId, range.start, range.end, materialIds, materialMode);
        const cached = loadProgressCache().find((item) => item.eventId === eventId && (item.scope ?? 'later') === materialMode);
        if (!cached) {
            setProgress(null);
            setProgressStale(0);
            setProgressNote('');
            return;
        }
        const missing = materialIds.filter((id) => !cached.materialIds.includes(id)).length;
        setProgress(cached.result);
        setProgressStale(cached.key === key ? 0 : missing);
        setProgressNote(cached.key === key ? '' : missing > 0 ? `新增${missing}篇报道，当前概括尚未包含。` : '当前材料范围与已保存概括不一致，仍显示上次结果。');
    }, [eventId, range.start, range.end, materialMode, materialIds.join('|')]);
    const explainIds = explainStats
        ? [...explainStats.events]
            .filter((item) => item.eventId !== 'pending')
            .sort((a, b) => b.current - a.current)
            .flatMap((item) => item.articleIds)
            .slice(0, 24)
        : [];
    const explainMaterials = activeTopic && explainStats
        ? topicNews(activeTopic, explainStats.currentRange.start, explainStats.currentRange.end, 'all', news).filter((item) => explainIds.includes(item.id))
        : [];
    const currentExplainKey = activeTopic && explainStats ? explainKey(activeTopic, explainStats.currentRange.start, explainStats.mode, explainMaterials.map((item) => item.id)) : '';
    useEffect(() => {
        if (!currentExplainKey) {
            setExplain(null);
            return;
        }
        const hit = loadExplainCache().find((item) => item.key === currentExplainKey);
        setExplain(hit ? hit.result : null);
        setExplainError('');
    }, [currentExplainKey]);
    function selectRow(row) {
        requestRef.current += 1;
        explainRef.current += 1;
        setItemId(row.itemId);
        setProgressError('');
        setCompareHint('');
        setOpenNodes([]);
        setEvidenceIds([]);
        const linked = resolveEventId(row);
        setEventId(linked);
        if (!topicLocked)
            setTopicId(linked ? topicOfEvent(linked, news) : row.topicId);
    }
    function chooseEvent(next) {
        requestRef.current += 1;
        setEventId(next);
        setProgress(null);
        setProgressStale(0);
        setProgressError('');
        setOpenNodes([]);
        setProgressMode('summary');
        if (!topicLocked)
            setTopicId(topicOfEvent(next, news));
    }
    async function generateProgress() {
        if (!eventId || !eventNews.length)
            return;
        const token = ++requestRef.current;
        const ids = eventNews.map((item) => item.id).sort();
        const key = progressKey(eventId, range.start, range.end, ids, materialMode);
        setProgressBusy(true);
        setProgressError('');
        try {
            const result = await requestProgress(eventNews.map(materialOf));
            if (token !== requestRef.current)
                return;
            upsertProgressCache({ key, eventId, materialIds: ids, result, createdAt: DATA_AS_OF_LABEL, scope: materialMode });
            setProgress(result);
            setProgressStale(0);
            setProgressNote('');
            setProgressMode('summary');
        }
        catch (error) {
            if (token !== requestRef.current)
                return;
            if (error instanceof DOMException && error.name === 'AbortError')
                return;
            setProgressError(error instanceof AiRequestError ? error.message : '进展生成失败');
            if (progress)
                setProgressNote('更新失败，仍显示上次概括。');
        }
        finally {
            if (token === requestRef.current)
                setProgressBusy(false);
        }
    }
    async function generateExplain() {
        if (!activeTopic || !explainStats)
            return;
        const token = ++explainRef.current;
        const eventIds = [...new Set(explainMaterials.map((item) => item.eventId))].filter((id) => id !== 'pending');
        if (!eventIds.length) {
            setExplainError('本期没有可归因到单一事件的报道，统计数字仍保留在上方。');
            return;
        }
        const materials = explainMaterials.map(materialOf);
        const key = currentExplainKey;
        setExplainBusy(true);
        setExplainError('');
        try {
            const result = await requestExplain({
                mode: explainStats.mode,
                stats: explainStats,
                materials,
                eventIds,
            });
            if (token !== explainRef.current)
                return;
            upsertExplainCache({ key, eventId: activeTopic, materialIds: materials.map((item) => item.articleId), result, createdAt: DATA_AS_OF_LABEL });
            setExplain(result);
        }
        catch (error) {
            if (token !== explainRef.current)
                return;
            setExplainError(error instanceof AiRequestError ? error.message : '解释生成失败');
        }
        finally {
            if (token === explainRef.current)
                setExplainBusy(false);
        }
    }
    function followTopic(nextTopic) {
        const watermark = news.filter((item) => item.topicId === nextTopic).map((item) => item.ingestedAt || item.publishedAt).sort().at(-1) ?? DATA_AS_OF_LABEL;
        const rowsNow = loadTopicFollows();
        const existing = rowsNow.find((item) => item.topicId === nextTopic);
        const next = existing
            ? rowsNow.map((item) => (item.topicId === nextTopic ? { ...item, active: true } : item))
            : [{ topicId: nextTopic, followedAt: DATA_AS_OF_LABEL, seenWatermark: watermark, active: true }, ...rowsNow];
        saveTopicFollows(next);
        setFollows(next);
    }
    function unfollowTopic(nextTopic) {
        const next = loadTopicFollows().map((item) => (item.topicId === nextTopic ? { ...item, active: false } : item));
        saveTopicFollows(next);
        setFollows(next);
    }
    function markSeen(nextTopic) {
        const loaded = news.filter((item) => item.topicId === nextTopic).map((item) => item.ingestedAt || item.publishedAt).sort();
        const watermark = loaded.at(-1);
        if (!watermark)
            return;
        const next = loadTopicFollows().map((item) => (item.topicId === nextTopic ? { ...item, seenWatermark: watermark } : item));
        saveTopicFollows(next);
        setFollows(next);
    }
    function saveFollow() {
        if (!currentEvent)
            return;
        const existing = findLeadByEvent(currentEvent.id);
        if (existing?.status === 'archived') {
            setFollowDialog(false);
            setArchivedAsk(existing);
            return;
        }
        const result = followEvent({
            eventId: currentEvent.id,
            eventName: currentEvent.name,
            articleIds: eventNews.map((item) => item.id),
            entry: 'hot',
            note: followDraft,
            analysisKey: progress ? progressKey(currentEvent.id, range.start, range.end, eventNews.map((item) => item.id), materialMode) : null,
        });
        setLeads(loadEventFollows());
        setFollowDialog(false);
        setFollowNotice({
            id: result.lead.id,
            text: result.kind === 'created' ? '已加入跟进。' : '已打开原线索并合并材料，原备注和负责人未改。',
        });
    }
    function confirmLink(nextEventId) {
        if (!selected)
            return;
        saveManualLink(`${selected.platform}:${selected.itemId}`, nextEventId);
        chooseEvent(nextEventId);
        setLinkQuery('');
    }
    function loadBatch() {
        if (!demoBatchLoaded())
            markDemoBatchLoaded();
        setNews(hotNews());
    }
    const newsOption = useMemo(() => ({
        tooltip: { trigger: 'axis', confine: true, valueFormatter: (value) => `${value ?? 0} 篇` },
        grid: { left: 46, right: 16, top: 28, bottom: 28 },
        xAxis: {
            type: 'category',
            data: counts.map((item, index) => (index === 0 || item.day.slice(0, 7) !== counts[index - 1].day.slice(0, 7) ? shortDay(item.day) : String(Number(item.day.slice(8))))),
        },
        yAxis: { type: 'value', name: '篇', minInterval: 1 },
        series: [{
                type: 'line',
                data: counts.map((item) => ({ value: item.count, itemStyle: item.day === selectedDay ? { color: '#1d4ed8', borderColor: '#fff', borderWidth: 2 } : undefined })),
                smooth: false,
                showSymbol: true,
                symbolSize: 8,
                itemStyle: { color: '#2563eb' },
                lineStyle: { width: 2, color: '#2563eb' },
                areaStyle: { color: 'rgba(37, 99, 235, 0.12)' },
            }],
    }), [counts, selectedDay]);
    const boardOption = useMemo(() => ({
        tooltip: { trigger: 'axis', confine: true, valueFormatter: (value) => `${value ?? 0} 条` },
        legend: { data: ['微博', '百度'], top: 0, right: 0, itemWidth: 10, itemHeight: 10 },
        grid: { left: 46, right: 12, top: 36, bottom: 28 },
        xAxis: {
            type: 'category',
            data: boardCounts.map((item, index) => (index === 0 || item.day.slice(0, 7) !== boardCounts[index - 1].day.slice(0, 7) ? shortDay(item.day) : String(Number(item.day.slice(8))))),
        },
        yAxis: { type: 'value', name: '条', minInterval: 1 },
        series: [
            { name: '微博', type: 'bar', barMaxWidth: 16, data: boardCounts.map((item) => item.weibo), itemStyle: { color: '#2563eb' } },
            { name: '百度', type: 'bar', barMaxWidth: 16, data: boardCounts.map((item) => item.baidu), itemStyle: { color: '#0f8c82' } },
        ],
    }), [boardCounts]);
    const rankOption = useMemo(() => {
        if (!selected)
            return {};
        const points = rankSeries(selected.platform, selected.itemId);
        return {
            tooltip: {
                trigger: 'axis',
                formatter: (params) => {
                    const row = Array.isArray(params) ? params[0] : null;
                    const point = points[row?.dataIndex ?? -1];
                    if (!point)
                        return '';
                    if (point.missing)
                        return `${point.time.slice(0, 10)} 采集缺失`;
                    if (point.rank == null)
                        return `${formatStamp(point.time)} 榜单存在，该条目未上榜`;
                    return `${formatStamp(point.time)} 第 ${point.rank} 位`;
                },
            },
            grid: { left: 48, right: 16, top: 16, bottom: 48 },
            xAxis: { type: 'category', data: points.map((item) => item.missing ? item.time.slice(5, 10) : formatStamp(item.time).slice(5)), axisLabel: { rotate: 40 } },
            yAxis: { type: 'value', name: '排名', inverse: true, min: 1 },
            series: [{ type: 'line', connectNulls: false, data: points.map((item) => item.rank), itemStyle: { color: '#2563eb' } }],
        };
    }, [selected]);
    const topicEvents = selected?.topicId ? eventsForTopic(selected.topicId, news) : [];
    const linkChoices = events.filter((item) => !linkQuery || item.name.includes(linkQuery.trim()));
    const activeFollow = follows.find((item) => item.topicId === activeTopic && item.active);
    const sortedNews = [...eventNews].sort((a, b) => (reportSort === 'latest' ? b.publishedAt.localeCompare(a.publishedAt) : a.publishedAt.localeCompare(b.publishedAt)));
    const reportGroups = sortedNews.reduce((groups, item) => {
        const day = item.publishedAt.slice(0, 10);
        groups[day] = [...(groups[day] ?? []), item];
        return groups;
    }, {});
    const tree = progress ? [...progress.nodes].sort((a, b) => a.timeStart.localeCompare(b.timeStart)) : [];
    const topic = activeTopic ? topicById[activeTopic] : undefined;
    const eventTopic = currentEvent ? topicById[currentEvent.topicId] : undefined;
    const shownEvents = drilled.slice(0, eventLimit);
    const dayItems = selectedDay && activeTopic && metric === 'board' ? snapshotsOnDay(activeTopic, selectedDay) : [];
    const primaryLabel = progressBusy ? '生成中' : !progress ? '生成进展概括' : progressStale > 0 || progressNote ? '更新概括' : '';
    return (_jsxs("div", { className: "page hot-page", children: [_jsxs("header", { className: "hot-top", children: [_jsxs("div", { children: [_jsx("h1", { children: "\u70ED\u641C\u8FFD\u8E2A" }), _jsx("p", { children: "\u53D1\u73B0\u70ED\u70B9\uFF0C\u7406\u89E3\u8FDB\u5C55\uFF0C\u6301\u7EED\u5173\u6CE8" })] }), _jsxs("div", { className: "hot-actions", children: [_jsx("button", { type: "button", className: "btn-quiet", onClick: () => setKeywordOpen(true), children: "\u5173\u952E\u8BCD\u7BA1\u7406" }), _jsx("button", { type: "button", className: "btn-quiet", onClick: () => setFollowOpen(true), children: "\u6211\u7684\u5173\u6CE8" }), _jsx("button", { type: "button", className: "btn-text", onClick: () => setLeadOpen(true), children: "\u8DDF\u8FDB\u8BB0\u5F55" }), _jsxs("details", { className: "hot-menu", children: [_jsx("summary", { children: "\u6F14\u793A\u5DE5\u5177" }), _jsx("div", { className: "hot-menu-pop", children: _jsx("button", { type: "button", onClick: loadBatch, children: demoBatchLoaded() ? '下一批演示更新已载入' : '载入下一批演示更新' }) })] })] })] }), _jsxs("div", { className: "hot-status", children: [_jsx("span", { className: "hot-pill", children: "\u6A21\u62DF\u6F14\u793A" }), _jsxs("span", { children: ["\u6570\u636E\u622A\u6B62 ", DATA_AS_OF_LABEL] }), _jsx("span", { children: demoBatchLoaded() ? '已载入下一批演示更新' : '基础演示样本' }), _jsxs("details", { className: "hot-tip", children: [_jsx("summary", { children: "\u8986\u76D6\u8BF4\u660E" }), _jsx("p", { children: DEMO_COVERAGE.statement })] })] }), _jsxs("div", { className: "hot-split", children: [_jsxs("section", { className: "hot-card hot-board", children: [_jsxs("div", { className: "hot-card-head", children: [_jsx("h2", { children: "\u70ED\u641C\u699C" }), _jsx("div", { className: "seg", role: "group", "aria-label": "\u5E73\u53F0", children: ['微博', '百度'].map((item) => (_jsx("button", { type: "button", "aria-pressed": platform === item, onClick: () => { setPlatform(item); setSnapshotId(latestBoard(item)); setItemId(null); setEventId(null); }, children: item }, item))) })] }), _jsxs("div", { className: "hot-board-tools", children: [_jsxs("div", { className: "hot-rowline", children: [_jsxs("label", { children: ["\u5FEB\u7167", _jsx("select", { className: "hot-select", value: activeTime ?? '', onChange: (event) => setSnapshotId(event.target.value), children: times.map((time) => _jsx("option", { value: time, children: formatStamp(time) }, time)) })] }), _jsx("button", { type: "button", className: "btn-text", onClick: () => setSnapshotId(latestBoard(platform)), children: "\u6700\u65B0\u5FEB\u7167" })] }), _jsxs("label", { className: "hot-check", children: [_jsx("input", { type: "checkbox", checked: keywordOnly, onChange: (event) => setKeywordOnly(event.target.checked) }), "\u53EA\u770B\u5173\u6CE8\u5173\u952E\u8BCD"] })] }), _jsxs("div", { className: "hot-list", ref: listRef, children: [visibleRows.length === 0 && _jsxs("div", { className: "hot-empty", children: [rows.length === 0 ? '这个时点没有快照。' : '没有匹配的关注关键词。', keywordOnly && _jsx("button", { type: "button", className: "btn-text", onClick: () => setKeywordOnly(false), children: "\u663E\u793A\u5168\u90E8" })] }), visibleRows.map((row) => {
                                        const delta = rankDelta(row);
                                        const linked = resolveEventId(row);
                                        return (_jsxs("button", { type: "button", className: row.rank <= 3 ? 'hot-hit top' : 'hot-hit', "aria-current": selected?.id === row.id ? 'true' : undefined, title: row.title, onClick: () => selectRow(row), children: [_jsx("span", { className: "hot-rank", children: row.rank }), _jsxs("span", { children: [_jsx("strong", { children: row.title }), _jsxs("small", { children: [heatText(row.heat), " \u00B7 ", _jsx("em", { className: linked ? 'hot-tag linked' : row.topicId ? 'hot-tag pick' : 'hot-tag', children: linked ? '已关联事件' : row.topicId ? '需选择事件' : '待关联' })] })] }), _jsx("span", { className: `hot-delta ${delta.kind}`, children: delta.label })] }, row.id));
                                    })] })] }), _jsxs("section", { className: "hot-card hot-progress", children: [_jsxs("div", { className: "hot-card-head", children: [_jsx("h2", { children: "\u70ED\u70B9\u8FDB\u5C55" }), _jsx("button", { type: "button", className: "btn-text", onClick: () => setRankOpen((value) => !value), "aria-expanded": rankOpen, children: rankOpen ? '收起榜位走势' : '榜位走势' })] }), !selected && _jsx("div", { className: "hot-empty", children: "\u4ECE\u5DE6\u4FA7\u9009\u62E9\u4E00\u6761\u70ED\u641C\uFF0C\u67E5\u770B\u5B83\u5BF9\u5E94\u7684\u4E8B\u4EF6\u548C\u62A5\u9053\u3002" }), selected && !resolvedEvent && selected.topicId && (_jsxs("div", { children: [_jsxs("p", { className: "hot-sub", children: ["\u300C", selected.title, "\u300D\u76EE\u524D\u53EA\u5173\u8054\u5230\u4E3B\u9898\u300C", topicName(selected.topicId), "\u300D\u3002\u8BF7\u9009\u62E9\u4E00\u4E2A\u5177\u4F53\u4E8B\u4EF6\uFF0C\u4E0D\u540C\u4E8B\u4EF6\u4E0D\u4F1A\u5408\u6210\u4E00\u6761\u8FDB\u5C55\u3002"] }), _jsx("div", { className: "hot-ops", children: topicEvents.map((item) => _jsx("button", { type: "button", className: "btn-quiet", onClick: () => chooseEvent(item.id), children: item.name }, item.id)) })] })), selected && !resolvedEvent && !selected.topicId && (_jsxs("div", { children: [_jsx("p", { className: "hot-sub", children: "\u5F53\u524D\u672A\u5173\u8054\u4E8B\u4EF6\u3002\u641C\u7D22\u5E76\u786E\u8BA4\u5DF2\u6709\u4E8B\u4EF6\u540E\u624D\u4F1A\u5E26\u5165\u62A5\u9053\u3002" }), _jsx("input", { className: "hot-input", value: linkQuery, onChange: (event) => setLinkQuery(event.target.value), placeholder: "\u641C\u7D22\u4E8B\u4EF6\u540D\u79F0", "aria-label": "\u641C\u7D22\u4E8B\u4EF6\u540D\u79F0" }), _jsx("div", { className: "hot-ops", children: linkChoices.slice(0, 8).map((item) => _jsx("button", { type: "button", className: "btn-quiet", onClick: () => confirmLink(item.id), children: item.name }, item.id)) })] })), selected && currentEvent && (_jsxs(_Fragment, { children: [eventTopic && _jsxs("p", { className: "hot-crumb", children: [_jsx("button", { type: "button", onClick: () => { setTopicId(eventTopic.id); setTopicLocked(true); }, children: categoryById[eventTopic.categoryId].name }), " \u00B7 ", eventTopic.name] }), _jsx("h3", { className: "hot-event-title", children: currentEvent.name }), _jsxs("p", { className: "hot-meta", children: [eventNews.length, " \u7BC7\u62A5\u9053 \u00B7 ", new Set(eventNews.map((item) => item.mediaId)).size, " \u5BB6\u5A92\u4F53", eventNews[0] ? ` · 报道时间 ${shortDay(eventNews[0].publishedAt.slice(0, 10))}—${shortDay(eventNews.at(-1).publishedAt.slice(0, 10))}` : ' · 当前范围内没有报道'] }), _jsxs("div", { className: "hot-sourcebox", children: [_jsxs("div", { children: ["\u539F\u59CB\u70ED\u641C ", _jsx("strong", { children: selected.title })] }), _jsxs("div", { className: "hot-faint", children: [selected.platform, " \u7B2C ", selected.rank, " \u4F4D \u00B7 \u5FEB\u7167 ", formatStamp(selected.observedAt), " \u00B7 ", materialMode === 'asof' ? '当时已发布：只看发布时间不晚于该快照的收录' : '含此快照之后的后续报道'] }), _jsxs("div", { className: "seg", role: "group", "aria-label": "\u6750\u6599\u65F6\u95F4", children: [_jsx("button", { type: "button", "aria-pressed": materialMode === 'later', onClick: () => setMaterialMode('later'), children: "\u540E\u7EED\u62A5\u9053" }), _jsx("button", { type: "button", "aria-pressed": materialMode === 'asof', onClick: () => setMaterialMode('asof'), children: "\u5F53\u65F6\u5DF2\u53D1\u5E03" })] })] }), rankOpen && rank && (_jsxs("div", { className: "hot-rankpanel", children: [_jsx(EChart, { option: rankOption }), _jsxs("p", { className: "hot-faint", children: ["\u9996\u6B21 ", formatStamp(rank.first.observedAt), " \u00B7 \u6700\u8FD1 ", formatStamp(rank.latest.observedAt), " \u00B7 \u6700\u4F73\u7B2C ", rank.best.rank, " \u4F4D\u3002", rank.spanLabel] })] })), _jsxs("div", { className: "hot-ops", children: [primaryLabel && _jsx("button", { type: "button", className: "btn-primary", disabled: progressBusy || !eventNews.length, onClick: () => void generateProgress(), children: primaryLabel }), !primaryLabel && (_jsxs("details", { className: "hot-menu", children: [_jsx("summary", { children: "\u66F4\u591A" }), _jsx("div", { className: "hot-menu-pop", children: _jsx("button", { type: "button", onClick: () => void generateProgress(), children: "\u91CD\u65B0\u751F\u6210" }) })] })), _jsx("button", { type: "button", className: "btn-quiet", onClick: () => {
                                                    const existing = currentEvent ? findLeadByEvent(currentEvent.id) : null;
                                                    if (existing?.status === 'archived') {
                                                        setArchivedAsk(existing);
                                                        return;
                                                    }
                                                    setFollowDraft(existing?.notes ?? '');
                                                    setFollowDialog(true);
                                                }, children: followedEvent ? '已跟进' : '跟进事件' }), _jsx("button", { type: "button", className: "btn-quiet", onClick: () => {
                                                    const mediaCount = new Set(eventNews.map((item) => item.mediaId)).size;
                                                    if (mediaCount < 2) {
                                                        setCompareHint('当前范围内不足两家媒体，不能编造对照材料。');
                                                        return;
                                                    }
                                                    const linked = currentEvent ? findLeadByEvent(currentEvent.id) : null;
                                                    navigate('/compete', { state: { wizard: { type: 'event', eventId: currentEvent.id, start: range.start, end: range.end, leadId: linked?.id } } });
                                                }, children: "\u5BF9\u6BD4\u5404\u5BB6\u62A5\u9053" }), aiReady === false && _jsx("span", { className: "hot-faint", children: "AI \u672A\u914D\u7F6E\uFF0C\u62A5\u9053\u4ECD\u53EF\u9605\u8BFB" })] }), compareHint && _jsx("p", { className: "hot-banner", children: compareHint }), followNotice && _jsxs("p", { className: "hot-banner", children: [followNotice.text, " ", _jsx("button", { type: "button", className: "btn-text", onClick: () => navigate(`/leads?lead=${followNotice.id}`), children: "\u67E5\u770B\u7EBF\u7D22" })] }), _jsxs("div", { className: "hot-tabs", role: "tablist", children: [_jsx("button", { type: "button", role: "tab", "aria-selected": progressMode === 'summary', onClick: () => setProgressMode('summary'), children: "AI\u6982\u62EC" }), _jsx("button", { type: "button", role: "tab", "aria-selected": progressMode === 'reports', onClick: () => setProgressMode('reports'), children: "\u5168\u90E8\u62A5\u9053" })] }), progressMode === 'summary' && (_jsxs("div", { role: "tabpanel", children: [progressNote && _jsx("p", { className: "hot-banner", children: progressNote }), progressBusy && _jsxs(_Fragment, { children: [_jsx("p", { className: "hot-sub", children: "\u6B63\u5728\u8BFB\u53D6\u5F53\u524D\u4E8B\u4EF6\u7684\u62A5\u9053\u5E76\u6574\u7406\u8FDB\u5C55\u3002" }), _jsx("div", { className: "hot-skeleton" }), _jsx("div", { className: "hot-skeleton" })] }), progressError && _jsxs("p", { className: "hot-banner", children: [progressError, " ", _jsx("button", { type: "button", className: "btn-text", onClick: () => void generateProgress(), children: "\u91CD\u8BD5" }), _jsx("button", { type: "button", className: "btn-text", onClick: () => setProgressMode('reports'), children: "\u67E5\u770B\u5168\u90E8\u62A5\u9053" })] }), !progress && !progressBusy && _jsxs("div", { className: "hot-empty", children: ["\u8FD8\u6CA1\u6709\u8FD9\u6B21\u6750\u6599\u7684\u6982\u62EC\u3002\u5F53\u524D\u53EF\u5206\u6790 ", eventNews.length, " \u7BC7\uFF0C\u70B9\u51FB\u751F\u6210\u540E\u624D\u4F1A\u8BF7\u6C42\u6A21\u578B\u3002"] }), progress && (_jsxs("div", { className: "hot-tree", children: [_jsxs("div", { className: "hot-rowline", children: [_jsxs("span", { className: "hot-faint", children: ["\u5B9E\u9645\u5206\u6790 ", progress.analyzedCount, " \u7BC7 \u00B7 \u6A21\u62DF\u6750\u6599\u53EA\u4F5C\u6F14\u793A\u6837\u672C"] }), _jsx("button", { type: "button", className: "btn-text", onClick: () => setOpenNodes(openNodes.length === tree.length ? [] : tree.map((node) => node.nodeId)), children: openNodes.length === tree.length ? '收起全部来源' : '展开全部来源' })] }), tree.map((node, index) => {
                                                        const kind = nodeKind(node.nodeType);
                                                        const day = node.timeStart.slice(0, 10);
                                                        const previous = tree[index - 1]?.timeStart.slice(0, 10);
                                                        const sources = eventNews.filter((item) => node.articleIds.includes(item.id));
                                                        const open = openNodes.includes(node.nodeId);
                                                        return (_jsxs("div", { children: [day !== previous && _jsx("div", { className: "hot-day", children: shortDay(day) }), _jsxs("article", { className: `hot-node ${kind.className}`, children: [_jsxs("header", { children: [_jsxs("span", { className: "hot-faint", children: [node.timeBasis === 'event' ? '事件时间' : '报道时间', " ", node.timeStart === node.timeEnd ? node.timeStart.slice(11, 16) : `${node.timeStart.slice(11, 16)}–${node.timeEnd.slice(11, 16)}`] }), _jsx("span", { className: `hot-tag ${kind.className}`, children: kind.label })] }), _jsx("h4", { children: node.title }), _jsx("p", { className: "summary", children: node.summary }), _jsxs("div", { className: "hot-rowline", children: [_jsxs("span", { className: "hot-faint", children: [sources.length, " \u7BC7\u62A5\u9053 \u00B7 ", new Set(sources.map((item) => item.mediaId)).size, " \u5BB6\u5A92\u4F53"] }), _jsx("button", { type: "button", className: "btn-text", "aria-expanded": open, onClick: () => setOpenNodes((list) => open ? list.filter((id) => id !== node.nodeId) : [...list, node.nodeId]), children: open ? '收起来源' : '展开来源' })] }), open && (_jsxs("div", { className: "hot-leaves", children: [sources.map((item) => {
                                                                                    const evidenceKey = `${node.nodeId}:${item.id}`;
                                                                                    const quotes = node.evidence.filter((quote) => quote.articleId === item.id);
                                                                                    return (_jsxs("article", { className: "hot-leaf", children: [_jsxs("div", { className: "hot-faint", children: [item.mediaName, " \u00B7 ", formatStamp(item.publishedAt), " \u00B7 ", item.nature === 'real' ? '真实' : '模拟'] }), _jsx("h5", { children: displayTitle(item.title) }), _jsxs("div", { className: "hot-ops", children: [_jsx("button", { type: "button", className: "btn-text", onClick: () => setDrawerItems([item]), children: "\u67E5\u770B\u5168\u6587" }), quotes.length > 0 && _jsx("button", { type: "button", className: "btn-text", "aria-expanded": evidenceIds.includes(evidenceKey), onClick: () => setEvidenceIds((list) => list.includes(evidenceKey) ? list.filter((id) => id !== evidenceKey) : [...list, evidenceKey]), children: "\u67E5\u770B\u4F9D\u636E" })] }), evidenceIds.includes(evidenceKey) && quotes.map((quote) => _jsx("p", { className: "hot-quote", children: quote.quote }, quote.quote))] }, item.id));
                                                                                }), sources.length === 0 && _jsx("p", { className: "hot-faint", children: "\u8FD9\u6279\u6750\u6599\u91CC\u6CA1\u6709\u5BF9\u4E0A\u8BE5\u8282\u70B9\u5F15\u7528\u7684\u62A5\u9053\u3002" })] }))] })] }, node.nodeId));
                                                    })] }))] })), progressMode === 'reports' && (_jsxs("div", { role: "tabpanel", children: [_jsx("div", { className: "hot-rowline", children: _jsxs("div", { className: "seg", children: [_jsx("button", { type: "button", "aria-pressed": reportSort === 'latest', onClick: () => setReportSort('latest'), children: "\u6700\u65B0\u4F18\u5148" }), _jsx("button", { type: "button", "aria-pressed": reportSort === 'earliest', onClick: () => setReportSort('earliest'), children: "\u6700\u65E9\u4F18\u5148" })] }) }), _jsxs("div", { className: "hot-report-list", children: [Object.entries(reportGroups).map(([day, items]) => (_jsxs("section", { children: [_jsx("div", { className: "hot-day", children: shortDay(day) }), items.map((item) => (_jsxs("article", { className: "hot-report", children: [_jsx("h5", { children: displayTitle(item.title) }), _jsxs("div", { className: "hot-faint", children: [item.mediaName, " \u00B7 ", formatStamp(item.publishedAt), " \u00B7 ", item.nature === 'real' ? '真实' : '模拟'] }), _jsx("p", { children: item.summary }), _jsx("button", { type: "button", className: "btn-text", onClick: () => setDrawerItems([item]), children: "\u67E5\u770B\u5168\u6587" })] }, item.id)))] }, day))), sortedNews.length === 0 && _jsx("div", { className: "hot-empty", children: "\u8FD9\u4E2A\u65F6\u95F4\u8303\u56F4\u5185\u6CA1\u6709\u62A5\u9053\u3002" })] })] }))] }))] })] }), _jsxs("section", { className: "hot-card hot-trend", children: [_jsxs("div", { className: "hot-card-head", children: [_jsxs("div", { children: [_jsx("h2", { children: "\u5173\u952E\u8BCD\u8D8B\u52BF" }), _jsx("p", { className: "hot-sub", children: topic ? `${topic.name} · ${topicLocked ? '已锁定' : '关联自当前热点'}` : '当前热点没有主题，请选择一个主题。' })] }), _jsxs("div", { className: "hot-ops", children: [activeTopic && _jsx("button", { type: "button", className: "btn-quiet", onClick: () => (activeFollow ? unfollowTopic(activeTopic) : followTopic(activeTopic)), children: activeFollow ? '取消关注' : '关注主题' }), _jsx("button", { type: "button", className: "btn-text", onClick: () => setTopicLocked((value) => !value), children: topicLocked ? '解锁主题' : '锁定主题' })] })] }), _jsxs("div", { className: "hot-control", children: [_jsxs("label", { children: ["\u4E3B\u9898", _jsxs("select", { className: "hot-select", value: activeTopic ?? '', onChange: (event) => { setTopicId(event.target.value || null); setTopicLocked(true); }, children: [_jsx("option", { value: "", children: "\u9009\u62E9\u4E3B\u9898" }), allTopics().map((item) => _jsx("option", { value: item.id, children: item.name }, item.id))] })] }), _jsxs("div", { className: "seg", role: "group", "aria-label": "\u6307\u6807", children: [_jsx("button", { type: "button", "aria-pressed": metric === 'news', onClick: () => setMetric('news'), children: "\u76F8\u5173\u65B0\u95FB\u6570" }), _jsx("button", { type: "button", "aria-pressed": metric === 'board', onClick: () => setMetric('board'), children: "\u70ED\u699C\u8868\u73B0" })] }), _jsx("div", { className: "seg", role: "group", "aria-label": "\u65F6\u95F4\u8303\u56F4", children: ['7d', '14d', 'custom'].map((item) => (_jsx("button", { type: "button", "aria-pressed": preset === item, onClick: () => { setPreset(item); setSelectedDay(null); }, children: presetLabel(item) }, item))) }), preset === 'custom' && (_jsxs(_Fragment, { children: [_jsx("input", { className: "hot-input", type: "date", "aria-label": "\u5F00\u59CB\u65E5\u671F", min: DATA_START, max: DATA_END, value: customStart, onChange: (event) => { setCustomStart(event.target.value); setSelectedDay(null); } }), _jsx("input", { className: "hot-input", type: "date", "aria-label": "\u7ED3\u675F\u65E5\u671F", min: DATA_START, max: DATA_END, value: customEnd, onChange: (event) => { setCustomEnd(event.target.value); setSelectedDay(null); } })] })), metric === 'news' && (_jsxs("label", { children: ["\u5A92\u4F53", _jsxs("select", { className: "hot-select", value: mediaId, onChange: (event) => setMediaId(event.target.value), children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u5A92\u4F53" }), MEDIA.map((item) => _jsx("option", { value: item.id, children: item.name }, item.id))] })] }))] }), activeTopic && metric === 'news' && _jsx("div", { className: "hot-chart", children: _jsx(EChart, { option: newsOption, onClick: (params) => { const day = counts[params.dataIndex ?? -1]?.day; if (day)
                                setSelectedDay(day); } }) }), activeTopic && metric === 'board' && _jsx("div", { className: "hot-chart", children: _jsx(EChart, { option: boardOption, onClick: (params) => { const day = boardCounts[params.dataIndex ?? -1]?.day; if (day)
                                setSelectedDay(day); } }) }), activeTopic && _jsxs("p", { className: "hot-note", children: [metric === 'news' ? '按已收录报道统计，单位为篇。' : '按平台每日去重热搜条目统计，单位为条。', " ", _jsxs("details", { className: "hot-tip", children: [_jsx("summary", { children: "\u7EDF\u8BA1\u53E3\u5F84" }), _jsxs("p", { children: [DEMO_COVERAGE.statement, " \u540C\u4E00\u62A5\u9053\u53EA\u8BA1\u4E00\u6B21\u3002\u5FAE\u535A\u548C\u767E\u5EA6\u70ED\u5EA6\u4E0D\u76F8\u52A0\u3002"] })] })] }), explainWindow && (_jsxs("div", { className: "hot-selectbar", children: [_jsxs("div", { children: [_jsxs("strong", { children: ["\u5DF2\u9009 ", explainWindow.start === explainWindow.end ? shortDay(explainWindow.start) : `${shortDay(explainWindow.start)}—${shortDay(explainWindow.end)}`] }), _jsx("div", { className: "hot-faint", children: metric === 'board' ? '热榜条目按当天去重' : '报道按发布日期计入' })] }), _jsxs("div", { className: "hot-ops", children: [selectedDay && _jsx("button", { type: "button", className: "btn-text", onClick: () => setSelectedDay(null), children: "\u6E05\u9664\u9009\u62E9" }), metric === 'news' && _jsx("button", { type: "button", className: "btn-primary", disabled: !explainStats || explainBusy, onClick: () => void generateExplain(), children: explainBusy ? '解释中' : explainStats?.mode === 'composition' ? '解释本期报道构成' : '解释这一波变化' })] })] })), metric === 'news' && explainStats && (_jsxs("div", { className: "hot-explain", children: [_jsx("h3", { children: explainStats.mode === 'composition' ? '本期报道构成' : '这一阶段发生了什么变化' }), _jsxs("div", { className: "hot-stats", children: [_jsxs("span", { className: "hot-stat", children: ["\u672C\u671F ", explainStats.current.count, " \u7BC7"] }), explainStats.previousCovered ? _jsxs("span", { className: "hot-stat", children: ["\u5BF9\u7167 ", explainStats.previous?.count ?? 0, " \u7BC7"] }) : _jsx("span", { className: "hot-stat", children: "\u5BF9\u7167\u671F\u8D85\u51FA\u8986\u76D6" }), explainStats.previousCovered && _jsx("span", { className: "hot-stat", children: explainStats.previous?.count === 0 ? `净增 ${explainStats.delta} 篇` : `增减 ${explainStats.delta} 篇` })] }), explainError && _jsxs("p", { className: "hot-banner", children: [explainError, " ", _jsx("button", { type: "button", className: "btn-text", onClick: () => void generateExplain(), children: "\u91CD\u8BD5" })] }), explain && (_jsxs(_Fragment, { children: [_jsx("p", { children: explain.overview }), explain.eventFindings.map((item) => (_jsxs("article", { className: "hot-finding", children: [_jsx("p", { children: item.text }), _jsx("div", { className: "hot-ops", children: item.articleIds.map((id, index) => _jsx("button", { type: "button", className: "hot-tag", onClick: () => { const found = news.find((row) => row.id === id); if (found)
                                                        setDrawerItems([found]); }, children: index + 1 }, id)) })] }, item.eventId))), explain.limitations.length > 0 && _jsxs("details", { className: "hot-tip", children: [_jsx("summary", { children: "\u6750\u6599\u9650\u5236" }), _jsx("p", { children: explain.limitations.join(' ') })] })] }))] })), dayItems.length > 0 && (_jsxs("div", { className: "hot-events", children: [_jsx("h3", { children: "\u5F53\u5929\u70ED\u641C\u6761\u76EE" }), dayItems.map((item) => _jsx("article", { className: "hot-event", children: _jsxs("div", { children: [_jsx("h4", { children: item.title }), _jsxs("p", { className: "hot-faint", children: [item.platform, " \u00B7 \u7B2C ", item.rank, " \u4F4D \u00B7 ", formatStamp(item.observedAt)] })] }) }, item.id))] })), _jsxs("div", { className: "hot-events", children: [_jsxs("div", { className: "hot-rowline", children: [_jsx("h3", { children: "\u76F8\u5173\u4E8B\u4EF6" }), _jsxs("span", { className: "hot-faint", children: [drilled.length, " \u4E2A\u4E8B\u4EF6"] })] }), shownEvents.map((group) => (_jsxs("article", { className: "hot-event", children: [_jsxs("div", { children: [_jsx("h4", { children: group.name }), _jsxs("p", { className: "hot-faint", children: [group.count, " \u7BC7 \u00B7 ", group.media, " \u5BB6\u5A92\u4F53 \u00B7 ", group.latest ? formatStamp(group.latest) : '无时间'] })] }), _jsxs("div", { className: "ops", children: [_jsx("button", { type: "button", className: "btn-quiet", onClick: () => setDrawerItems(group.items), children: "\u67E5\u770B\u62A5\u9053" }), group.eventId !== 'pending' && _jsx("button", { type: "button", className: "btn-text", onClick: () => chooseEvent(group.eventId), children: "\u67E5\u770B\u8FDB\u5C55" })] })] }, group.eventId))), drilled.length > eventLimit && _jsx("button", { type: "button", className: "btn-text", onClick: () => setEventLimit((value) => value + 6), children: "\u5C55\u5F00\u66F4\u591A" }), drilled.length === 0 && _jsx("p", { className: "hot-faint", children: "\u8FD9\u4E2A\u8303\u56F4\u5185\u6CA1\u6709\u5173\u8054\u62A5\u9053\u3002" })] })] }), keywordOpen && (_jsx("div", { className: "hot-dialog-mask", onClick: () => setKeywordOpen(false), children: _jsxs("section", { className: "hot-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "kw-title", onClick: (event) => event.stopPropagation(), children: [_jsx("h2", { id: "kw-title", children: "\u5173\u952E\u8BCD\u7BA1\u7406" }), _jsx("div", { className: "hot-ops", children: keywords.map((word) => _jsxs("span", { className: "hot-tag", children: [word, " ", _jsx("button", { type: "button", className: "btn-text", onClick: () => { const next = keywords.filter((item) => item !== word); saveKeywords(next); setKeywords(next); }, children: "\u79FB\u9664" })] }, word)) }), _jsx("input", { className: "hot-input", value: keywordDraft, onChange: (event) => setKeywordDraft(event.target.value), placeholder: "\u65B0\u589E\u5173\u952E\u8BCD", "aria-label": "\u65B0\u589E\u5173\u952E\u8BCD" }), _jsxs("div", { className: "ops", children: [_jsx("button", { type: "button", className: "btn-primary", onClick: () => { const word = keywordDraft.trim(); if (!word || keywords.includes(word))
                                        return; const next = [...keywords, word]; saveKeywords(next); setKeywords(next); setKeywordDraft(''); }, children: "\u6DFB\u52A0" }), _jsx("button", { type: "button", className: "btn-quiet", onClick: () => setKeywordOpen(false), children: "\u5173\u95ED" })] })] }) })), followOpen && (_jsx("div", { className: "hot-dialog-mask", onClick: () => setFollowOpen(false), children: _jsxs("section", { className: "hot-dialog wide", role: "dialog", "aria-modal": "true", "aria-labelledby": "follow-title", onClick: (event) => event.stopPropagation(), children: [_jsx("h2", { id: "follow-title", children: "\u6211\u7684\u5173\u6CE8" }), _jsxs("div", { className: "hot-follow", children: [follows.filter((item) => item.active).map((item) => {
                                    const delta = followDelta(item, news);
                                    return (_jsxs("article", { children: [_jsx("strong", { children: topicName(item.topicId) }), _jsxs("p", { className: "hot-faint", children: ["\u65B0\u589E\u4E8B\u4EF6 ", delta.events, " \u00B7 \u65B0\u589E\u62A5\u9053 ", delta.reports, " \u00B7 ", delta.latest.slice(0, 16).replace('T', ' ')] }), _jsxs("div", { className: "hot-ops", children: [_jsx("button", { type: "button", className: "btn-text", onClick: () => { setTopicId(item.topicId); setTopicLocked(true); setFollowOpen(false); }, children: "\u67E5\u770B\u8D8B\u52BF" }), _jsx("button", { type: "button", className: "btn-text", onClick: () => markSeen(item.topicId), children: "\u6807\u8BB0\u5DF2\u770B" }), _jsx("button", { type: "button", className: "btn-text", onClick: () => unfollowTopic(item.topicId), children: "\u53D6\u6D88\u5173\u6CE8" })] })] }, item.topicId));
                                }), !follows.some((item) => item.active) && _jsx("p", { children: "\u8FD8\u6CA1\u6709\u5173\u6CE8\u4E3B\u9898\u3002" })] }), _jsx("div", { className: "ops", children: _jsx("button", { type: "button", className: "btn-quiet", onClick: () => setFollowOpen(false), children: "\u5173\u95ED" }) })] }) })), leadOpen && (_jsx("div", { className: "hot-dialog-mask", onClick: () => setLeadOpen(false), children: _jsxs("section", { className: "hot-dialog wide", role: "dialog", "aria-modal": "true", "aria-labelledby": "lead-title", onClick: (event) => event.stopPropagation(), children: [_jsx("h2", { id: "lead-title", children: "\u8DDF\u8FDB\u8BB0\u5F55" }), _jsxs("div", { className: "hot-follow", children: [leads.map((item) => {
                                    const linked = findLeadByEvent(item.eventId);
                                    return (_jsxs("article", { children: [_jsx("strong", { children: linked?.title ?? item.eventName }), _jsxs("p", { className: "hot-faint", children: ["\u6750\u6599 ", item.materialIds.length, " \u7BC7 \u00B7 ", linked ? (linked.status === 'pending' ? '待处理' : linked.status === 'active' ? '跟进中' : '已归档') : '早期记录'] }), _jsx("button", { type: "button", className: "btn-text", onClick: () => navigate(`/leads?lead=${linked?.id ?? ''}`), children: "\u5728\u7EBF\u7D22\u7BA1\u7406\u4E2D\u6253\u5F00" }), _jsx("button", { type: "button", className: "btn-text", onClick: () => { chooseEvent(item.eventId); setLeadOpen(false); }, children: "\u67E5\u770B\u8FDB\u5C55" })] }, item.eventId));
                                }), !leads.length && _jsx("p", { children: "\u8FD8\u6CA1\u6709\u8DDF\u8FDB\u4E8B\u4EF6\u3002\u603B\u89C8\u3001\u7ADE\u54C1\u548C\u70ED\u641C\u5199\u5165\u540C\u4E00\u6761\u8BB0\u5F55\u3002" })] }), _jsx("div", { className: "ops", children: _jsx("button", { type: "button", className: "btn-quiet", onClick: () => setLeadOpen(false), children: "\u5173\u95ED" }) })] }) })), followDialog && currentEvent && (_jsx("div", { className: "hot-dialog-mask", onClick: () => setFollowDialog(false), children: _jsxs("section", { className: "hot-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "track-title", onClick: (event) => event.stopPropagation(), children: [_jsx("h2", { id: "track-title", children: followedEvent ? '编辑跟进' : '跟进事件' }), _jsx("p", { children: currentEvent.name }), _jsx("textarea", { value: followDraft, "aria-label": "\u8DDF\u8FDB\u5907\u6CE8", onChange: (event) => setFollowDraft(event.target.value), placeholder: "\u8865\u5145\u4F60\u8981\u8BB0\u4F4F\u7684\u80CC\u666F" }), _jsxs("div", { className: "ops", children: [_jsx("button", { type: "button", className: "btn-quiet", onClick: () => setFollowDialog(false), children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "btn-primary", onClick: saveFollow, children: "\u786E\u8BA4\u8DDF\u8FDB" })] })] }) })), archivedAsk && (_jsx("div", { className: "hot-dialog-mask", onClick: () => setArchivedAsk(null), children: _jsxs("section", { className: "hot-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "archived-title", onClick: (event) => event.stopPropagation(), children: [_jsx("h2", { id: "archived-title", children: "\u8FD9\u6761\u7EBF\u7D22\u5DF2\u5F52\u6863" }), _jsx("p", { children: "\u4E0D\u4F1A\u81EA\u52A8\u6062\u590D\u3002\u53EF\u4EE5\u67E5\u770B\u539F\u8BB0\u5F55\uFF0C\u6216\u7531\u4F60\u786E\u8BA4\u540E\u518D\u6062\u590D\u4E3A\u5F85\u5904\u7406\u3002" }), _jsxs("div", { className: "ops", children: [_jsx("button", { type: "button", className: "btn-primary", onClick: () => navigate(`/leads?lead=${archivedAsk.id}`), children: "\u67E5\u770B\u7EBF\u7D22" }), _jsx("button", { type: "button", className: "btn-quiet", onClick: () => { restoreLead(archivedAsk.id); setLeads(loadEventFollows()); setArchivedAsk(null); setFollowNotice({ id: archivedAsk.id, text: '已恢复为待处理。' }); }, children: "\u6062\u590D\u8DDF\u8FDB" }), _jsx("button", { type: "button", className: "btn-text", onClick: () => setArchivedAsk(null), children: "\u53D6\u6D88" })] })] }) })), _jsx(NewsDrawer, { entry: "hot", model: drawerItems ? { kind: 'news', tags: [{ id: 'hot', label: '热搜追踪' }], items: drawerItems, note: '模拟来源在站内阅读全文。' } : null, followedIds: articleFollows, onClose: () => setDrawerItems(null), onToggleFollow: (id) => {
                    const next = new Set(articleFollows);
                    if (next.has(id))
                        next.delete(id);
                    else
                        next.add(id);
                    saveFollows(next);
                    setArticleFollows(next);
                } })] }));
}

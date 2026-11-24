import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { ActivityHeatmap } from '../components/overview/ActivityHeatmap.tsx';
import { AlertPanel } from '../components/overview/AlertPanel.tsx';
import { ChartCard } from '../components/overview/ChartCard.tsx';
import { DailyNewsChart } from '../components/overview/DailyNewsChart.tsx';
import { FilterBar } from '../components/overview/FilterBar.tsx';
import { HorizontalBarChart } from '../components/overview/HorizontalBarChart.tsx';
import { MetricCards } from '../components/overview/MetricCards.tsx';
import { TopicBubbleChart } from '../components/overview/TopicBubbleChart.tsx';
import { NewsDrawer } from '../components/news/NewsDrawer.tsx';
import { CATEGORY_COLORS, categoryById, topicById } from '../data/demo/index.ts';
import { DATA_AS_OF_LABEL, DATA_END, dateRangeOf, hourOf } from '../lib/dates.ts';
import { mediaColor } from '../lib/mediaColor.ts';
import { categoryCounts, dailyCounts, filterAlerts, heatmapModel, mediaCounts, newsByIds, pageMetrics, topicBubbles, } from '../lib/overviewSelectors.ts';
import { loadFollows, loadReadAlerts, saveFollows, saveReadAlerts } from '../lib/storage.ts';
const INITIAL_FILTERS = {
    preset: '7d',
    customStart: '2026-11-04',
    customEnd: DATA_END,
    selectedDay: null,
    platform: 'all',
    keyword: '',
};
function toggleId(current, id, save) {
    const next = new Set(current);
    if (next.has(id))
        next.delete(id);
    else
        next.add(id);
    save(next);
    return next;
}
export function OverviewPage() {
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const [followedIds, setFollowedIds] = useState(() => loadFollows());
    const [readIds, setReadIds] = useState(() => loadReadAlerts());
    const [drawer, setDrawer] = useState(null);
    const metrics = useMemo(() => pageMetrics(filters), [filters]);
    const trend = useMemo(() => dailyCounts(filters), [filters]);
    const bubbles = useMemo(() => topicBubbles(metrics.news), [metrics.news]);
    const categories = useMemo(() => categoryCounts(metrics.news), [metrics.news]);
    const outlets = useMemo(() => mediaCounts(metrics.news), [metrics.news]);
    const heat = useMemo(() => heatmapModel(metrics.news), [metrics.news]);
    const alerts = useMemo(() => filterAlerts(filters), [filters]);
    const range = dateRangeOf(filters);
    const heatCaption = filters.selectedDay
        ? `展示 ${filters.selectedDay} 当天 0–23 时发布的新闻数量。零值是浅灰，表示该小时没有新闻。`
        : `未选择单日：将 ${range.start} 至 ${range.end} 内每个话题在同一小时的新闻累加。零值是浅灰。`;
    function contextTags() {
        return [
            {
                id: 'date',
                label: filters.selectedDay ? `日期 ${filters.selectedDay}` : `日期 ${range.start} 至 ${range.end}`,
            },
            { id: 'platform', label: filters.platform === 'all' ? '全部发布平台' : `平台 ${filters.platform}` },
            ...(filters.keyword.trim() ? [{ id: 'keyword', label: `关键词 ${filters.keyword.trim()}` }] : []),
        ];
    }
    function selectDay(day) {
        setFilters((current) => ({ ...current, selectedDay: current.selectedDay === day ? null : day }));
    }
    function rememberRead(alertId) {
        setReadIds((current) => {
            if (current.has(alertId))
                return current;
            const next = new Set(current);
            next.add(alertId);
            saveReadAlerts(next);
            return next;
        });
    }
    function openAlert(alert) {
        rememberRead(alert.id);
        const related = newsByIds(alert.newsIds);
        if (related.length === 0 && alert.snapshot) {
            setDrawer({
                kind: 'snapshot',
                summary: alert.summary,
                snapshot: alert.snapshot,
                tags: [
                    { id: 'kind', label: '热榜快照' },
                    { id: 'platform', label: alert.snapshot.platform },
                    { id: 'item', label: alert.snapshot.title },
                ],
            });
            return;
        }
        setDrawer({
            kind: 'news',
            note: `${alert.summary}列表是这条提醒引用的报道。`,
            items: related,
            tags: [
                { id: 'topic', label: `话题 ${alert.topicName}` },
                { id: 'day', label: alert.triggerAt.slice(0, 10) },
                ...(alert.snapshot ? [{ id: 'board', label: `${alert.snapshot.platform}第 ${alert.snapshot.rank} 位` }] : []),
            ],
        });
    }
    return (_jsxs("div", { className: "page", "data-testid": "overview-page", children: [_jsxs("header", { className: "page-head", children: [_jsxs("div", { children: [_jsxs("div", { className: "title-row", children: [_jsx("h1", { children: "\u7EBF\u7D22\u603B\u89C8" }), _jsx("span", { className: "demo-pill", children: "\u6A21\u62DF\u6F14\u793A\u6570\u636E" })] }), _jsx("p", { children: "\u4ECE\u70ED\u70B9\u53D8\u5316\u4E2D\u53D1\u73B0\u503C\u5F97\u8DDF\u8FDB\u7684\u65B0\u95FB" })] }), _jsxs("p", { className: "cutoff", children: ["\u6F14\u793A\u6570\u636E\u622A\u6B62\u65F6\u95F4", _jsx("strong", { children: DATA_AS_OF_LABEL })] })] }), _jsx(FilterBar, { filters: filters, onChange: setFilters }), _jsx(MetricCards, { values: {
                    news: metrics.newsCount,
                    topics: metrics.topicCount,
                    media: metrics.mediaCount,
                    hot: metrics.hotCount,
                } }), _jsxs("div", { className: "overview-grid", children: [_jsx(ChartCard, { title: "\u6BCF\u65E5\u65B0\u95FB\u6570\u91CF", caption: "\u6309\u53D1\u5E03\u65F6\u95F4\u7EDF\u8BA1\u5F53\u5929\u5168\u90E8\u65B0\u95FB\u3002\u70B9\u51FB\u67D0\u65E5\u53EA\u770B\u8FD9\u4E00\u5929\uFF0C\u6298\u7EBF\u4ECD\u4FDD\u7559\u5F53\u524D\u65E5\u671F\u8303\u56F4\uFF1B\u518D\u70B9\u4E00\u6B21\u6216\u5173\u95ED\u65E5\u671F\u6807\u7B7E\u53EF\u53D6\u6D88\u3002", testId: "chart-daily", empty: trend.every((point) => point.count === 0), children: _jsx(DailyNewsChart, { points: trend, selectedDay: filters.selectedDay, onSelectDay: selectDay }) }), _jsx(ChartCard, { title: "\u5173\u6CE8\u8BDD\u9898", caption: "\u4E00\u4E2A\u6C14\u6CE1\u662F\u4E00\u4E2A\u8BDD\u9898\u3002\u9762\u79EF\u8868\u793A\u5173\u8054\u65B0\u95FB\u6570\uFF0C\u989C\u8272\u8868\u793A\u5206\u7C7B\uFF0C\u4F4D\u7F6E\u53EA\u7528\u4E8E\u6392\u5E03\uFF0C\u4E0D\u4EE3\u8868\u65F6\u95F4\u6216\u5176\u4ED6\u6570\u503C\u3002", testId: "chart-bubble", empty: bubbles.length === 0, children: _jsx(TopicBubbleChart, { items: bubbles, totalTopics: metrics.topicCount, onSelect: (topicId) => setDrawer({
                                kind: 'news',
                                tags: [...contextTags(), { id: 'topic', label: `话题 ${topicById[topicId].name}` }],
                                items: metrics.news.filter((item) => item.topicId === topicId),
                            }) }) })] }), _jsxs("div", { className: "overview-grid", children: [_jsx(ChartCard, { title: "\u8BDD\u9898\u5206\u7C7B\u5206\u5E03", caption: "\u6309\u65B0\u95FB\u7684\u4E3B\u8981\u5206\u7C7B\u8BA1\u6570\uFF0C\u4E00\u7BC7\u65B0\u95FB\u53EA\u8BA1\u5165\u4E00\u4E2A\u5206\u7C7B\u3002\u70B9\u51FB\u6253\u5F00\u65B0\u95FB\uFF0C\u4E0D\u6539\u53D8\u5168\u9875\u7EDF\u8BA1\u6761\u4EF6\u3002", testId: "chart-category", empty: categories.length === 0, children: _jsx(HorizontalBarChart, { items: categories, color: (item) => CATEGORY_COLORS[item.id] ?? '#2563eb', onSelect: (categoryId) => setDrawer({
                                kind: 'news',
                                tags: [...contextTags(), { id: 'category', label: `分类 ${categoryById[categoryId].name}` }],
                                items: metrics.news.filter((item) => item.categoryId === categoryId),
                            }) }) }), _jsx(ChartCard, { title: "\u6765\u6E90\u673A\u6784\u5206\u5E03", caption: "\u6309\u5A92\u4F53\u673A\u6784\u8BA1\u6570\uFF0C\u680F\u76EE\u4E0D\u5355\u72EC\u6210\u67F1\u3002\u70B9\u51FB\u6253\u5F00\u8BE5\u673A\u6784\u7684\u65B0\u95FB\uFF0C\u4E0D\u6539\u53D8\u5168\u9875\u7EDF\u8BA1\u6761\u4EF6\u3002", testId: "chart-media", empty: outlets.length === 0, children: _jsx(HorizontalBarChart, { items: outlets, color: (item) => mediaColor(item.id), onSelect: (mediaId) => {
                                const outlet = outlets.find((item) => item.id === mediaId);
                                setDrawer({
                                    kind: 'news',
                                    tags: [...contextTags(), { id: 'media', label: `机构 ${outlet?.name ?? mediaId}` }],
                                    items: metrics.news.filter((item) => item.mediaId === mediaId),
                                });
                            } }) })] }), _jsxs("div", { className: "overview-grid overview-band", children: [_jsx(ChartCard, { title: "24\u5C0F\u65F6\u65B0\u95FB\u6D3B\u8DC3\u5EA6", caption: heatCaption, testId: "chart-heat", empty: heat.topics.length === 0, children: _jsx(ActivityHeatmap, { model: heat, onSelect: (topicId, hour) => setDrawer({
                                kind: 'news',
                                tags: [
                                    ...contextTags(),
                                    { id: 'topic', label: `话题 ${topicById[topicId].name}` },
                                    { id: 'hour', label: `${String(hour).padStart(2, '0')}:00–${String(hour).padStart(2, '0')}:59` },
                                ],
                                items: metrics.news.filter((item) => item.topicId === topicId && hourOf(item.publishedAt) === hour),
                            }) }) }), _jsx(ChartCard, { title: "\u52A8\u6001\u63D0\u9192", caption: "\u6839\u636E\u56FA\u5B9A\u70ED\u699C\u5FEB\u7167\u3001\u9884\u8BBE\u5173\u6CE8\u5173\u952E\u8BCD\u548C\u62A5\u9053\u8BB0\u5F55\u751F\u6210\u3002\u70B9\u51FB\u53EF\u6838\u5BF9\u65B0\u95FB\u6216\u5FEB\u7167\uFF0C\u4E0D\u8C03\u7528\u81EA\u52A8\u6392\u5E8F\u3002", testId: "chart-alerts", className: "panel-scroll", children: _jsx(AlertPanel, { alerts: alerts, readIds: readIds, onOpen: openAlert, onToggleRead: (alertId) => setReadIds((current) => toggleId(current, alertId, saveReadAlerts)) }) })] }), _jsx(NewsDrawer, { model: drawer, followedIds: followedIds, onClose: () => setDrawer(null), onToggleFollow: (newsId) => setFollowedIds((current) => toggleId(current, newsId, saveFollows)) })] }));
}

import { CATEGORIES, HOT_SNAPSHOTS, MEDIA, NEWS, categoryById, topicById } from '../data/demo/index.ts';
import { OVERVIEW_ALERTS } from './alerts.ts';
import { dateRangeOf, dayOf, eachDate, hourOf } from './dates.ts';
function includesKeyword(item, keyword) {
    const topicName = topicById[item.topicId]?.name ?? '';
    return `${item.title}\n${item.summary}\n${topicName}\n${item.eventName}\n${item.mediaName}\n${item.columnName}`.includes(keyword);
}
export function filterNews(filters, mode = 'page') {
    const { start, end } = dateRangeOf(filters);
    const keyword = filters.keyword.trim();
    return NEWS.filter((item) => {
        const day = dayOf(item.publishedAt);
        if (day < start || day > end)
            return false;
        if (mode === 'page' && filters.selectedDay && day !== filters.selectedDay)
            return false;
        if (filters.platform !== 'all' && item.platform !== filters.platform)
            return false;
        if (keyword && !includesKeyword(item, keyword))
            return false;
        return true;
    });
}
function hotMatchesKeyword(snapshot, keyword) {
    const topicName = snapshot.topicId ? topicById[snapshot.topicId].name : '';
    return snapshot.title.includes(keyword) || topicName.includes(keyword);
}
function hotMatchesPlatform(snapshot, platform, pageNews) {
    if (platform === 'all')
        return true;
    if (snapshot.platform === platform)
        return true;
    if (platform === '微博' || platform === '百度')
        return false;
    if (!snapshot.topicId)
        return false;
    return pageNews.some((item) => item.topicId === snapshot.topicId);
}
export function countHotItems(filters) {
    const { start, end } = dateRangeOf(filters);
    const keyword = filters.keyword.trim();
    const pageNews = filterNews(filters, 'page');
    const seen = new Set();
    for (const snapshot of HOT_SNAPSHOTS) {
        const day = dayOf(snapshot.observedAt);
        if (day < start || day > end)
            continue;
        if (filters.selectedDay && day !== filters.selectedDay)
            continue;
        if (keyword && !hotMatchesKeyword(snapshot, keyword))
            continue;
        if (!hotMatchesPlatform(snapshot, filters.platform, pageNews))
            continue;
        seen.add(`${snapshot.platform}:${snapshot.itemId}`);
    }
    return seen.size;
}
export function dailyCounts(filters) {
    const { start, end } = dateRangeOf(filters);
    const counts = new Map();
    for (const date of eachDate(start, end))
        counts.set(date, 0);
    for (const item of filterNews(filters, 'trend')) {
        const day = dayOf(item.publishedAt);
        counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return [...counts.entries()].map(([date, count]) => ({ date, count }));
}
export function topicBubbles(news) {
    const grouped = new Map();
    for (const item of news) {
        const list = grouped.get(item.topicId) ?? [];
        list.push(item);
        grouped.set(item.topicId, list);
    }
    const bubbles = [...grouped.entries()].map(([topicId, list]) => {
        const topic = topicById[topicId];
        const latestAt = [...list].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0].publishedAt;
        return {
            topicId,
            name: topic.name,
            categoryId: topic.categoryId,
            categoryName: categoryById[topic.categoryId].name,
            count: list.length,
            mediaCount: new Set(list.map((item) => item.mediaId)).size,
            latestAt,
        };
    });
    bubbles.sort((a, b) => b.count - a.count || a.topicId.localeCompare(b.topicId));
    return bubbles.slice(0, 12);
}
export function categoryCounts(news) {
    return CATEGORIES.map((category) => ({
        id: category.id,
        name: category.name,
        count: news.filter((item) => item.categoryId === category.id).length,
    }))
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}
export function mediaCounts(news) {
    return MEDIA.map((media) => ({
        id: media.id,
        name: media.name,
        count: news.filter((item) => item.mediaId === media.id).length,
    }))
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}
export function heatmapModel(news) {
    const topicCounts = new Map();
    for (const item of news)
        topicCounts.set(item.topicId, (topicCounts.get(item.topicId) ?? 0) + 1);
    const topics = [...topicCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 8)
        .map(([id]) => ({ id, name: topicById[id].name }));
    const matrix = topics.map((topic) => {
        const row = Array.from({ length: 24 }, () => 0);
        for (const item of news) {
            if (item.topicId !== topic.id)
                continue;
            row[hourOf(item.publishedAt)] += 1;
        }
        return row;
    });
    const max = matrix.reduce((current, row) => Math.max(current, ...row), 0);
    return { topics, matrix, max };
}
export function pageMetrics(filters) {
    const news = filterNews(filters, 'page');
    return {
        news,
        newsCount: news.length,
        topicCount: new Set(news.map((item) => item.topicId)).size,
        mediaCount: new Set(news.map((item) => item.mediaId)).size,
        hotCount: countHotItems(filters),
    };
}
export function filterAlerts(filters) {
    const { start, end } = dateRangeOf(filters);
    const keyword = filters.keyword.trim();
    const pageIds = new Set(filterNews(filters, 'page').map((item) => item.id));
    return OVERVIEW_ALERTS.filter((alert) => {
        const day = dayOf(alert.triggerAt);
        if (day < start || day > end)
            return false;
        if (filters.selectedDay && day !== filters.selectedDay)
            return false;
        if (keyword) {
            const haystack = `${alert.topicName}\n${alert.summary}\n${alert.snapshot?.title ?? ''}`;
            if (!haystack.includes(keyword))
                return false;
        }
        if (filters.platform !== 'all') {
            if (alert.snapshot?.platform === filters.platform)
                return true;
            return alert.newsIds.some((id) => pageIds.has(id));
        }
        return true;
    });
}
export function newsByIds(ids) {
    const idSet = new Set(ids);
    return NEWS.filter((item) => idSet.has(item.id));
}

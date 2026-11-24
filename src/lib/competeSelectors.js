import { HOT_SNAPSHOTS } from '../data/demo/hotSnapshots.ts';
import { categoryById } from '../data/demo/catalog.ts';
import { MONITOR_NEWS } from '../data/demo/monitor.ts';
import { dateRangeOf, dayOf, eachDate } from './dates.ts';
import { materialNature } from './material.ts';
const KIND_LABEL = {
    daily_count: '单日报道数',
    keyword: '关键词',
    hot_event: '热榜关联',
};
export function alertKindLabel(kind) {
    return KIND_LABEL[kind];
}
export function selectedMediaIds(filters) {
    const peers = filters.peerIds.filter((id) => id !== filters.ownMediaId);
    return [filters.ownMediaId, ...peers];
}
export function filterMonitorNews(filters, items = MONITOR_NEWS) {
    const range = dateRangeOf(filters);
    const mediaIds = new Set(selectedMediaIds(filters));
    const news = items.filter((item) => {
        const day = dayOf(item.publishedAt);
        if (day < range.start || day > range.end)
            return false;
        if (!mediaIds.has(item.mediaId))
            return false;
        if (filters.categoryId !== 'all' && item.categoryId !== filters.categoryId)
            return false;
        if (filters.nature !== 'all' && materialNature(item) !== filters.nature)
            return false;
        return true;
    });
    return { ...range, news };
}
export function hotTopicIds(start, end, snapshots = HOT_SNAPSHOTS) {
    const ids = new Set();
    for (const snapshot of snapshots) {
        const day = dayOf(snapshot.observedAt);
        if (snapshot.topicId && day >= start && day <= end)
            ids.add(snapshot.topicId);
    }
    return ids;
}
export function mediaMetrics(news, mediaIds, hotTopics) {
    return mediaIds.map((mediaId) => {
        const rows = news.filter((item) => item.mediaId === mediaId);
        return {
            mediaId,
            newsCount: rows.length,
            eventCount: new Set(rows.map((item) => item.eventId)).size,
            hotNewsCount: rows.filter((item) => hotTopics.has(item.topicId)).length,
            hasNews: rows.length > 0,
        };
    });
}
export function dailySeries(news, mediaIds, start, end) {
    const dates = eachDate(start, end);
    return dates.map((date) => ({
        date,
        counts: Object.fromEntries(mediaIds.map((mediaId) => [mediaId, news.filter((item) => item.mediaId === mediaId && dayOf(item.publishedAt) === date).length])),
    }));
}
export function categorySeries(news, mediaIds) {
    const ids = [...new Set(news.map((item) => item.categoryId))];
    return ids.map((categoryId) => ({
        categoryId,
        name: categoryById[categoryId]?.name ?? categoryId,
        counts: Object.fromEntries(mediaIds.map((mediaId) => [mediaId, news.filter((item) => item.mediaId === mediaId && item.categoryId === categoryId).length])),
    }));
}
export function sharedEvents(news, ownMediaId) {
    const groups = new Map();
    for (const item of news) {
        const list = groups.get(item.eventId) ?? [];
        list.push(item);
        groups.set(item.eventId, list);
    }
    const events = [];
    for (const [eventId, rows] of groups) {
        const mediaIds = [...new Set(rows.map((item) => item.mediaId))];
        if (mediaIds.length < 2)
            continue;
        events.push({
            eventId,
            eventName: rows[0].eventName,
            categoryId: rows[0].categoryId,
            mediaIds,
            newsCount: rows.length,
            latestAt: rows.map((item) => item.publishedAt).sort().at(-1) ?? '',
            ownRecorded: rows.some((item) => item.mediaId === ownMediaId),
            newsIds: rows.map((item) => item.id),
        });
    }
    return events.sort((a, b) => b.latestAt.localeCompare(a.latestAt) || b.newsCount - a.newsCount);
}
function snapshotForTopic(topicId, start, end) {
    return (HOT_SNAPSHOTS.find((item) => item.topicId === topicId && dayOf(item.observedAt) >= start && dayOf(item.observedAt) <= end) ??
        null);
}
export function buildCompeteAlerts(news, rules, start, end) {
    const hotTopics = hotTopicIds(start, end);
    const alerts = [];
    for (const rule of rules) {
        if (!rule.enabled)
            continue;
        const rows = news.filter((item) => item.mediaId === rule.mediaId);
        if (!rows.length && rule.kind !== 'daily_count')
            continue;
        if (rule.kind === 'daily_count') {
            for (const date of eachDate(start, end)) {
                const dayRows = rows.filter((item) => dayOf(item.publishedAt) === date);
                if (dayRows.length < rule.threshold)
                    continue;
                alerts.push({
                    id: `${rule.id}:${date}`,
                    ruleId: rule.id,
                    mediaId: rule.mediaId,
                    kind: rule.kind,
                    triggerAt: `${date}T23:59:00+08:00`,
                    summary: `${date} 已收录报道 ${dayRows.length} 条，达到阈值 ${rule.threshold} 条。`,
                    basis: `按报道 ID 去重后的当日收录数，不是该媒体当天的全部发稿量。`,
                    simulated: dayRows.every((item) => materialNature(item) === 'simulated'),
                    newsIds: dayRows.map((item) => item.id),
                });
            }
        }
        if (rule.kind === 'keyword') {
            for (const item of rows) {
                const hit = rule.keywords.find((keyword) => keyword && `${item.title}\n${item.summary}\n${item.eventName}`.includes(keyword));
                if (!hit)
                    continue;
                alerts.push({
                    id: `${rule.id}:${item.id}`,
                    ruleId: rule.id,
                    mediaId: rule.mediaId,
                    kind: rule.kind,
                    triggerAt: item.publishedAt,
                    summary: `报道「${item.title}」命中关键词「${hit}」。`,
                    basis: `关键词来自该媒体的预警规则，匹配标题、摘要或事件名。`,
                    simulated: materialNature(item) === 'simulated',
                    newsIds: [item.id],
                });
            }
        }
        if (rule.kind === 'hot_event') {
            const seen = new Set();
            for (const item of rows) {
                if (!hotTopics.has(item.topicId) || seen.has(item.eventId))
                    continue;
                seen.add(item.eventId);
                const snapshot = snapshotForTopic(item.topicId, start, end);
                const related = rows.filter((row) => row.eventId === item.eventId);
                alerts.push({
                    id: `${rule.id}:${item.eventId}`,
                    ruleId: rule.id,
                    mediaId: rule.mediaId,
                    kind: rule.kind,
                    triggerAt: snapshot?.observedAt ?? item.publishedAt,
                    summary: `事件「${item.eventName}」所属话题在所选日期内有热榜记录。`,
                    basis: snapshot
                        ? `${snapshot.platform}条目「${snapshot.title}」于 ${snapshot.observedAt.slice(0, 16).replace('T', ' ')} 排名第 ${snapshot.rank} 位。热度 ${snapshot.heat.toLocaleString('zh-CN')} 只属于该平台，不与其他平台相加。`
                        : '所选范围内有话题热榜记录，但没有取到对应快照。',
                    simulated: true,
                    newsIds: related.map((row) => row.id),
                });
            }
        }
    }
    return alerts.sort((a, b) => b.triggerAt.localeCompare(a.triggerAt));
}
export function sumCounts(rows, mediaIds) {
    return rows.reduce((total, row) => total + mediaIds.reduce((sum, id) => sum + (row.counts[id] ?? 0), 0), 0);
}

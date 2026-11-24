import { HOT_SNAPSHOTS, NEWS, TOPICS, WATCH_KEYWORDS, topicById } from '../data/demo/index.ts';
import { DATA_END, DATA_START, dayOf, eachDate } from './dates.ts';
const GROUP_ORDER = ['rank_rise', 'first_entry', 'new_coverage'];
export const ALERT_KIND_LABEL = {
    rank_rise: '排名上升',
    first_entry: '首次进入热榜',
    new_coverage: '报道增加',
};
function heatLabel(platform) {
    return platform === '微博' ? '微博热度' : '百度热度';
}
function buildHotAlerts() {
    const grouped = new Map();
    for (const snapshot of HOT_SNAPSHOTS) {
        const key = `${snapshot.platform}:${snapshot.itemId}`;
        const list = grouped.get(key) ?? [];
        list.push(snapshot);
        grouped.set(key, list);
    }
    const alerts = [];
    for (const snapshots of grouped.values()) {
        const ordered = [...snapshots].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
        ordered.forEach((snapshot, index) => {
            const topicName = snapshot.topicId ? topicById[snapshot.topicId].name : snapshot.title;
            const sameDayNews = NEWS.filter((item) => item.topicId === snapshot.topicId && snapshot.topicId !== null && dayOf(item.publishedAt) === dayOf(snapshot.observedAt)).map((item) => item.id);
            if (index === 0) {
                alerts.push({
                    id: `first:${snapshot.platform}:${snapshot.itemId}`,
                    kind: 'first_entry',
                    topicId: snapshot.topicId,
                    topicName,
                    triggerAt: snapshot.observedAt,
                    summary: `「${snapshot.title}」首次进入${snapshot.platform}模拟热榜，排名第 ${snapshot.rank} 位，${heatLabel(snapshot.platform)} ${snapshot.heat.toLocaleString('zh-CN')}。`,
                    magnitude: snapshot.rank,
                    magnitudeLabel: `首次第 ${snapshot.rank} 位`,
                    newsIds: sameDayNews,
                    snapshot: {
                        platform: snapshot.platform,
                        itemId: snapshot.itemId,
                        title: snapshot.title,
                        rank: snapshot.rank,
                        heat: snapshot.heat,
                        observedAt: snapshot.observedAt,
                    },
                });
            }
            if (index > 0) {
                const previous = ordered[index - 1];
                const delta = previous.rank - snapshot.rank;
                if (delta > 0) {
                    alerts.push({
                        id: `rise:${snapshot.platform}:${snapshot.itemId}:${snapshot.observedAt}`,
                        kind: 'rank_rise',
                        topicId: snapshot.topicId,
                        topicName,
                        triggerAt: snapshot.observedAt,
                        summary: `「${snapshot.title}」在${snapshot.platform}的相邻快照中由第 ${previous.rank} 位升至第 ${snapshot.rank} 位。比较只用该平台自己的排名，热度值为${heatLabel(snapshot.platform)} ${snapshot.heat.toLocaleString('zh-CN')}。`,
                        magnitude: delta,
                        magnitudeLabel: `上升 ${delta} 位`,
                        newsIds: sameDayNews,
                        snapshot: {
                            platform: snapshot.platform,
                            itemId: snapshot.itemId,
                            title: snapshot.title,
                            rank: snapshot.rank,
                            heat: snapshot.heat,
                            observedAt: snapshot.observedAt,
                            previousRank: previous.rank,
                        },
                    });
                }
            }
        });
    }
    return alerts;
}
function buildCoverageAlerts() {
    const alerts = [];
    for (const topic of TOPICS) {
        if (!WATCH_KEYWORDS.some((keyword) => topic.name.includes(keyword)))
            continue;
        const byDay = new Map();
        for (const item of NEWS) {
            if (item.topicId !== topic.id)
                continue;
            const day = dayOf(item.publishedAt);
            const list = byDay.get(day) ?? [];
            list.push(item);
            byDay.set(day, list);
        }
        let previous = 0;
        for (const day of eachDate(DATA_START, DATA_END)) {
            const list = byDay.get(day) ?? [];
            const delta = list.length - previous;
            if (list.length > 0 && delta >= 2) {
                const triggerAt = [...list].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt)).at(-1).publishedAt;
                alerts.push({
                    id: `cover:${topic.id}:${day}`,
                    kind: 'new_coverage',
                    topicId: topic.id,
                    topicName: topic.name,
                    triggerAt,
                    summary: previous === 0
                        ? `关注话题「${topic.name}」在 ${day} 出现 ${list.length} 条报道。关键词来自预设关注词，较前一日增加 ${delta} 条。`
                        : `关注话题「${topic.name}」在 ${day} 有 ${list.length} 条报道，较前一日增加 ${delta} 条。`,
                    magnitude: delta,
                    magnitudeLabel: `增加 ${delta} 条`,
                    newsIds: list.map((item) => item.id),
                    snapshot: null,
                });
            }
            previous = list.length;
        }
    }
    return alerts;
}
export const OVERVIEW_ALERTS = [...buildHotAlerts(), ...buildCoverageAlerts()];
export function sortAlerts(alerts, mode) {
    if (mode === 'latest') {
        return [...alerts].sort((a, b) => b.triggerAt.localeCompare(a.triggerAt) || a.id.localeCompare(b.id));
    }
    const sorted = [];
    for (const kind of GROUP_ORDER) {
        const group = alerts.filter((alert) => alert.kind === kind);
        group.sort((a, b) => {
            if (kind === 'first_entry')
                return a.magnitude - b.magnitude || b.triggerAt.localeCompare(a.triggerAt);
            return b.magnitude - a.magnitude || b.triggerAt.localeCompare(a.triggerAt);
        });
        sorted.push(...group);
    }
    return sorted;
}

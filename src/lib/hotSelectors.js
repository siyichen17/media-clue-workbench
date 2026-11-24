import { HOT_DEMO_BATCH } from '../data/demo/hotBatch.ts';
import { HOT_SNAPSHOTS, NEWS, TOPICS, topicById } from '../data/demo/index.ts';
import { addDays, DATA_END, DATA_START, dayOf, eachDate } from './dates.ts';
import { demoBatchLoaded, loadManualLinks } from './hotStorage.ts';
export function articleTopics(item) {
    const ids = item.topicIds?.length ? item.topicIds : [item.topicId];
    return [...new Set(ids)];
}
export function ingestedAt(item) {
    return item.ingestedAt || item.publishedAt;
}
export function hotNews() {
    return demoBatchLoaded() ? [...NEWS, ...HOT_DEMO_BATCH] : [...NEWS];
}
export function eventCatalog(news = hotNews()) {
    const map = new Map();
    for (const item of news) {
        if (!map.has(item.eventId))
            map.set(item.eventId, { id: item.eventId, name: item.eventName, topicId: item.topicId });
    }
    return [...map.values()];
}
export function resolveEventId(snapshot) {
    const manual = loadManualLinks()[`${snapshot.platform}:${snapshot.itemId}`];
    if (manual)
        return manual;
    return snapshot.eventId ?? null;
}
export function rankDelta(snapshot, snapshots = HOT_SNAPSHOTS) {
    const board = snapshots
        .filter((item) => item.platform === snapshot.platform)
        .map((item) => item.observedAt)
        .filter((value, index, list) => list.indexOf(value) === index)
        .sort();
    const previousBoard = [...board].reverse().find((time) => time < snapshot.observedAt);
    if (!previousBoard)
        return { kind: 'unknown', label: '无法比较' };
    const previous = snapshots.find((item) => item.platform === snapshot.platform && item.itemId === snapshot.itemId && item.observedAt === previousBoard);
    if (!previous)
        return { kind: 'new', label: '本次新入榜' };
    const change = previous.rank - snapshot.rank;
    if (change > 0)
        return { kind: 'up', label: `上升 ${change}` };
    if (change < 0)
        return { kind: 'down', label: `下降 ${Math.abs(change)}` };
    return { kind: 'flat', label: '持平' };
}
export function boardTimes(platform, snapshots = HOT_SNAPSHOTS) {
    return snapshots
        .filter((item) => item.platform === platform)
        .map((item) => item.observedAt)
        .filter((value, index, list) => list.indexOf(value) === index)
        .sort();
}
export function latestBoard(platform) {
    const times = boardTimes(platform);
    return times.at(-1) ?? null;
}
export function rowsAt(platform, observedAt) {
    return HOT_SNAPSHOTS.filter((item) => item.platform === platform && item.observedAt === observedAt).sort((a, b) => a.rank - b.rank);
}
/** 同一平台、同一条目。采集缺失与未上榜分开，未上榜不写成 0。 */
export function rankSeries(platform, itemId) {
    const times = boardTimes(platform);
    const own = new Map(HOT_SNAPSHOTS.filter((item) => item.platform === platform && item.itemId === itemId).map((item) => [item.observedAt, item.rank]));
    const days = new Set(times.map((time) => dayOf(time)));
    const points = [];
    for (const day of eachDate(DATA_START, DATA_END)) {
        if (!days.has(day)) {
            points.push({ time: `${day}T12:00:00+08:00`, rank: null, missing: true });
        }
    }
    for (const time of times) {
        points.push({ time, rank: own.get(time) ?? null, missing: false });
    }
    return points.sort((a, b) => a.time.localeCompare(b.time));
}
export function rankFacts(platform, itemId) {
    const own = HOT_SNAPSHOTS.filter((item) => item.platform === platform && item.itemId === itemId).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    if (!own.length)
        return null;
    const best = own.reduce((left, right) => (right.rank < left.rank ? right : left));
    const spanHours = (Date.parse(own[own.length - 1].observedAt) - Date.parse(own[0].observedAt)) / 3600000;
    return {
        first: own[0],
        latest: own[own.length - 1],
        best,
        spanLabel: `按快照估算约 ${Math.max(0, Math.round(spanHours))} 小时，不是精确上下榜时间`,
    };
}
export function newsForEvent(eventId, news = hotNews()) {
    return news.filter((item) => item.eventId === eventId).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
}
export function eventsForTopic(topicId, news = hotNews()) {
    return eventCatalog(news).filter((item) => item.topicId === topicId);
}
export function topicOfEvent(eventId, news = hotNews()) {
    return news.find((item) => item.eventId === eventId)?.topicId ?? null;
}
export function inRange(iso, start, end) {
    const day = dayOf(iso);
    return day >= start && day <= end;
}
export function topicNews(topicId, start, end, mediaId, news = hotNews()) {
    const seen = new Set();
    const items = [];
    for (const item of news) {
        if (!articleTopics(item).includes(topicId))
            continue;
        if (!inRange(item.publishedAt, start, end))
            continue;
        if (mediaId !== 'all' && item.mediaId !== mediaId)
            continue;
        if (seen.has(item.id))
            continue;
        seen.add(item.id);
        items.push(item);
    }
    return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
export function dailyNewsCounts(topicId, start, end, mediaId) {
    const items = topicNews(topicId, start, end, mediaId);
    return eachDate(start, end).map((day) => ({
        day,
        count: items.filter((item) => dayOf(item.publishedAt) === day).length,
    }));
}
export function hotItemsForTopic(topicId) {
    const ids = new Set();
    for (const snapshot of HOT_SNAPSHOTS) {
        const eventId = resolveEventId(snapshot);
        const linkedTopic = eventId ? topicOfEvent(eventId) : snapshot.topicId;
        if (linkedTopic === topicId)
            ids.add(`${snapshot.platform}:${snapshot.itemId}`);
    }
    return ids;
}
export function dailyBoardCounts(topicId, start, end) {
    const related = hotItemsForTopic(topicId);
    return eachDate(start, end).map((day) => {
        const seenWeibo = new Set();
        const seenBaidu = new Set();
        for (const snapshot of HOT_SNAPSHOTS) {
            if (dayOf(snapshot.observedAt) !== day)
                continue;
            const key = `${snapshot.platform}:${snapshot.itemId}`;
            if (!related.has(key))
                continue;
            if (snapshot.platform === '微博')
                seenWeibo.add(snapshot.itemId);
            if (snapshot.platform === '百度')
                seenBaidu.add(snapshot.itemId);
        }
        return { day, weibo: seenWeibo.size, baidu: seenBaidu.size };
    });
}
export function snapshotsOnDay(topicId, day) {
    const related = hotItemsForTopic(topicId);
    const grouped = new Map();
    for (const snapshot of HOT_SNAPSHOTS) {
        if (dayOf(snapshot.observedAt) !== day)
            continue;
        const key = `${snapshot.platform}:${snapshot.itemId}`;
        if (!related.has(key))
            continue;
        const previous = grouped.get(key);
        if (!previous || snapshot.observedAt > previous.observedAt)
            grouped.set(key, snapshot);
    }
    return [...grouped.values()].sort((a, b) => a.platform.localeCompare(b.platform) || a.rank - b.rank);
}
function periodStats(topicId, start, end, news) {
    const items = topicNews(topicId, start, end, 'all', news);
    const buckets = new Map();
    const media = new Map();
    let pending = 0;
    for (const item of items) {
        const eventTopic = topicOfEvent(item.eventId, news);
        const key = item.eventId && eventTopic === topicId ? item.eventId : 'pending';
        if (key === 'pending')
            pending += 1;
        const bucket = buckets.get(key) ?? {
            eventId: key,
            name: key === 'pending' ? '多事件/待关联' : item.eventName,
            count: 0,
            articleIds: [],
        };
        bucket.count += 1;
        bucket.articleIds.push(item.id);
        buckets.set(key, bucket);
        const mediaRow = media.get(item.mediaId) ?? { mediaId: item.mediaId, name: item.mediaName, count: 0 };
        mediaRow.count += 1;
        media.set(item.mediaId, mediaRow);
    }
    return {
        count: items.length,
        events: [...buckets.values()].sort((a, b) => b.count - a.count),
        media: [...media.values()].sort((a, b) => b.count - a.count),
        pending,
    };
}
export function coverageComplete(start, end) {
    return start >= DATA_START && end <= DATA_END;
}
export function buildExplain(topicId, start, end, news = hotNews()) {
    const days = eachDate(start, end);
    const previousEnd = addDays(start, -1);
    const previousStart = addDays(start, -days.length);
    const current = periodStats(topicId, start, end, news);
    const previousCovered = coverageComplete(previousStart, previousEnd);
    const previous = previousCovered ? periodStats(topicId, previousStart, previousEnd, news) : null;
    const delta = previous ? current.count - previous.count : null;
    const eventIds = new Set([...(previous?.events.map((item) => item.eventId) ?? []), ...current.events.map((item) => item.eventId)]);
    const events = [...eventIds].map((eventId) => {
        const now = current.events.find((item) => item.eventId === eventId);
        const before = previous?.events.find((item) => item.eventId === eventId);
        return {
            eventId,
            name: now?.name || before?.name || eventId,
            current: now?.count ?? 0,
            previous: before?.count ?? 0,
            delta: (now?.count ?? 0) - (before?.count ?? 0),
            articleIds: now?.articleIds ?? [],
        };
    });
    const mediaIds = new Set([...(previous?.media.map((item) => item.mediaId) ?? []), ...current.media.map((item) => item.mediaId)]);
    const media = [...mediaIds].map((mediaId) => {
        const now = current.media.find((item) => item.mediaId === mediaId);
        const before = previous?.media.find((item) => item.mediaId === mediaId);
        return {
            mediaId,
            name: now?.name || before?.name || mediaId,
            current: now?.count ?? 0,
            previous: before?.count ?? 0,
            delta: (now?.count ?? 0) - (before?.count ?? 0),
        };
    });
    const partSum = events.reduce((sum, item) => sum + item.delta, 0);
    return {
        mode: previousCovered ? 'change' : 'composition',
        currentRange: { start, end },
        previousRange: { start: previousStart, end: previousEnd },
        previousCovered,
        current,
        previous,
        delta,
        events,
        media,
        partSum,
        pendingCurrent: current.pending,
        pendingPrevious: previous?.pending ?? null,
    };
}
export function drillEvents(topicId, start, end, news = hotNews()) {
    const items = topicNews(topicId, start, end, 'all', news);
    const groups = new Map();
    for (const item of items) {
        const eventTopic = topicOfEvent(item.eventId, news);
        const key = item.eventId && eventTopic === topicId ? item.eventId : 'pending';
        const list = groups.get(key) ?? [];
        list.push(item);
        groups.set(key, list);
    }
    return [...groups.entries()]
        .map(([eventId, rows]) => ({
        eventId,
        name: eventId === 'pending' ? '待关联报道' : rows[0].eventName,
        count: rows.length,
        media: new Set(rows.map((item) => item.mediaId)).size,
        latest: rows.map((item) => item.publishedAt).sort().at(-1) ?? '',
        items: rows,
    }))
        .sort((a, b) => b.count - a.count);
}
export function followDelta(follow, news = hotNews()) {
    const fresh = news.filter((item) => articleTopics(item).includes(follow.topicId) && ingestedAt(item) > follow.seenWatermark);
    const events = new Set(fresh.map((item) => item.eventId));
    const latest = news
        .filter((item) => articleTopics(item).includes(follow.topicId))
        .map((item) => ingestedAt(item))
        .sort()
        .at(-1);
    return { reports: fresh.length, events: events.size, latest: latest ?? follow.followedAt };
}
export function topicName(topicId) {
    return topicById[topicId]?.name ?? topicId;
}
export function allTopics() {
    return TOPICS;
}

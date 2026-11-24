import { HOT_SNAPSHOTS, MEDIA, NEWS, topicById } from '../data/demo/index.ts'
import { defaultFilters, loadMediaState } from '../lib/competeStorage.ts'
import { dailySeries, filterMonitorNews, mediaMetrics } from '../lib/competeSelectors.ts'
import { DATA_AS_OF_LABEL, DATA_END, DEFAULT_START, dateRangeOf, dayOf } from '../lib/dates.ts'
import { dailyCounts, filterAlerts, heatmapModel, mediaCounts, pageMetrics } from '../lib/overviewSelectors.ts'
import type { NewsItem, OverviewFilters } from '../types/domain.ts'

const FILTERS: OverviewFilters = {
  preset: '7d',
  customStart: DEFAULT_START,
  customEnd: DATA_END,
  selectedDay: null,
  platform: 'all',
  keyword: '',
}

export interface ProtoPack {
  asOf: string
  newsCount: number
  hotCount: number
  peerCount: number
  monitorCount: number
  newTopicCount: number
  platformCount: number
  daily: { date: string; count: number }[]
  mediaBars: { id: string; name: string; count: number }[]
  peerBars: { id: string; name: string; count: number }[]
  topics: { id: string; name: string; count: number }[]
  heatmap: ReturnType<typeof heatmapModel>
  alerts: ReturnType<typeof filterAlerts>
  news: NewsItem[]
  hotRows: { rank: number; title: string }[]
  timeline: { time: string; text: string; news: NewsItem[] }[]
}

function latestHotRows() {
  const range = dateRangeOf(FILTERS)
  const rows = HOT_SNAPSHOTS.filter((item) => {
    const day = dayOf(item.observedAt)
    return day >= range.start && day <= range.end
  })
  const latest = new Map<string, (typeof rows)[number]>()
  for (const item of rows) {
    const key = `${item.platform}:${item.itemId}`
    const current = latest.get(key)
    if (!current || item.observedAt > current.observedAt) latest.set(key, item)
  }
  return [...latest.values()].sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title, 'zh-CN')).slice(0, 12)
}

export function loadProtoPack(): ProtoPack {
  const metrics = pageMetrics(FILTERS)
  const range = dateRangeOf(FILTERS)
  const mediaState = loadMediaState()
  const compete = defaultFilters(mediaState.ownMediaId, mediaState.profiles)
  const monitored = filterMonitorNews(compete)
  const peers = compete.peerIds
  const peerMetrics = mediaMetrics(monitored.news, peers, new Set())
  const firstDay = new Map<string, string>()
  for (const item of NEWS) {
    const day = dayOf(item.publishedAt)
    const current = firstDay.get(item.topicId)
    if (!current || day < current) firstDay.set(item.topicId, day)
  }
  const newTopicCount = [...firstDay.values()].filter((day) => day >= range.start && day <= range.end).length
  const platforms = new Set(HOT_SNAPSHOTS.filter((item) => {
    const day = dayOf(item.observedAt)
    return day >= range.start && day <= range.end
  }).map((item) => item.platform))
  const bubbles = new Map<string, number>()
  for (const item of metrics.news) bubbles.set(item.topicId, (bubbles.get(item.topicId) ?? 0) + 1)
  const topics = [...bubbles.entries()]
    .map(([id, count]) => ({ id, name: topicById[id]?.name ?? id, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
    .slice(0, 12)
  const alerts = filterAlerts(FILTERS)
  const newsById = new Map(NEWS.map((item) => [item.id, item]))
  return {
    asOf: DATA_AS_OF_LABEL,
    newsCount: metrics.newsCount,
    hotCount: metrics.hotCount,
    peerCount: peers.length,
    monitorCount: monitored.news.length,
    newTopicCount,
    platformCount: platforms.size,
    daily: dailyCounts(FILTERS),
    mediaBars: mediaCounts(metrics.news),
    peerBars: peerMetrics.map((item) => ({
      id: item.mediaId,
      name: MEDIA.find((media) => media.id === item.mediaId)?.name ?? item.mediaId,
      count: item.newsCount,
    })),
    topics,
    heatmap: heatmapModel(metrics.news),
    alerts,
    news: [...metrics.news].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    hotRows: latestHotRows().map((item) => ({ rank: item.rank, title: item.title })),
    timeline: alerts.slice(0, 8).map((alert) => ({
      time: alert.triggerAt.slice(5, 16).replace('T', ' '),
      text: alert.summary,
      news: alert.newsIds.map((id) => newsById.get(id)).filter((item): item is NewsItem => Boolean(item)),
    })),
  }
}

export function kpiText(pack: ProtoPack, title: string): string {
  if (title === '今日线索量') return String(pack.newsCount)
  if (title === '热搜命中' || title === '热搜总量') return String(pack.hotCount)
  if (title === '监控竞品数') return String(pack.peerCount)
  if (title === '今日发稿') return String(pack.monitorCount)
  if (title === '新增话题') return String(pack.newTopicCount)
  if (title === '平台覆盖') return String(pack.platformCount)
  return '—'
}

export function newsOnDay(pack: ProtoPack, date: string): NewsItem[] {
  return pack.news.filter((item) => dayOf(item.publishedAt) === date)
}

export function newsForMedia(pack: ProtoPack, mediaId: string): NewsItem[] {
  return pack.news.filter((item) => item.mediaId === mediaId)
}

export function competeTrend(): { dates: string[]; series: { name: string; data: number[] }[] } {
  const mediaState = loadMediaState()
  const filters = defaultFilters(mediaState.ownMediaId, mediaState.profiles)
  const monitored = filterMonitorNews(filters)
  const ids = [filters.ownMediaId, ...filters.peerIds].slice(0, 4)
  const rows = dailySeries(monitored.news, ids, monitored.start, monitored.end)
  return {
    dates: rows.map((row) => row.date.slice(5)),
    series: ids.map((id) => ({
      name: MEDIA.find((media) => media.id === id)?.name ?? id,
      data: rows.map((row) => row.counts[id] ?? 0),
    })),
  }
}


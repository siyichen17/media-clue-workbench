import { CATEGORIES, CATEGORY_COLORS, HOT_SNAPSHOTS, MEDIA, categoryById, topicById } from '../data/demo/index.ts'
import { draftsForEvent } from '../lib/analysisDraft.ts'
import { defaultFilters, loadMediaState, profileName } from '../lib/competeStorage.ts'
import { filterMonitorNews, mediaMetrics, selectedMediaIds } from '../lib/competeSelectors.ts'
import { DATA_AS_OF_LABEL, dateRangeOf, dayOf, formatStamp } from '../lib/dates.ts'
import { loadProgressCache } from '../lib/hotStorage.ts'
import type { ProgressResult } from '../../shared/aiTypes.ts'
import { resolveEventId } from '../lib/hotSelectors.ts'
import { visibleLeads } from '../lib/leads.ts'
import { categoryCounts, dailyCounts, filterAlerts, filterNews, heatmapModel, mediaCounts, pageMetrics, topicBubbles } from '../lib/overviewSelectors.ts'
import type { NewsItem, OverviewFilters } from '../types/domain.ts'
import type { ScreenScope, ScreenTemplate, ScreenWidget } from './types.ts'

export interface TransientFilters {
  selectedDay: string | null
  categoryId: string | null
  topicId: string | null
  mediaId: string | null
}

export const EMPTY_TRANSIENT: TransientFilters = { selectedDay: null, categoryId: null, topicId: null, mediaId: null }

export function scopeOf(template: ScreenTemplate, widget: ScreenWidget, transient: TransientFilters, linked: boolean) {
  const base = widget.followGlobal ? { ...template.globalFilters, hotPlatform: widget.scope.hotPlatform } : widget.scope
  if (!widget.followGlobal || !linked) return base
  return {
    ...base,
    categoryId: transient.categoryId || base.categoryId,
    topicId: transient.topicId || base.topicId,
    mediaId: transient.mediaId || base.mediaId,
    hotPlatform: widget.scope.hotPlatform,
  }
}

export function toOverview(scope: ScreenScope, selectedDay: string | null): OverviewFilters {
  return {
    preset: scope.preset,
    customStart: scope.customStart,
    customEnd: scope.customEnd,
    selectedDay,
    platform: scope.platform,
    keyword: '',
  }
}

export function scopedNews(scope: ScreenScope, selectedDay: string | null) {
  return filterNews(toOverview(scope, selectedDay), 'page').filter((item) => {
    if (scope.categoryId !== 'all' && item.categoryId !== scope.categoryId) return false
    if (scope.mediaId !== 'all' && item.mediaId !== scope.mediaId) return false
    if (scope.topicId !== 'all' && item.topicId !== scope.topicId) return false
    return true
  })
}

export function rangeLabel(scope: ScreenScope) {
  const range = dateRangeOf(scope)
  const preset = scope.preset === '7d' ? '最近7天' : scope.preset === '14d' ? '最近14天' : '固定日期'
  return `${preset} ${range.start} 至 ${range.end}`
}

export function widgetModel(template: ScreenTemplate, widget: ScreenWidget, transient: TransientFilters) {
  const scope = scopeOf(template, widget, transient, template.linkFilters)
  const selectedDay = widget.followGlobal && template.linkFilters ? transient.selectedDay : null
  const news = scopedNews(scope, selectedDay)
  const trendNews = scopedNews(scope, null)
  const overview = toOverview(scope, selectedDay)
  const metrics = pageMetrics({ ...overview, selectedDay })
  const filteredMetrics = {
    newsCount: news.length,
    topicCount: new Set(news.map((item) => item.topicId)).size,
    mediaCount: new Set(news.map((item) => item.mediaId)).size,
    hotCount: metrics.hotCount,
  }
  return {
    scope,
    selectedDay,
    news,
    label: rangeLabel(scope),
    asOf: DATA_AS_OF_LABEL,
    metrics: filteredMetrics,
    daily: dailyCounts({ ...overview, selectedDay: null }).map((point) => ({
      ...point,
      count: trendNews.filter((item) => dayOf(item.publishedAt) === point.date).length,
    })),
    bubbles: topicBubbles(news),
    categories: categoryCounts(news),
    media: mediaCounts(news),
    heat: heatmapModel(news),
    alerts: filterAlerts(overview).slice(0, widget.display.limit || 8),
    colors: CATEGORY_COLORS,
    categoryName: scope.categoryId === 'all' ? '全部分类' : categoryById[scope.categoryId as keyof typeof categoryById]?.name ?? '分类不可用',
    mediaName: scope.mediaId === 'all' ? '全部媒体' : MEDIA.find((item) => item.id === scope.mediaId)?.name ?? '媒体不可用',
    topicName: scope.topicId === 'all' ? '全部主题' : topicById[scope.topicId]?.name ?? '主题不可用',
    eventCount: new Set(news.map((item) => item.eventId)).size,
    follows: followRows(news),
    hotEventCount: hotEventIds(scope).size,
    peers: peerBars(),
  }
}

function followRows(news: NewsItem[]) {
  return visibleLeads()
    .filter((lead) => lead.eventId)
    .map((lead) => {
      const known = new Set(lead.articles.map((item) => item.articleId))
      const related = news.filter((item) => item.eventId === lead.eventId)
      const fresh = related.filter((item) => !known.has(item.id))
      return { id: lead.eventId || lead.id, name: lead.title, count: related.length, fresh: fresh.length, items: related }
    })
    .filter((item) => item.fresh > 0)
}

function hotEventIds(scope: ScreenScope) {
  const ids = new Set<string>()
  for (const row of hotRows(scope, 80).rows) {
    const eventId = resolveEventId(row)
    if (eventId) ids.add(eventId)
  }
  return ids
}

function peerBars() {
  const state = loadMediaState()
  const filters = defaultFilters(state.ownMediaId, state.profiles)
  const monitored = filterMonitorNews(filters)
  return mediaMetrics(monitored.news, filters.peerIds, new Set()).map((item) => ({
    id: item.mediaId,
    name: profileName(state.profiles, item.mediaId),
    count: item.newsCount,
  }))
}

export function hotRows(scope: ScreenScope, limit: number) {
  const range = dateRangeOf(scope)
  const inRange = HOT_SNAPSHOTS.filter((item) => {
    if (item.platform !== scope.hotPlatform) return false
    const day = dayOf(item.observedAt)
    return day >= range.start && day <= range.end
  })
  const latest = new Map<string, (typeof HOT_SNAPSHOTS)[number]>()
  for (const item of inRange) {
    const current = latest.get(item.itemId)
    if (!current || item.observedAt > current.observedAt) latest.set(item.itemId, item)
  }
  const rows = [...latest.values()].sort((a, b) => a.rank - b.rank || a.observedAt.localeCompare(b.observedAt))
  const observedAt = rows.reduce((max, item) => item.observedAt > max ? item.observedAt : max, rows[0]?.observedAt ?? '')
  return { observedAt: observedAt || null, rows: rows.slice(0, limit) }
}

export interface ProgressNodeView {
  id: string
  kind: 'fact' | 'commentary'
  title: string
  summary: string
  timeLabel: string
  reportedTime: boolean
  articleIds: string[]
}

export function monitorMedia() {
  const state = loadMediaState()
  const filters = defaultFilters(state.ownMediaId, state.profiles)
  return selectedMediaIds(filters).map((id) => ({
    id,
    name: profileName(state.profiles, id) || MEDIA.find((item) => item.id === id)?.name || id,
  }))
}

export function coverageMatrix(news: NewsItem[], mediaIds: string[]) {
  const chosen = mediaIds.length ? mediaIds : monitorMedia().map((item) => item.id)
  const media = chosen.map((id) => ({ id, name: MEDIA.find((item) => item.id === id)?.name ?? monitorMedia().find((item) => item.id === id)?.name ?? id }))
  const events = eventRanks(news, 'count').sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
  const cells = new Map<string, NewsItem[]>()
  for (const item of news) {
    if (!chosen.includes(item.mediaId)) continue
    const key = `${item.eventId}\t${item.mediaId}`
    const list = cells.get(key) ?? []
    list.push(item)
    cells.set(key, list)
  }
  return { media, events, cells, usingMonitor: mediaIds.length === 0 }
}

export function progressView(eventId: string, news: NewsItem[]) {
  const related = news.filter((item) => item.eventId === eventId)
  const draft = draftsForEvent(eventId).sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0]
  let nodes: ProgressNodeView[] = []
  let materialIds: string[] = []
  let hasAnalysis = false
  if (draft) {
    hasAnalysis = true
    materialIds = draft.materialIds
    nodes = draft.branches
      .filter((item): item is typeof item & { kind: 'fact' | 'commentary' } => item.kind === 'fact' || item.kind === 'commentary')
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        summary: item.summary,
        timeLabel: item.timeLabel,
        reportedTime: item.timeLabel.includes('报道时间'),
        articleIds: item.articleIds,
      }))
  } else {
    const saved = loadProgressCache().find((item) => item.eventId === eventId)
    const result = saved?.result as ProgressResult | undefined
    if (saved && result?.nodes?.length) {
      hasAnalysis = true
      materialIds = saved.materialIds
      nodes = result.nodes
        .filter((item): item is typeof item & { nodeType: 'fact' | 'commentary' } => (item.nodeType === 'fact' || item.nodeType === 'commentary') && Boolean(item.title))
        .map((item) => ({
          id: item.nodeId,
          kind: item.nodeType,
          title: item.title,
          summary: item.summary,
          timeLabel: `${item.timeBasis === 'report' ? '报道时间 ' : ''}${item.timeStart.slice(0, 16).replace('T', ' ')}`,
          reportedTime: item.timeBasis === 'report',
          articleIds: item.articleIds,
        }))
    }
  }
  const known = new Set(materialIds)
  const freshCount = hasAnalysis ? related.filter((item) => !known.has(item.id)).length : 0
  return { hasAnalysis, nodes, related, freshCount }
}

export function eventRanks(news: NewsItem[], sort: 'latest' | 'count') {
  const map = new Map<string, { id: string; name: string; latest: string; count: number; media: Set<string> }>()
  for (const item of news) {
    const row = map.get(item.eventId) ?? { id: item.eventId, name: item.eventName, latest: item.publishedAt, count: 0, media: new Set<string>() }
    row.count += 1
    row.media.add(item.mediaId)
    if (item.publishedAt > row.latest) row.latest = item.publishedAt
    map.set(item.eventId, row)
  }
  return [...map.values()]
    .map((item) => ({ id: item.id, name: item.name, latest: item.latest, count: item.count, mediaCount: item.media.size }))
    .sort((a, b) => sort === 'count' ? b.count - a.count || b.latest.localeCompare(a.latest) : b.latest.localeCompare(a.latest) || b.count - a.count)
}

export function eventsIn(news: NewsItem[]) {
  const map = new Map<string, string>()
  news.forEach((item) => map.set(item.eventId, item.eventName))
  return [...map.entries()].map(([id, name]) => ({ id, name }))
}

export function firstLinkedEvent(rows: ReturnType<typeof hotRows>['rows']) {
  for (const row of rows) {
    const eventId = resolveEventId(row)
    if (eventId) return { snapshot: row, eventId }
  }
  return null
}

export { CATEGORIES, MEDIA, formatStamp, resolveEventId }

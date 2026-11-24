import type { NewsItem } from '../types/domain.ts'
import type { MaterialSnapshot, ReportScope, ReportStats } from '../types/report.ts'
import { categorySeries, hotTopicIds, mediaMetrics } from './competeSelectors.ts'
import type { MediaProfile } from './competeStorage.ts'
import { profileName } from './competeStorage.ts'
import { dateRangeOf, dayOf } from './dates.ts'
import { materialLevel, materialNature } from './material.ts'

export function snapshotMaterial(item: NewsItem, profiles: MediaProfile[]): MaterialSnapshot {
  return {
    articleId: item.id,
    eventId: item.eventId,
    eventName: item.eventName,
    mediaId: item.mediaId,
    mediaName: profileName(profiles, item.mediaId) || item.mediaName,
    columnName: item.columnName,
    platform: item.platform,
    publishedAt: item.publishedAt,
    categoryId: item.categoryId,
    title: item.title,
    summary: item.summary,
    body: item.body,
    completeness: materialLevel(item),
    nature: materialNature(item),
  }
}

export function buildReportStats(
  scopeNews: NewsItem[],
  selected: MaterialSnapshot[],
  scope: ReportScope,
  profiles: MediaProfile[],
): ReportStats {
  const range = dateRangeOf(scope.filters)
  const hotTopics = hotTopicIds(range.start, range.end)
  const metrics = mediaMetrics(scopeNews, scope.mediaIds, hotTopics)
  const byMedia = scope.mediaIds.map((mediaId) => {
    const metric = metrics.find((item) => item.mediaId === mediaId)
    const chosen = selected.filter((item) => item.mediaId === mediaId)
    const times = chosen.map((item) => item.publishedAt).sort()
    return {
      mediaId,
      name: profileName(profiles, mediaId),
      newsCount: metric?.newsCount ?? 0,
      eventCount: metric?.eventCount ?? 0,
      hotNewsCount: metric?.hotNewsCount ?? 0,
      selectedCount: chosen.length,
      earliest: times[0] ?? null,
      latest: times.at(-1) ?? null,
    }
  })
  const days = [...new Set(scopeNews.map((item) => dayOf(item.publishedAt)))].sort()
  return {
    rangeLabel: `${range.start} 至 ${range.end}`,
    newsCount: scopeNews.length,
    eventCount: new Set(scopeNews.map((item) => item.eventId)).size,
    hotNewsCount: scopeNews.filter((item) => hotTopics.has(item.topicId)).length,
    analyzedCount: selected.length,
    fullCount: selected.filter((item) => item.completeness === 'full').length,
    summaryCount: selected.filter((item) => item.completeness === 'summary').length,
    titleCount: selected.filter((item) => item.completeness === 'title').length,
    simulatedCount: selected.filter((item) => item.nature === 'simulated').length,
    realCount: selected.filter((item) => item.nature === 'real').length,
    byMedia,
    byDay: days.map((date) => ({
      date,
      counts: Object.fromEntries(
        scope.mediaIds.map((mediaId) => [
          mediaId,
          scopeNews.filter((item) => item.mediaId === mediaId && dayOf(item.publishedAt) === date).length,
        ]),
      ),
    })),
    byCategory: categorySeries(scopeNews, scope.mediaIds).map((row) => ({ name: row.name, counts: row.counts })),
    byEvent: [...new Set(scopeNews.map((item) => item.eventId))].map((eventId) => {
      const rows = scopeNews.filter((item) => item.eventId === eventId)
      return {
        eventId,
        name: rows[0]?.eventName ?? eventId,
        counts: Object.fromEntries(scope.mediaIds.map((mediaId) => [mediaId, rows.filter((item) => item.mediaId === mediaId).length])),
      }
    }),
  }
}

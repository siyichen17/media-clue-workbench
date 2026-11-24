import { MONITOR_NEWS } from '../data/demo/monitor.ts'
import type { NewsItem } from '../types/domain.ts'
import type { MaterialSnapshot, ReportDocument, ReportType } from '../types/report.ts'
import { dateRangeOf } from './dates.ts'
import { listReports, saveReport } from './reportStore.ts'

export const LOCAL_ACCOUNT = 'local-demo'

export function typeLabel(type: ReportType) {
  if (type === 'daily') return '热搜日报'
  if (type === 'weekly') return '热搜周报'
  if (type === 'topic') return '事件专题报告'
  if (type === 'date') return '多媒体日期对比'
  if (type === 'event') return '多媒体事件对比'
  if (type === 'media') return '单媒体分析报告'
  if (type === 'theme') return '主题观察报告'
  if (type === 'work') return '工作报告'
  return '报告'
}

export function isFinal(report: ReportDocument) {
  return Boolean(report.finalizedAt) || report.status === 'final'
}

export function statusLabel(report: ReportDocument) {
  return isFinal(report) ? '已定稿' : '草稿'
}

export function normalizeReport(report: ReportDocument): ReportDocument {
  return {
    ...report,
    groupId: report.groupId || report.id,
    versionId: report.versionId || report.id,
    parentVersionId: report.parentVersionId ?? null,
    copiedFrom: report.copiedFrom ?? null,
    finalizedAt: report.finalizedAt ?? (report.status === 'final' ? report.updatedAt : null),
    editedAt: report.editedAt || report.updatedAt,
    archived: Boolean(report.archived),
    createdBy: report.createdBy || LOCAL_ACCOUNT,
    leadIds: report.leadIds ?? [],
    narrative: report.narrative ?? null,
  }
}

export function humanEditedAt(report: ReportDocument) {
  return report.editedAt || report.updatedAt
}

export function natureMix(materials: MaterialSnapshot[]) {
  const real = materials.some((item) => item.nature === 'real')
  const simulated = materials.some((item) => item.nature !== 'real')
  if (real && simulated) return '混合'
  if (real) return '真实'
  if (simulated) return '模拟'
  return '无材料'
}

export function scopeText(report: ReportDocument) {
  const range = report.stats.rangeLabel || `${report.scope.filters.customStart} 至 ${report.scope.filters.customEnd}`
  if (report.scope.eventName) return `${report.scope.eventName} · ${range}`
  return range
}

export function groupReports(rows: ReportDocument[]) {
  const groups = new Map<string, ReportDocument[]>()
  rows.map(normalizeReport).forEach((report) => {
    const list = groups.get(report.groupId || report.id) ?? []
    list.push(report)
    groups.set(report.groupId || report.id, list)
  })
  return [...groups.values()].map((versions) => {
    const sorted = [...versions].sort((a, b) => humanEditedAt(b).localeCompare(humanEditedAt(a)) || b.id.localeCompare(a.id))
    const openDraft = sorted.find((item) => !isFinal(item))
    const head = openDraft ?? sorted[0]
    return { head, versions: sorted }
  })
}

function stamp() {
  return new Date().toISOString()
}

export async function saveReportMeta(report: ReportDocument) {
  const next = normalizeReport(report)
  await saveReport(next)
  return next
}

export async function setGroupArchived(groupId: string, archived: boolean) {
  const rows = await listReports()
  const targets = rows.map(normalizeReport).filter((item) => item.groupId === groupId)
  for (const item of targets) {
    await saveReport({ ...item, archived, updatedAt: item.updatedAt, editedAt: item.editedAt })
  }
  return targets.length
}

export async function finalizeReport(report: ReportDocument) {
  const now = stamp()
  const next = normalizeReport({ ...report, status: 'final', finalizedAt: now, editedAt: now, updatedAt: now })
  await saveReport(next)
  return next
}

export async function ensureRevision(report: ReportDocument) {
  const current = normalizeReport(report)
  if (!isFinal(current)) return current
  const rows = (await listReports()).map(normalizeReport)
  const open = rows.find((item) => item.groupId === current.groupId && !isFinal(item))
  if (open) return open
  const now = stamp()
  const id = `rpt-${Date.now().toString(36)}`
  const next: ReportDocument = {
    ...structuredClone(current),
    id,
    versionId: id,
    parentVersionId: current.id,
    status: 'draft',
    finalizedAt: null,
    createdAt: now,
    updatedAt: now,
    editedAt: now,
    copiedFrom: null,
  }
  await saveReport(next)
  return next
}

export async function copyReport(report: ReportDocument) {
  const current = normalizeReport(report)
  const now = stamp()
  const id = `rpt-${Date.now().toString(36)}`
  const next: ReportDocument = {
    ...structuredClone(current),
    id,
    groupId: id,
    versionId: id,
    parentVersionId: null,
    copiedFrom: current.id,
    status: 'draft',
    finalizedAt: null,
    archived: false,
    title: `${current.title}（副本）`,
    createdAt: now,
    updatedAt: now,
    editedAt: now,
  }
  await saveReport(next)
  return next
}

function bodyHash(item: { title: string; summary?: string; body?: string }) {
  return `${item.title}\n${item.summary ?? ''}\n${item.body ?? ''}`
}

export function materialChanges(report: ReportDocument, news: NewsItem[] = MONITOR_NEWS) {
  const range = dateRangeOf(report.scope.filters)
  const media = new Set(report.scope.mediaIds)
  const inRange = (item: NewsItem) => item.publishedAt.slice(0, 10) >= range.start && item.publishedAt.slice(0, 10) <= range.end
  let pool = news.filter((item) => !media.size || media.has(item.mediaId))
  if (report.type === 'event' || (report.type === 'topic' && report.scope.eventId)) {
    pool = pool.filter((item) => item.eventId === report.scope.eventId)
  } else {
    pool = pool.filter(inRange)
  }
  const stored = new Map(report.materials.map((item) => [item.articleId, bodyHash(item)]))
  const added = pool.filter((item) => !stored.has(item.id))
  const revised = pool.filter((item) => stored.has(item.id) && bodyHash(item) !== stored.get(item.id))
  const currentIds = new Set(pool.map((item) => item.id))
  const removed = report.materials.filter((item) => !currentIds.has(item.articleId))
  return { added, revised, removed, pool, hasChange: added.length + revised.length + removed.length > 0 }
}

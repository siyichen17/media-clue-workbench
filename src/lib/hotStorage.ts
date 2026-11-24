import { WATCH_KEYWORDS } from '../data/demo/index.ts'
import { DATA_AS_OF_LABEL } from './dates.ts'
import type { DatePreset, HotPlatform } from '../types/domain.ts'
import { findLeadByEvent, followEvent, saveNotes, visibleLeads } from './leads.ts'

const LINKS_KEY = 'hot-manual-links-v1'
const TOPICS_KEY = 'hot-topic-follows-v1'
const KEYWORDS_KEY = 'hot-keywords-v1'
const BATCH_KEY = 'hot-demo-batch-v1'
const VIEW_KEY = 'hot-view-v1'
const WATCH_KEY = 'hot-event-watches-v1'
const PROGRESS_KEY = 'hot-progress-cache-v1'
const EXPLAIN_KEY = 'hot-explain-cache-v1'

export interface TopicFollow {
  topicId: string
  followedAt: string
  /** 标记已看时已载入材料的最大入库时间。之后新入库的不在这次水位里。 */
  seenWatermark: string
  active: boolean
}

export interface EventFollow {
  eventId: string
  eventName: string
  materialIds: string[]
  note: string
  analysisRef: string | null
  updatedAt: string
}

export interface EventWatch {
  eventId: string
  userId: string
  active: boolean
  watchedAt: string
  /** null 表示关注后还没有打开过，不能把历史材料算成新增。 */
  seenIds: string[] | null
}

export interface HotViewState {
  platform: HotPlatform
  snapshotId: string | null
  itemId: string | null
  eventId: string | null
  topicLocked: boolean
  topicId: string | null
  preset: DatePreset
  customStart: string
  customEnd: string
  metric: 'news' | 'board'
  selectedDay: string | null
  mediaId: string
  scroll: number
  materialMode?: 'later' | 'asof'
  openNodes?: string[]
  reportSort?: 'latest' | 'earliest'
  homeTab?: 'discover' | 'track'
  source?: 'news' | HotPlatform
  query?: string
  region?: string
  domain?: string
  clueSort?: 'published' | 'ingested'
}

export interface ProgressCacheRecord {
  key: string
  eventId: string
  materialIds: string[]
  result: unknown
  createdAt: string
  /** 缺省视为“含后续报道”，兼容已保存的概括。 */
  scope?: 'later' | 'asof'
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadManualLinks(): Record<string, string> {
  return readJson(LINKS_KEY, {})
}

export function saveManualLink(itemKey: string, eventId: string) {
  const links = loadManualLinks()
  links[itemKey] = eventId
  writeJson(LINKS_KEY, links)
}

export function loadEventWatches(): EventWatch[] {
  return readJson<EventWatch[]>(WATCH_KEY, [])
}

export function saveEventWatches(rows: EventWatch[]) {
  writeJson(WATCH_KEY, rows)
}

export function watchEvent(eventId: string, userId: string) {
  const rows = loadEventWatches()
  const existing = rows.find((item) => item.eventId === eventId && item.userId === userId)
  const next = existing
    ? rows.map((item) => (item.eventId === eventId && item.userId === userId ? { ...item, active: !item.active } : item))
    : [{ eventId, userId, active: true, watchedAt: DATA_AS_OF_LABEL, seenIds: null }, ...rows]
  saveEventWatches(next)
  return next
}

export function markEventSeen(eventId: string, userId: string, seenIds: string[]) {
  const next = loadEventWatches().map((item) => (
    item.eventId === eventId && item.userId === userId ? { ...item, seenIds } : item
  ))
  saveEventWatches(next)
  return next
}

export function loadTopicFollows(): TopicFollow[] {
  return readJson<TopicFollow[]>(TOPICS_KEY, [])
}

export function saveTopicFollows(rows: TopicFollow[]) {
  writeJson(TOPICS_KEY, rows)
}

export function loadEventFollows(): EventFollow[] {
  return visibleLeads()
    .filter((lead) => lead.eventId)
    .map((lead) => ({
      eventId: lead.eventId ?? '',
      eventName: lead.title,
      materialIds: lead.articles.map((item) => item.articleId),
      note: lead.notes,
      analysisRef: lead.analysisRefs[0]?.key ?? null,
      updatedAt: lead.updatedAt,
    }))
}

export function saveEventFollow(row: EventFollow) {
  followEvent({
    eventId: row.eventId,
    eventName: row.eventName,
    articleIds: row.materialIds,
    entry: 'legacy',
    note: row.note,
    analysisKey: row.analysisRef,
  })
  return loadEventFollows()
}

export function updateEventNote(eventId: string, note: string) {
  const lead = findLeadByEvent(eventId)
  if (lead) saveNotes(lead.id, note)
  return loadEventFollows()
}

export function loadKeywords(): string[] {
  const stored = readJson<string[] | null>(KEYWORDS_KEY, null)
  return stored ?? [...WATCH_KEYWORDS]
}

export function saveKeywords(words: string[]) {
  writeJson(KEYWORDS_KEY, words)
}

export function demoBatchLoaded(): boolean {
  return localStorage.getItem(BATCH_KEY) === '1'
}

export function markDemoBatchLoaded() {
  localStorage.setItem(BATCH_KEY, '1')
}

export function loadViewState(): Partial<HotViewState> | null {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY)
    return raw ? (JSON.parse(raw) as Partial<HotViewState>) : null
  } catch {
    return null
  }
}

export function saveViewState(state: HotViewState) {
  sessionStorage.setItem(VIEW_KEY, JSON.stringify(state))
}

export function loadProgressCache(): ProgressCacheRecord[] {
  return readJson(PROGRESS_KEY, [])
}

export function upsertProgressCache(record: ProgressCacheRecord) {
  const scope = record.scope ?? 'later'
  const rows = loadProgressCache().filter((item) => !(item.eventId === record.eventId && (item.scope ?? 'later') === scope))
  rows.unshift({ ...record, scope })
  writeJson(PROGRESS_KEY, rows.slice(0, 24))
}

export function loadExplainCache(): ProgressCacheRecord[] {
  return readJson(EXPLAIN_KEY, [])
}

export function upsertExplainCache(record: ProgressCacheRecord) {
  const rows = loadExplainCache().filter((item) => item.key !== record.key)
  rows.unshift(record)
  writeJson(EXPLAIN_KEY, rows.slice(0, 20))
}

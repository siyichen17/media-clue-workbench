import { MEDIA, mediaById } from '../data/demo/catalog.ts'
import { DATA_AS_OF } from './dates.ts'

const SOURCE_KEY = 'clue-data-sources-v1'
const RULE_KEY = 'clue-alert-rules-v1'
const ALERT_KEY = 'clue-alert-records-v1'
const SETTINGS_KEY = 'clue-system-settings-v1'
const AUDIT_KEY = 'clue-audit-log-v1'
const TARGET_KEY = 'clue-kpi-targets-v1'
const CATALOG_KEY = 'clue-catalog-overlay-v1'

export type SourceMethod = 'pending' | 'file' | 'api'
export type SourceStatus = 'pending' | 'disabled'

export interface SourceTask {
  id: string
  at: string
  action: string
  result: string
  demo: boolean
  added: number
}

export interface DataSource {
  id: string
  name: string
  type: '报纸' | '客户端' | '网站' | '热榜'
  ownerName: string
  mediaId: string | null
  scope: string
  method: SourceMethod
  enabled: boolean
  tasks: SourceTask[]
}

export type AlertKind = 'topic_news' | 'peer_news' | 'hot_rank' | 'source_fail'

export interface AlertRule {
  id: string
  name: string
  kind: AlertKind
  enabled: boolean
  mediaId: string | null
  topicId: string | null
  eventId: string | null
  rankEnter: number | null
  rankRise: number | null
  sourceId: string | null
  baselineAt: string
  createdAt: string
}

export interface AlertRecord {
  id: string
  ruleId: string
  title: string
  kind: AlertKind
  objectLabel: string
  triggerAt: string
  severity: '一般' | '重要'
  status: 'open' | 'done' | 'ignored'
  read: boolean
  note: string
  why: string
  numbers: string
  href: string
}

export interface SystemSettings {
  systemName: string
  home: 'overview' | 'hot' | 'compete' | 'leads'
  timezone: 'Asia/Shanghai' | 'UTC'
  density: 'comfortable' | 'compact'
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  object: string
  action: string
  result: string
}

export interface CatalogOverlay {
  categories: Record<string, { name?: string; description?: string; disabled?: boolean }>
  topics: Record<string, { name?: string; description?: string; disabled?: boolean }>
}

const DEFAULT_SETTINGS: SystemSettings = {
  systemName: '全网线索',
  home: 'overview',
  timezone: 'Asia/Shanghai',
  density: 'comfortable',
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function methodLabel(method: SourceMethod) {
  if (method === 'api') return '接口'
  if (method === 'file') return '文件导入'
  return '待接入'
}

export function sourceStatus(source: DataSource): SourceStatus {
  return source.enabled ? 'pending' : 'disabled'
}

export function statusLabel(status: SourceStatus) {
  return status === 'disabled' ? '已停用' : '待接入'
}

export function kindLabel(kind: AlertKind) {
  if (kind === 'topic_news') return '关注对象新增报道'
  if (kind === 'peer_news') return '指定同行新报道'
  if (kind === 'hot_rank') return '热榜名次'
  return '数据源任务失败'
}

function seedSources(): DataSource[] {
  const rows: DataSource[] = []
  for (const media of MEDIA) {
    media.columns.forEach((column, index) => {
      rows.push({
        id: `src-${media.id}-${index}`,
        name: column,
        type: index === 0 ? '报纸' : '网站',
        ownerName: media.name,
        mediaId: media.id,
        scope: column,
        method: 'pending',
        enabled: true,
        tasks: [],
      })
    })
  }
  rows.push(
    {
      id: 'src-hot-weibo',
      name: '微博热搜榜',
      type: '热榜',
      ownerName: '微博',
      mediaId: null,
      scope: '热搜榜',
      method: 'pending',
      enabled: true,
      tasks: [],
    },
    {
      id: 'src-hot-baidu',
      name: '百度热搜榜',
      type: '热榜',
      ownerName: '百度',
      mediaId: null,
      scope: '热搜榜',
      method: 'pending',
      enabled: true,
      tasks: [],
    },
  )
  return rows
}

export function loadSources(): DataSource[] {
  const saved = readJson<DataSource[]>(SOURCE_KEY)
  if (saved) return saved
  const seeded = seedSources()
  writeJson(SOURCE_KEY, seeded)
  return seeded
}

export function saveSources(rows: DataSource[]) {
  writeJson(SOURCE_KEY, rows)
}

export function loadRules(): AlertRule[] {
  return readJson<AlertRule[]>(RULE_KEY) ?? []
}

export function saveRules(rows: AlertRule[]) {
  writeJson(RULE_KEY, rows)
}

export function loadAlertRecords(): AlertRecord[] {
  return readJson<AlertRecord[]>(ALERT_KEY) ?? []
}

export function saveAlertRecords(rows: AlertRecord[]) {
  writeJson(ALERT_KEY, rows)
}

export function loadSettings(): SystemSettings {
  return { ...DEFAULT_SETTINGS, ...(readJson<Partial<SystemSettings>>(SETTINGS_KEY) ?? {}) }
}

export function saveSettings(next: SystemSettings) {
  writeJson(SETTINGS_KEY, next)
}

export function loadAudit(): AuditEntry[] {
  return readJson<AuditEntry[]>(AUDIT_KEY) ?? []
}

export function recordAudit(entry: Omit<AuditEntry, 'id' | 'at' | 'actor'>) {
  const rows = loadAudit()
  rows.unshift({
    id: `audit-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    actor: 'local-demo',
    ...entry,
  })
  writeJson(AUDIT_KEY, rows.slice(0, 200))
}

export function loadTargets(): Record<string, number | null> {
  return readJson<Record<string, number | null>>(TARGET_KEY) ?? {}
}

export function saveTargets(next: Record<string, number | null>) {
  writeJson(TARGET_KEY, next)
}

export function loadCatalogOverlay(): CatalogOverlay {
  return readJson<CatalogOverlay>(CATALOG_KEY) ?? { categories: {}, topics: {} }
}

export function saveCatalogOverlay(next: CatalogOverlay) {
  writeJson(CATALOG_KEY, next)
}

export function mediaName(id: string | null) {
  if (!id) return '—'
  return mediaById[id]?.name ?? id
}

export const DATA_WATERMARK = DATA_AS_OF

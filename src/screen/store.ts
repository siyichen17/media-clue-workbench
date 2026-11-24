import { DATA_AS_OF } from '../lib/dates.ts'
import { currentActor } from '../lib/leads.ts'
import { applyAuto, preferredPreset } from './layout.ts'
import { readLayoutNode } from './partition.ts'
import { resolveAppearance } from './theme.ts'
import { SCREEN_COLS, SCREEN_OWNER, SCREEN_ROWS, SCREEN_SCHEMA, defaultDisplay, defaultPresentation, defaultScope, widgetSpec, type LayoutBaseline, type LayoutMode, type LayoutPreset, type MetricKind, type ScreenTemplate, type ScreenWidget, type WidgetKind, type WidgetRole } from './types.ts'

const KEY = 'clue-screen-templates-v1'
const DEFAULT_KEY = 'clue-screen-default-v1'
const LAST_VIEW_KEY = 'clue-screen-open-v1'
const DRAFT_PREFIX = 'clue-screen-draft:'

function newsSituation(): ScreenTemplate {
  const now = '2026-11-10T10:00:00.000Z'
  const placed: [string, WidgetKind, WidgetRole, number, string, number, number, number, number][] = [
    ['map', 'map', 'primary', 0, '新闻地域地图', 25.5, 0.45, 49, 99.1],
    ['hot', 'hotBoard', 'secondary', 0, '平台热搜', 0.45, 0.45, 24.2, 47.2],
    ['bubbles', 'bubbles', 'secondary', 1, '主题报道分布', 0.45, 48.4, 24.2, 51.15],
    ['news', 'newsList', 'secondary', 2, '焦点新闻', 75.35, 0.45, 24.2, 51.15],
    ['trend', 'trend', 'secondary', 3, '报道变化', 75.35, 52.4, 24.2, 47.15],
  ]
  return {
    schemaVersion: SCREEN_SCHEMA,
    templateId: 'national',
    ownerId: SCREEN_OWNER,
    name: '新闻线索态势',
    sourceTemplateId: null,
    system: true,
    canvas: { cols: SCREEN_COLS, rows: SCREEN_ROWS },
    globalFilters: defaultScope(),
    linkFilters: true,
    theme: 'monitor-dark',
    layoutPreset: 'mapCenter',
    layoutMode: 'generated',
    layoutRecipeId: 'center',
    primaryWidgetId: 'map',
    presentation: defaultPresentation(),
    selectedMetrics: ['newsCount', 'eventCount', 'mediaCount'],
    widgets: placed.map(([id, type, role, order, title, x, y, w, h]) => ({ ...widget(id, type, role, order, title), x, y, w, h })),
    createdAt: now,
    updatedAt: now,
  }
}

function widget(id: string, type: WidgetKind, role: WidgetRole, order: number, title: string): ScreenWidget {
  return {
    id,
    type,
    role,
    order,
    x: 0,
    y: 0,
    w: 30,
    h: 30,
    title,
    followGlobal: true,
    scope: defaultScope(),
    display: defaultDisplay(),
  }
}

function base(id: string, name: string, widgets: ScreenWidget[], metrics: MetricKind[], preset: LayoutPreset): ScreenTemplate {
  const now = '2026-11-10T10:00:00.000Z'
  const draft: ScreenTemplate = {
    schemaVersion: SCREEN_SCHEMA,
    templateId: id,
    ownerId: SCREEN_OWNER,
    name,
    sourceTemplateId: null,
    system: true,
    canvas: { cols: SCREEN_COLS, rows: SCREEN_ROWS },
    globalFilters: defaultScope(),
    linkFilters: true,
    theme: 'monitor-dark',
    layoutPreset: preset,
    layoutMode: 'auto',
    presentation: defaultPresentation(),
    selectedMetrics: metrics,
    widgets,
    createdAt: now,
    updatedAt: now,
  }
  const laid = applyAuto(draft)
  return laid.ok ? laid.template : draft
}

export const BUILTIN_IDS = ['national', 'overview', 'competitor', 'hottopic'] as const

export const SYSTEM_TEMPLATES: ScreenTemplate[] = [
  newsSituation(),
  base('overview', '线索总览', [
    widget('map', 'map', 'primary', 0, '新闻地域地图'),
    widget('rank', 'eventRank', 'secondary', 0, '热点事件榜'),
    widget('news', 'newsList', 'secondary', 1, '相关新闻'),
    widget('bubbles', 'bubbles', 'secondary', 2, '话题气泡'),
    widget('trend', 'trend', 'secondary', 3, '报道趋势'),
  ], ['newsCount', 'eventCount', 'regionCount'], 'mapCenter'),
  base('competitor', '竞品分析', [
    widget('peers', 'peers', 'primary', 0, '同行报道对比'),
    widget('sources', 'sources', 'secondary', 0, '来源机构分布'),
    widget('trend', 'trend', 'secondary', 1, '报道趋势'),
    widget('news', 'newsList', 'secondary', 2, '相关新闻'),
  ], ['newsCount', 'mediaCount', 'eventCount'], 'leftFocus'),
  base('hottopic', '热搜追踪', [
    widget('hot', 'hotBoard', 'primary', 0, '平台热搜榜'),
    widget('rank', 'eventRank', 'secondary', 0, '热点事件榜'),
    widget('bubbles', 'bubbles', 'secondary', 1, '话题气泡'),
    widget('trend', 'trend', 'secondary', 2, '报道趋势'),
  ], ['newsCount', 'hotEventCount', 'eventCount'], 'leftFocus'),
]

function readUser(): ScreenTemplate[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw && !localStorage.getItem(`${KEY}-backup`)) localStorage.setItem(`${KEY}-backup`, raw)
    const rows = raw ? (JSON.parse(raw) as unknown[]) : []
    return Array.isArray(rows) ? rows.map((item) => normalizeTemplate(item)).filter((item): item is ScreenTemplate => Boolean(item)) : []
  } catch {
    return []
  }
}

function writeUser(rows: ScreenTemplate[]) {
  localStorage.setItem(KEY, JSON.stringify(rows))
}

export function normalizeTemplate(value: unknown): ScreenTemplate | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<ScreenTemplate>
  if (!raw.templateId || !raw.name) return null
  const scope = { ...defaultScope(), ...(raw.globalFilters ?? {}) }
  const migrated = migrateWidgets(raw.widgets)
  const selectedMetrics = Array.isArray(raw.selectedMetrics) && raw.selectedMetrics.length ? raw.selectedMetrics.filter(isMetric) : migrated.metrics
  const widgets = migrated.widgets
  const legacy = raw.schemaVersion !== SCREEN_SCHEMA || migrated.legacy
  const draft: ScreenTemplate = {
    schemaVersion: SCREEN_SCHEMA,
    templateId: raw.templateId,
    ownerId: raw.ownerId || SCREEN_OWNER,
    name: raw.name,
    sourceTemplateId: raw.sourceTemplateId ?? null,
    system: Boolean(raw.system),
    canvas: { cols: SCREEN_COLS, rows: SCREEN_ROWS },
    globalFilters: scope,
    linkFilters: raw.linkFilters !== false,
    theme: 'monitor-dark',
    layoutPreset: isPreset(raw.layoutPreset) ? raw.layoutPreset : preferredPreset(widgets),
    layoutMode: keptMode(raw.layoutMode, legacy),
    presentation: { ...defaultPresentation(), ...(raw.presentation ?? {}) },
    appearance: resolveAppearance({ appearance: raw.appearance, presentation: { ...defaultPresentation(), ...(raw.presentation ?? {}) } }),
    layoutEngine: typeof raw.layoutEngine === 'number' ? raw.layoutEngine : undefined,
    gridVersion: raw.gridVersion === 1 ? 1 : undefined,
    partition: readLayoutNode(raw.partition),
    focusSize: raw.focusSize === 'standard' || raw.focusSize === 'large' || raw.focusSize === 'xlarge' ? raw.focusSize : undefined,
    focusPlace: raw.focusPlace === 'left' || raw.focusPlace === 'top' || raw.focusPlace === 'center' ? raw.focusPlace : undefined,
    tuned: raw.tuned === true ? true : undefined,
    layoutRecipeId: typeof raw.layoutRecipeId === 'string' ? raw.layoutRecipeId : undefined,
    primaryWidgetId: typeof raw.primaryWidgetId === 'string' ? raw.primaryWidgetId : widgets.find((item) => item.role === 'primary')?.id ?? null,
    layoutBaseline: readBaseline(raw.layoutBaseline),
    selectedMetrics: selectedMetrics.slice(0, 4),
    widgets,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  }
  if (draft.layoutMode === 'manual' || draft.layoutMode === 'generated') return draft
  const laid = applyAuto(draft)
  return laid.ok ? laid.template : draft
}

const LEGACY_KIND: Record<string, WidgetKind> = {
  daily: 'trend', bubbles: 'bubbles', media: 'sources', hot: 'hotBoard', news: 'newsList', peers: 'peers',
  map: 'map', eventRank: 'eventRank', hotBoard: 'hotBoard', trend: 'trend', newsList: 'newsList', sources: 'sources',
  coverage: 'coverage', progress: 'progress', hourly: 'hourly',
}
const LEGACY_METRIC: Record<string, MetricKind> = {
  newsCount: 'newsCount', eventCount: 'eventCount', hotEvents: 'hotEventCount', mediaCount: 'mediaCount', regionCount: 'regionCount',
}

function isMetric(value: unknown): value is MetricKind {
  return value === 'newsCount' || value === 'eventCount' || value === 'regionCount' || value === 'mediaCount' || value === 'hotEventCount'
}

function isPreset(value: unknown): value is LayoutPreset {
  return value === 'mapCenter' || value === 'leftFocus' || value === 'dualFocus' || value === 'topFocus'
}

function keptMode(value: unknown, legacy: boolean): LayoutMode {
  if (legacy) return value === 'manual' ? 'manual' : 'auto'
  if (value === 'manual' || value === 'generated') return value
  return 'auto'
}

function readBaseline(value: unknown): LayoutBaseline | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Partial<LayoutBaseline>
  if (!raw.recipeId || !Array.isArray(raw.boxes)) return undefined
  const boxes = raw.boxes.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const box = item as LayoutBaseline['boxes'][number]
    if (!box.id || (box.role !== 'primary' && box.role !== 'secondary')) return []
    return [{
      id: box.id,
      x: Number(box.x) || 0,
      y: Number(box.y) || 0,
      w: Number(box.w) || 0,
      h: Number(box.h) || 0,
      role: box.role,
      ...(typeof box.variantId === 'string' ? { variantId: box.variantId } : {}),
      ...(Number.isInteger(box.col) ? { col: box.col } : {}),
      ...(Number.isInteger(box.row) ? { row: box.row } : {}),
    }]
  })
  if (!boxes.length) return undefined
  const partition = readLayoutNode(raw.partition)
  return {
    recipeId: raw.recipeId,
    boxes,
    ...(partition ? { partition } : {}),
    ...(raw.focusSize === 'standard' || raw.focusSize === 'large' || raw.focusSize === 'xlarge' ? { focusSize: raw.focusSize } : {}),
    ...(raw.focusPlace === 'left' || raw.focusPlace === 'top' || raw.focusPlace === 'center' ? { focusPlace: raw.focusPlace } : {}),
  }
}

function migrateWidgets(value: unknown) {
  const metrics: MetricKind[] = []
  const widgets: ScreenWidget[] = []
  let legacy = false
  if (!Array.isArray(value)) return { widgets, metrics, legacy }
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return
    const raw = item as Partial<ScreenWidget> & { type?: string }
    const metric = LEGACY_METRIC[String(raw.type)]
    if (metric && !raw.role) { metrics.push(metric); legacy = true; return }
    const type = LEGACY_KIND[String(raw.type)]
    if (!type) { legacy = true; return }
    if (!raw.role) legacy = true
    const spec = widgetSpec(type)
    widgets.push({
      id: raw.id || `widget-${index}`,
      type,
      role: raw.role === 'primary' || raw.role === 'secondary' ? raw.role : widgets.some((widget) => widget.role === 'primary') ? 'secondary' : 'primary',
      order: Number(raw.order) || widgets.length,
      x: Number(raw.x) || 0,
      y: Number(raw.y) || 0,
      w: Number(raw.w) || 30,
      h: Number(raw.h) || 30,
      title: raw.title || spec?.name || '组件',
      followGlobal: raw.followGlobal !== false,
      scope: { ...defaultScope(), ...(raw.scope ?? {}) },
      display: { ...defaultDisplay(), ...(raw.display ?? {}) },
      ...(typeof raw.variantId === 'string' ? { variantId: raw.variantId } : {}),
      ...(Number.isInteger(raw.col) ? { col: raw.col } : {}),
      ...(Number.isInteger(raw.row) ? { row: raw.row } : {}),
    })
  })
  return { widgets, metrics: [...new Set(metrics)].slice(0, 4), legacy }
}

export function listTemplates() {
  const owner = currentActor() || SCREEN_OWNER
  return { system: SYSTEM_TEMPLATES, mine: readUser().filter((item) => item.ownerId === owner && !item.system) }
}

export function getTemplate(id: string): ScreenTemplate | null {
  return SYSTEM_TEMPLATES.find((item) => item.templateId === id) ?? readUser().find((item) => item.templateId === id) ?? null
}

export function rememberScreen(id: string) {
  try { sessionStorage.setItem(LAST_VIEW_KEY, id) } catch { /* 记不住时仍按内置模板打开 */ }
}

export function lastScreenId() {
  try {
    const id = sessionStorage.getItem(LAST_VIEW_KEY)
    return id && getTemplate(id) ? id : null
  } catch {
    return null
  }
}

function nextCopyId() {
  const current = Number(localStorage.getItem('clue-screen-seq') || '1')
  localStorage.setItem('clue-screen-seq', String(current + 1))
  return `scr-${current.toString(36)}`
}

export function isBuiltin(id: string) {
  return BUILTIN_IDS.includes(id as (typeof BUILTIN_IDS)[number]) || id.startsWith('sys-')
}

/** 内置模板第一次保存生成个人副本；之后保存更新同一条，不重复建模板。 */
export function saveDashboard(currentId: string, draft: ScreenTemplate): { ok: true; template: ScreenTemplate; created: boolean } | { ok: false; error: string } {
  const creating = isBuiltin(currentId) || !readUser().some((item) => item.templateId === currentId)
  const templateId = creating ? nextCopyId() : currentId
  const stored = readUser().find((item) => item.templateId === templateId)
  const next: ScreenTemplate = {
    ...draft,
    schemaVersion: SCREEN_SCHEMA,
    templateId,
    ownerId: currentActor() || SCREEN_OWNER,
    system: false,
    sourceTemplateId: creating ? currentId : draft.sourceTemplateId,
    canvas: { cols: SCREEN_COLS, rows: SCREEN_ROWS },
    createdAt: stored?.createdAt || DATA_AS_OF,
    updatedAt: DATA_AS_OF,
  }
  try {
    const rows = readUser().filter((item) => item.templateId !== templateId)
    rows.unshift(next)
    writeUser(rows)
    const written = localStorage.getItem(KEY)
    if (!written || !written.includes(templateId)) return { ok: false, error: '保存失败，草稿还在。' }
    return { ok: true, template: next, created: creating }
  } catch {
    return { ok: false, error: '保存失败，草稿还在。请减少内容后重试。' }
  }
}

export function saveTemplate(template: ScreenTemplate): { ok: true } | { ok: false; error: string } {
  const result = saveDashboard(template.system ? template.templateId : template.templateId, { ...template, system: false })
  return result.ok ? { ok: true } : result
}

export function deleteTemplate(id: string) {
  writeUser(readUser().filter((item) => item.templateId !== id))
  if (loadDefaultId() === id) localStorage.removeItem(DEFAULT_KEY)
}

export function loadDefaultId() {
  return localStorage.getItem(DEFAULT_KEY)
}

export function saveDefaultId(id: string | null) {
  if (!id) localStorage.removeItem(DEFAULT_KEY)
  else localStorage.setItem(DEFAULT_KEY, id)
}

export function cloneTemplate(source: ScreenTemplate, name: string): ScreenTemplate {
  const id = `scr-${Date.now().toString(36)}`
  const now = new Date().toISOString()
  return {
    ...structuredClone(source),
    templateId: id,
    name,
    system: false,
    ownerId: SCREEN_OWNER,
    sourceTemplateId: source.templateId,
    createdAt: now,
    updatedAt: now,
    widgets: source.widgets.map((item) => ({ ...item, id: `${item.id}-${id.slice(-4)}` })),
  }
}

export function readDraft(id: string): ScreenTemplate | null {
  try {
    const raw = sessionStorage.getItem(`${DRAFT_PREFIX}${id}`)
    return raw ? normalizeTemplate(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function writeDraft(template: ScreenTemplate) {
  sessionStorage.setItem(`${DRAFT_PREFIX}${template.templateId}`, JSON.stringify(template))
}

export function clearDraft(id: string) {
  sessionStorage.removeItem(`${DRAFT_PREFIX}${id}`)
}

import type { DatePreset } from '../types/domain.ts'
import type { DashboardAppearance } from './theme.ts'

export const SCREEN_SCHEMA = 2
export const SCREEN_COLS = 24
export const SCREEN_ROWS = 24
export const SCREEN_OWNER = 'local-demo'

export type WidgetKind = 'map' | 'eventRank' | 'hotBoard' | 'bubbles' | 'trend' | 'newsList' | 'peers' | 'sources' | 'coverage' | 'progress' | 'hourly'
export type WidgetGroup = 'discover' | 'change' | 'peer'
export type MetricKind = 'newsCount' | 'eventCount' | 'regionCount' | 'mediaCount' | 'hotEventCount'
export type LayoutPreset = 'mapCenter' | 'leftFocus' | 'dualFocus' | 'topFocus'
export type LayoutMode = 'auto' | 'generated' | 'manual'
export type WidgetRole = 'primary' | 'secondary'
export type WidgetFlow = 'wide' | 'tall' | 'map'

export interface ScreenScope {
  preset: DatePreset
  customStart: string
  customEnd: string
  categoryId: string
  mediaId: string
  topicId: string
  platform: string
  hotPlatform: '微博' | '百度'
  eventId: string
  /** 空数组表示沿用当前监控媒体，不表示“没有任何媒体”。 */
  mediaIds?: string[]
  /** auto：材料集中在一个省时用该省地图，否则用全国。 */
  mapScope?: 'auto' | 'china' | 'sichuan'
  mapMetric?: 'eventCount' | 'articleCount'
  /** 指定后焦点新闻固定这一篇，不再轮播。 */
  focusArticleId?: string
}

export interface PresentationSettings {
  autoplay: boolean
  intervalSeconds: number
  pauseOnHover: boolean
  motionEnabled: boolean
  rotateHotPlatform: boolean
}

export interface WidgetDisplay {
  limit: number
  legend: boolean
  sort: 'latest' | 'count'
  autoPage: boolean
  showTabs: boolean
}

export interface ScreenWidget {
  id: string
  type: WidgetKind
  role: WidgetRole
  order: number
  x: number
  y: number
  w: number
  h: number
  title: string
  followGlobal: boolean
  scope: ScreenScope
  display: WidgetDisplay
  unknownType?: string
  /** 网格档位。缺省表示仍按原来的百分比坐标显示。 */
  variantId?: string
  col?: number
  row?: number
}

export type LayoutNode =
  | { type: 'widget'; widgetId: string }
  | { type: 'split'; direction: 'horizontal' | 'vertical'; ratios: number[]; children: LayoutNode[] }

export interface LayoutBox {
  id: string
  x: number
  y: number
  w: number
  h: number
  role: WidgetRole
  variantId?: string
  col?: number
  row?: number
}

/** 最近一次应用的排版位置。恢复时只回到这些位置，不改业务筛选。 */
export interface LayoutBaseline {
  recipeId: string
  boxes: LayoutBox[]
  partition?: LayoutNode
  focusSize?: 'standard' | 'large' | 'xlarge'
  focusPlace?: 'left' | 'top' | 'center'
}

export interface ScreenTemplate {
  schemaVersion: number
  templateId: string
  ownerId: string
  name: string
  sourceTemplateId: string | null
  system: boolean
  canvas: { cols: number; rows: number }
  globalFilters: ScreenScope
  linkFilters: boolean
  theme: 'monitor-dark'
  layoutPreset: LayoutPreset
  layoutMode: LayoutMode
  /** 生成这套坐标时使用的排版算法。缺省表示旧模板，只按已存坐标显示。 */
  layoutEngine?: number
  layoutRecipeId?: string
  primaryWidgetId?: string | null
  layoutBaseline?: LayoutBaseline
  selectedMetrics: MetricKind[]
  presentation?: PresentationSettings
  /** 缺省或无法识别时按深海科技显示，不改已存坐标。 */
  appearance?: DashboardAppearance
  /** 1 表示已经按统一网格保存。缺省的旧模板不自动迁移。 */
  gridVersion?: number
  /** 分区树。有它时坐标由树计算，旧的百分比只作回退。 */
  partition?: LayoutNode
  focusSize?: 'standard' | 'large' | 'xlarge'
  focusPlace?: 'left' | 'top' | 'center'
  /** 用户拖过共享分隔线后为 true，打开时沿用保存的比例。 */
  tuned?: boolean
  widgets: ScreenWidget[]
  createdAt: string
  updatedAt: string
}

export interface WidgetSpec {
  type: WidgetKind
  name: string
  purpose: string
  group?: WidgetGroup
  minW: number
  minH: number
  primary: boolean
  /** 排版时优先给横向空间、纵向空间，或保持地图宽高。 */
  flow: WidgetFlow
}

export const WIDGET_GROUP_LABEL: Record<WidgetGroup, string> = {
  discover: '发现热点',
  change: '观察变化',
  peer: '观察同行',
}

export const WIDGET_SPECS: WidgetSpec[] = [
  { type: 'map', group: 'discover', name: '新闻地域分布', purpose: '按事件发生地看哪些地区已有收录', minW: 28, minH: 42, primary: true, flow: 'map' },
  { type: 'eventRank', group: 'discover', name: '重点事件', purpose: '看最近更新或报道更多的事件', minW: 18, minH: 28, primary: true, flow: 'tall' },
  { type: 'hotBoard', group: 'discover', name: '平台热搜', purpose: '看微博或百度各自的原始榜单', minW: 18, minH: 28, primary: true, flow: 'tall' },
  { type: 'bubbles', group: 'discover', name: '主题报道分布', purpose: '看各主题关联了多少报道', minW: 18, minH: 28, primary: true, flow: 'wide' },
  { type: 'trend', group: 'change', name: '报道变化', purpose: '看报道数量随发布时间怎么变化', minW: 22, minH: 26, primary: true, flow: 'wide' },
  { type: 'progress', group: 'change', name: '事件进展', purpose: '有已保存进展时展示节点；没有则不作为默认项', minW: 18, minH: 28, primary: true, flow: 'tall' },
  { type: 'hourly', group: 'change', name: '24小时报道分布', purpose: '看选定自然日每个小时的报道数', minW: 22, minH: 26, primary: true, flow: 'wide' },
  { type: 'newsList', group: 'change', name: '焦点新闻', purpose: '轮播一条标题、摘要和来源', minW: 18, minH: 28, primary: true, flow: 'tall' },
  { type: 'coverage', group: 'peer', name: '同行报道覆盖', purpose: '看各家媒体分别报道了哪些事件', minW: 28, minH: 32, primary: true, flow: 'wide' },
  { type: 'sources', group: 'peer', name: '来源机构分布', purpose: '看材料来自哪些机构、各有多少篇', minW: 18, minH: 26, primary: true, flow: 'wide' },
  { type: 'peers', name: '同行报道对比', purpose: '旧模板中的媒体报道数对比', minW: 22, minH: 28, primary: true, flow: 'wide' },
]

export function groupedWidgetSpecs() {
  return (['discover', 'change', 'peer'] as const).map((group) => ({
    group,
    label: WIDGET_GROUP_LABEL[group],
    specs: WIDGET_SPECS.filter((item) => item.group === group),
  }))
}

export const METRIC_SPECS: { type: MetricKind; name: string }[] = [
  { type: 'newsCount', name: '已收录报道' },
  { type: 'eventCount', name: '关联事件' },
  { type: 'regionCount', name: '已识别地区' },
  { type: 'mediaCount', name: '涉及媒体' },
  { type: 'hotEventCount', name: '热榜命中事件' },
]

export const LAYOUT_LABEL: Record<LayoutPreset, string> = {
  mapCenter: '地图居中',
  leftFocus: '左侧重点',
  dualFocus: '双重点',
  topFocus: '上方重点',
}

export function widgetSpec(type: string): WidgetSpec | null {
  return WIDGET_SPECS.find((item) => item.type === type) ?? null
}

export function defaultScope(): ScreenScope {
  return {
    preset: '7d',
    customStart: '2026-11-04',
    customEnd: '2026-11-10',
    categoryId: 'all',
    mediaId: 'all',
    topicId: 'all',
    platform: 'all',
    hotPlatform: '微博',
    eventId: '',
  }
}

export function defaultDisplay(): WidgetDisplay {
  return { limit: 8, legend: true, sort: 'latest', autoPage: false, showTabs: false }
}

export function defaultPresentation(): PresentationSettings {
  return { autoplay: true, intervalSeconds: 12, pauseOnHover: true, motionEnabled: true, rotateHotPlatform: false }
}

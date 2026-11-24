export interface ProtoWidgetDef {
  icon: string
  name: string
  type: 'line' | 'bar' | 'pie' | 'heatmap' | 'wordcloud' | 'kpi' | 'table' | 'alert' | 'timeline' | 'map' | 'progress' | 'scrolllist'
}

export const PROTO_WIDGETS: ProtoWidgetDef[] = [
  { icon: '📈', name: '折线图', type: 'line' },
  { icon: '📊', name: '柱状图', type: 'bar' },
  { icon: '🥧', name: '饼图/环形图', type: 'pie' },
  { icon: '🔥', name: '热力图', type: 'heatmap' },
  { icon: '☁', name: '词云', type: 'wordcloud' },
  { icon: '🔢', name: '数字卡片', type: 'kpi' },
  { icon: '📋', name: '数据表格', type: 'table' },
  { icon: '⚠', name: '告警列表', type: 'alert' },
  { icon: '📅', name: '时间线', type: 'timeline' },
  { icon: '🗺', name: '地图', type: 'map' },
  { icon: '📊', name: '进度条', type: 'progress' },
  { icon: '📜', name: '滚动列表', type: 'scrolllist' },
]

export interface CanvasWidget {
  id: string
  type: number
  title: string
  slot: number
}

export interface ProtoSettings {
  refreshInterval: string
  autoRotate: string
  theme: 'deepblue' | 'black' | 'gray'
}

export interface BuiltinTemplate {
  id: string
  name: string
  widgets: { type: number; title: string }[]
  settings: ProtoSettings
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'overview',
    name: '线索总览模板',
    widgets: [
      { type: 5, title: '今日线索量' },
      { type: 5, title: '热搜命中' },
      { type: 5, title: '负面预警' },
      { type: 5, title: '传播影响力' },
      { type: 0, title: '7日趋势' },
      { type: 4, title: '热词云' },
      { type: 1, title: '来源分布' },
      { type: 2, title: '情感分布' },
      { type: 3, title: '24h热力图' },
      { type: 7, title: '实时告警' },
    ],
    settings: { refreshInterval: '60', autoRotate: '10', theme: 'deepblue' },
  },
  {
    id: 'competitor',
    name: '竞品分析模板',
    widgets: [
      { type: 5, title: '监控竞品数' },
      { type: 5, title: '今日发稿' },
      { type: 5, title: '热搜命中' },
      { type: 1, title: '声量对比' },
      { type: 0, title: '趋势图' },
      { type: 6, title: '竞品动态表' },
      { type: 10, title: '完成进度' },
    ],
    settings: { refreshInterval: '60', autoRotate: 'off', theme: 'deepblue' },
  },
  {
    id: 'hottopic',
    name: '热搜追踪模板',
    widgets: [
      { type: 5, title: '热搜总量' },
      { type: 5, title: '新增话题' },
      { type: 5, title: '平台覆盖' },
      { type: 4, title: '热词云' },
      { type: 0, title: '热度趋势' },
      { type: 8, title: '时间线' },
      { type: 6, title: '热搜榜单' },
      { type: 11, title: '实时滚动' },
    ],
    settings: { refreshInterval: '30', autoRotate: '10', theme: 'deepblue' },
  },
]

export function materialize(templateId: string, widgets: { type: number; title: string }[]): CanvasWidget[] {
  return widgets.map((widget, index) => ({
    id: `${templateId}-slot-${index}`,
    type: widget.type,
    title: widget.title,
    slot: index,
  }))
}

export const THEME_BG: Record<ProtoSettings['theme'], string> = {
  deepblue: '#0a0f1e',
  black: '#000000',
  gray: '#1a1a1a',
}

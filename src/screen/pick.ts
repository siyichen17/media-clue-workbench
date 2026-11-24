import { defaultDisplay, defaultScope, widgetSpec, type MetricKind, type ScreenTemplate, type ScreenWidget, type WidgetKind } from './types.ts'

export interface CompositionPick {
  widgets: ScreenWidget[]
  focusId: string | null
  metrics: MetricKind[]
  activeRecipe: string | null
}

export function seedPick(template: ScreenTemplate): CompositionPick {
  const widgets = template.widgets.map((item) => ({ ...item, scope: { ...item.scope }, display: { ...item.display } }))
  return {
    widgets,
    focusId: widgets.find((item) => item.role === 'primary')?.id ?? widgets[0]?.id ?? null,
    metrics: template.selectedMetrics.slice(0, 4),
    activeRecipe: null,
  }
}

export function toggleType(pick: CompositionPick, type: WidgetKind): CompositionPick {
  const existing = pick.widgets.filter((item) => item.type === type)
  if (existing.length) {
    const widgets = pick.widgets.filter((item) => item.type !== type)
    const focusId = widgets.some((item) => item.id === pick.focusId) ? pick.focusId : widgets[0]?.id ?? null
    return { ...pick, widgets, focusId, activeRecipe: null }
  }
  const spec = widgetSpec(type)
  let serial = pick.widgets.length + 1
  let id = `${type}-${serial}`
  while (pick.widgets.some((item) => item.id === id)) {
    serial += 1
    id = `${type}-${serial}`
  }
  const widget: ScreenWidget = {
    id,
    type,
    role: pick.focusId ? 'secondary' : 'primary',
    order: pick.widgets.length,
    x: 0,
    y: 0,
    w: 32,
    h: 36,
    title: spec?.name ?? type,
    followGlobal: true,
    scope: defaultScope(),
    display: defaultDisplay(),
  }
  return { ...pick, widgets: [...pick.widgets, widget], focusId: pick.focusId ?? widget.id, activeRecipe: null }
}

export function removeWidget(pick: CompositionPick, id: string): CompositionPick {
  const widgets = pick.widgets.filter((item) => item.id !== id)
  const focusId = pick.focusId === id ? widgets[0]?.id ?? null : pick.focusId
  return { ...pick, widgets, focusId, activeRecipe: null }
}

export function focusWidget(pick: CompositionPick, id: string): CompositionPick {
  if (!pick.widgets.some((item) => item.id === id)) return pick
  return { ...pick, focusId: id, activeRecipe: null }
}

export function toggleMetric(pick: CompositionPick, kind: MetricKind): { pick: CompositionPick; error: string } {
  const has = pick.metrics.includes(kind)
  if (!has && pick.metrics.length >= 4) return { pick, error: '指标最多选 4 个。' }
  return {
    pick: { ...pick, metrics: has ? pick.metrics.filter((item) => item !== kind) : [...pick.metrics, kind], activeRecipe: null },
    error: '',
  }
}

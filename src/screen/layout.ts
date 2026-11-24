import { widgetSpec, type LayoutPreset, type ScreenTemplate, type ScreenWidget, type WidgetKind } from './types.ts'

export interface LayoutAssessment {
  preset: LayoutPreset
  ok: boolean
  level: 'good' | 'poor' | 'no'
  reason: string
}

const PRESETS: LayoutPreset[] = ['mapCenter', 'leftFocus', 'dualFocus', 'topFocus']

export function assessLayout(preset: LayoutPreset, widgets: ScreenWidget[]): LayoutAssessment {
  const primary = widgets.filter((item) => item.role === 'primary')
  const secondary = widgets.filter((item) => item.role === 'secondary')
  const fail = (reason: string): LayoutAssessment => ({ preset, ok: false, level: 'no', reason })
  if (widgets.length === 0) return fail('还没有组件')
  if (primary.length === 0) return fail('需要先指定重点')
  if (primary.length > 2) return fail('最多两个重点')
  if (preset === 'mapCenter') {
    if (primary.length !== 1 || primary[0]?.type !== 'map') return fail('只有当地图是唯一重点时才能用')
    if (secondary.length > 4) return fail('两侧最多放四个辅助组件')
  }
  if (preset === 'dualFocus' && primary.length !== 2) return fail('需要正好两个重点')
  if ((preset === 'leftFocus' || preset === 'topFocus') && primary.length !== 1) return fail('这个布局只放一个重点')
  if (preset === 'leftFocus' && secondary.length >= 4) return fail('右侧放四个辅助组件后，高度会低于可读下限')
  if (preset === 'dualFocus' && secondary.length > 4) return fail('底部最多放四个辅助组件')
  if (secondary.length === 4 && secondary.some((item) => (widgetSpec(item.type)?.minW ?? 18) > 24)) {
    if (preset === 'dualFocus' || preset === 'topFocus') return fail('四个辅助并排后，宽度低于可读下限')
  }
  const wideList = secondary.some((item) => item.type === 'newsList' || item.type === 'eventRank' || item.type === 'hotBoard')
  if (preset === 'topFocus' && wideList) {
    return { preset, ok: true, level: 'poor', reason: '榜单被横向拉宽后，信息会变稀，更适合左侧重点或地图居中' }
  }
  return { preset, ok: true, level: 'good', reason: '' }
}

export function assessments(widgets: ScreenWidget[]) {
  return PRESETS.map((preset) => assessLayout(preset, widgets))
}

export function preferredPreset(widgets: ScreenWidget[]): LayoutPreset {
  const primary = widgets.filter((item) => item.role === 'primary')
  if (primary.length === 2) return 'dualFocus'
  if (primary.length === 1 && primary[0]?.type === 'map') return 'mapCenter'
  if (primary.length === 1 && (primary[0]?.type === 'trend' || primary[0]?.type === 'peers')) return 'topFocus'
  return 'leftFocus'
}

export function arrange(preset: LayoutPreset, widgets: ScreenWidget[]): ScreenWidget[] {
  const primary = [...widgets.filter((item) => item.role === 'primary')].sort((a, b) => a.order - b.order)
  const secondary = [...widgets.filter((item) => item.role === 'secondary')].sort((a, b) => a.order - b.order)
  const boxes = new Map<string, { x: number; y: number; w: number; h: number }>()
  if (preset === 'mapCenter' && primary[0]) placeMapCenter(boxes, primary[0], secondary)
  else if (preset === 'dualFocus') placeDual(boxes, primary, secondary)
  else if (preset === 'topFocus' && primary[0]) placeTop(boxes, primary[0], secondary)
  else if (primary[0]) placeLeft(boxes, primary[0], secondary)
  return widgets.map((item) => {
    const box = boxes.get(item.id)
    return box ? { ...item, ...box } : item
  })
}

/** 自动布局放得下就用自动布局；放不下时只切开最大的辅助组件，不挪动其他卡片。 */
export function insertWidget(template: ScreenTemplate, widget: ScreenWidget): ScreenTemplate {
  const widgets = [...template.widgets, widget]
  const laid = applyAuto({ ...template, widgets })
  if (laid.ok) return laid.template
  const need = minSize(widget.type)
  const host = [...template.widgets].sort((a, b) => {
    const aFits = a.h - need.h >= minSize(a.type).h ? 1 : 0
    const bFits = b.h - need.h >= minSize(b.type).h ? 1 : 0
    const aSide = a.role === 'secondary' ? 1 : 0
    const bSide = b.role === 'secondary' ? 1 : 0
    return bFits - aFits || bSide - aSide || b.h - a.h
  })[0]
  if (!host) return { ...template, widgets, layoutMode: 'manual' }
  const hostMin = minSize(host.type)
  if (host.h - need.h >= hostMin.h) {
    const h = Math.min(Math.max(need.h, host.h / 2), host.h - hostMin.h)
    return {
      ...template,
      layoutMode: 'manual',
      widgets: [
        ...template.widgets.map((item) => item.id === host.id ? { ...item, h: roundBox(host.h - h) } : item),
        { ...widget, x: host.x, y: roundBox(host.y + host.h - h), w: host.w, h: roundBox(h) },
      ],
    }
  }
  return { ...template, layoutMode: 'manual', widgets }
}

function roundBox(value: number) {
  return Math.round(value * 100) / 100
}

export function applyAuto(template: ScreenTemplate): { ok: true; template: ScreenTemplate } | { ok: false; reason: string } {
  const verdict = assessLayout(template.layoutPreset, template.widgets)
  if (!verdict.ok) return { ok: false, reason: verdict.reason }
  return { ok: true, template: { ...template, layoutMode: 'auto', widgets: arrange(template.layoutPreset, template.widgets) } }
}

export function fillAfterRemove(widgets: ScreenWidget[], removed: ScreenWidget): ScreenWidget[] {
  const rest = widgets.filter((item) => item.id !== removed.id)
  const neighbor = rest
    .map((item) => ({ item, shared: sharedLength(item, removed) }))
    .filter((entry) => entry.shared > 0)
    .sort((a, b) => b.shared - a.shared)[0]?.item
  if (!neighbor) return rest
  const merged = unionBox(neighbor, removed)
  return rest.map((item) => item.id === neighbor.id ? { ...item, ...merged } : item)
}

function placeMapCenter(boxes: Map<string, Box>, primary: ScreenWidget, secondary: ScreenWidget[]) {
  if (secondary.length === 0) {
    boxes.set(primary.id, gap(0, 0, 100, 100))
    return
  }
  if (secondary.map((item) => item.type).join(',') === 'eventRank,hotBoard,bubbles,trend') {
    placeNational(boxes, primary, secondary)
    return
  }
  const leftCount = secondary.length <= 2 ? secondary.length : Math.ceil(secondary.length / 2)
  const left = secondary.slice(0, leftCount)
  const right = secondary.slice(leftCount)
  const leftW = 24
  const rightW = right.length ? 24 : 0
  const centerW = 100 - leftW - rightW
  splitColumn(boxes, left, 0, leftW)
  boxes.set(primary.id, gap(leftW, 0, centerW, 100))
  if (right.length) splitColumn(boxes, right, leftW + centerW, rightW)
}

function placeNational(boxes: Map<string, Box>, primary: ScreenWidget, secondary: ScreenWidget[]) {
  const [events, hot, bubbles, trend] = secondary
  const leftW = 26.54
  const gapX = 0.855
  const centerX = leftW + gapX
  const centerW = 45.21
  const rightX = centerX + centerW + gapX
  const rightW = 26.54
  boxes.set(primary.id, { x: centerX, y: 0, w: centerW, h: 100 })
  if (events) boxes.set(events.id, { x: 0, y: 0, w: leftW, h: 56.25 })
  if (hot) boxes.set(hot.id, { x: 0, y: 58.25, w: leftW, h: 41.75 })
  if (bubbles) boxes.set(bubbles.id, { x: rightX, y: 0, w: rightW, h: 48.75 })
  if (trend) boxes.set(trend.id, { x: rightX, y: 50.75, w: rightW, h: 49.25 })
}

function placeLeft(boxes: Map<string, Box>, primary: ScreenWidget, secondary: ScreenWidget[]) {
  if (secondary.length === 0) {
    boxes.set(primary.id, gap(0, 0, 100, 100))
    return
  }
  boxes.set(primary.id, gap(0, 0, 60, 100))
  splitColumn(boxes, secondary, 60, 40)
}

function placeTop(boxes: Map<string, Box>, primary: ScreenWidget, secondary: ScreenWidget[]) {
  if (secondary.length === 0) {
    boxes.set(primary.id, gap(0, 0, 100, 100))
    return
  }
  boxes.set(primary.id, gap(0, 0, 100, 62))
  splitRow(boxes, secondary, 62, 38)
}

function placeDual(boxes: Map<string, Box>, primary: ScreenWidget[], secondary: ScreenWidget[]) {
  const top = secondary.length ? 64 : 100
  primary.forEach((item, index) => {
    const width = 100 / Math.max(primary.length, 1)
    boxes.set(item.id, gap(index * width, 0, width, top))
  })
  if (secondary.length) splitRow(boxes, secondary, top, 100 - top)
}

function splitColumn(boxes: Map<string, Box>, items: ScreenWidget[], x: number, w: number) {
  const h = 100 / items.length
  items.forEach((item, index) => boxes.set(item.id, gap(x, index * h, w, h)))
}

function splitRow(boxes: Map<string, Box>, items: ScreenWidget[], y: number, h: number) {
  const w = 100 / items.length
  items.forEach((item, index) => boxes.set(item.id, gap(index * w, y, w, h)))
}

interface Box { x: number; y: number; w: number; h: number }

function gap(x: number, y: number, w: number, h: number): Box {
  const inset = 0.45
  return { x: x + inset, y: y + inset, w: Math.max(1, w - inset * 2), h: Math.max(1, h - inset * 2) }
}

function sharedLength(item: ScreenWidget, hole: ScreenWidget) {
  const vertical = Math.min(item.y + item.h, hole.y + hole.h) - Math.max(item.y, hole.y)
  const horizontal = Math.min(item.x + item.w, hole.x + hole.w) - Math.max(item.x, hole.x)
  const touchesX = Math.abs(item.x + item.w - hole.x) < 2 || Math.abs(hole.x + hole.w - item.x) < 2
  const touchesY = Math.abs(item.y + item.h - hole.y) < 2 || Math.abs(hole.y + hole.h - item.y) < 2
  if (touchesX && vertical > 0) return vertical
  if (touchesY && horizontal > 0) return horizontal
  return 0
}

function unionBox(item: ScreenWidget, hole: ScreenWidget): Box {
  const x = Math.min(item.x, hole.x)
  const y = Math.min(item.y, hole.y)
  return { x, y, w: Math.max(item.x + item.w, hole.x + hole.w) - x, h: Math.max(item.y + item.h, hole.y + hole.h) - y }
}

export function minSize(type: WidgetKind) {
  const spec = widgetSpec(type)
  return { w: spec?.minW ?? 18, h: spec?.minH ?? 26 }
}

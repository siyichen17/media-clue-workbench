import { minSize } from './layout.ts'
import { shapeViolation } from './shape.ts'
import { planPartitions } from './partition.ts'
import type { FocusPlace, FocusSize } from './partition.ts'
import type { LayoutNode } from './types.ts'
import { variantById } from './slots.ts'
import type { LayoutBaseline, ScreenWidget, WidgetKind } from './types.ts'

export const LAYOUT_ENGINE = 5

export interface LayoutCandidate {
  id: string
  name: string
  family: string
  focusId: string
  focusTitle: string
  widgets: ScreenWidget[]
  score: number
  place?: FocusPlace
  size?: FocusSize
  tree?: LayoutNode
}

export interface LayoutPlan {
  candidates: LayoutCandidate[]
  more: LayoutCandidate[]
  reason: string
}

export interface ValidationResult {
  ok: boolean
  reason: string
}

interface Box { x: number; y: number; w: number; h: number }

export function generateLayoutCandidates(widgets: ScreenWidget[], focusId: string | null): LayoutPlan {
  return planPartitions(widgets, focusId)
}

export function validateLayout(widgets: ScreenWidget[], focusId: string | null): ValidationResult {
  if (widgets.length === 0) return { ok: false, reason: '还没有组件' }
  const ids = widgets.map((item) => item.id)
  if (new Set(ids).size !== ids.length) return { ok: false, reason: '同一个组件出现了两次' }
  const focus = widgets.find((item) => item.id === focusId)
  if (!focus) return { ok: false, reason: '没有重点组件' }
  const primaries = widgets.filter((item) => item.role === 'primary')
  if (primaries.length !== 1 || primaries[0]?.id !== focus.id) return { ok: false, reason: '重点组件没有放在主位' }
  for (const item of widgets) {
    const min = minSize(item.type)
    if (item.x < -0.05 || item.y < -0.05 || item.x + item.w > 100.05 || item.y + item.h > 100.05) {
      return { ok: false, reason: `「${item.title}」超出了画布` }
    }
    const designed = variantById(item.type, item.variantId, item.scope.mapScope ?? 'auto')
    if (!designed && (item.w + 0.05 < min.w || item.h + 0.05 < min.h)) {
      return { ok: false, reason: `「${item.title}」小于最小可读尺寸` }
    }
  }
  for (let i = 0; i < widgets.length; i += 1) {
    for (let j = i + 1; j < widgets.length; j += 1) {
      const a = widgets[i]
      const b = widgets[j]
      if (!a || !b) continue
      const overlapW = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const overlapH = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      if (overlapW > 0.2 && overlapH > 0.2) return { ok: false, reason: `「${a.title}」与「${b.title}」重叠` }
    }
  }
  return { ok: true, reason: '' }
}

export function layoutBaseline(candidate: LayoutCandidate): LayoutBaseline {
  return {
    recipeId: candidate.id,
    boxes: candidate.widgets.map((item) => ({
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      role: item.role,
      ...(item.variantId ? { variantId: item.variantId } : {}),
      ...(item.col !== undefined ? { col: item.col } : {}),
      ...(item.row !== undefined ? { row: item.row } : {}),
    })),
    ...(candidate.tree ? { partition: candidate.tree, focusSize: candidate.size, focusPlace: candidate.place } : {}),
  }
}

/** 交换两个区域。放不下时沿共用边让出空间；仍然不够就保持原位并说明原因。 */
export function exchangeWidgets(widgets: ScreenWidget[], sourceId: string, targetId: string): { ok: true; widgets: ScreenWidget[] } | { ok: false; reason: string } {
  const source = widgets.find((item) => item.id === sourceId)
  const target = widgets.find((item) => item.id === targetId)
  if (!source || !target) return { ok: false, reason: '没有找到要交换的组件' }
  let sourceBox = { x: target.x, y: target.y, w: target.w, h: target.h }
  let targetBox = { x: source.x, y: source.y, w: source.w, h: source.h }
  const axis = sharedAxis(source, target)
  if (!fits(source.type, sourceBox) || !fits(target.type, targetBox)) {
    if (axis === 'x') {
      const adjusted = shareSpan(sourceBox, targetBox, 'w', minSize(source.type).w, minSize(target.type).w)
      if (!adjusted || !fits(source.type, adjusted.a) || !fits(target.type, adjusted.b)) return { ok: false, reason: unfitReason(source, targetBox, target, sourceBox) }
      sourceBox = adjusted.a
      targetBox = adjusted.b
    } else if (axis === 'y') {
      const adjusted = shareSpan(sourceBox, targetBox, 'h', minSize(source.type).h, minSize(target.type).h)
      if (!adjusted || !fits(source.type, adjusted.a) || !fits(target.type, adjusted.b)) return { ok: false, reason: unfitReason(source, sourceBox, target, targetBox) }
      sourceBox = adjusted.a
      targetBox = adjusted.b
    } else {
      return { ok: false, reason: unfitReason(source, sourceBox, target, targetBox) }
    }
  }
  const next = widgets.map((item) => {
    if (item.id === source.id) return { ...item, ...sourceBox }
    if (item.id === target.id) return { ...item, ...targetBox }
    return item
  })
  for (const item of next) {
    if (item.id !== source.id && item.id !== target.id) continue
    const problem = shapeViolation(item.type, item.w, item.h, item.scope.mapScope ?? 'auto')
    if (problem) return { ok: false, reason: `「${item.title}」换到新区域后${problem}。位置保持不变。` }
  }
  const verdict = validateLayout(next, next.find((item) => item.role === 'primary')?.id ?? source.id)
  if (!verdict.ok && verdict.reason.includes('重叠')) return { ok: false, reason: verdict.reason }
  return { ok: true, widgets: next }
}

function unfitReason(source: ScreenWidget, sourceBox: Box, target: ScreenWidget, targetBox: Box) {
  const sourceMin = minSize(source.type)
  const targetMin = minSize(target.type)
  const sourceFail = !fits(source.type, sourceBox)
  const who = sourceFail ? source : target
  const box = sourceFail ? sourceBox : targetBox
  const min = sourceFail ? sourceMin : targetMin
  const other = sourceFail ? target : source
  return `「${who.title}」换到「${other.title}」的区域后是 ${pct(box.w)}% × ${pct(box.h)}%，低于它需要的 ${pct(min.w)}% × ${pct(min.h)}%。位置保持不变。`
}

function fits(type: WidgetKind, box: Box) {
  const min = minSize(type)
  return box.w + 0.2 >= min.w && box.h + 0.2 >= min.h
}

function sharedAxis(a: ScreenWidget, b: ScreenWidget): 'x' | 'y' | null {
  const touchX = Math.abs(a.x + a.w - b.x) < 3 || Math.abs(b.x + b.w - a.x) < 3
  const touchY = Math.abs(a.y + a.h - b.y) < 3 || Math.abs(b.y + b.h - a.y) < 3
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  if (touchX && overlapY > 8) return 'x'
  if (touchY && overlapX > 8) return 'y'
  return null
}

function shareSpan(a: Box, b: Box, key: 'w' | 'h', minA: number, minB: number): { a: Box; b: Box } | null {
  const total = a[key] + b[key]
  if (minA + minB > total + 0.2) return null
  const firstIsA = key === 'w' ? a.x <= b.x : a.y <= b.y
  const start = key === 'w' ? Math.min(a.x, b.x) : Math.min(a.y, b.y)
  const firstMin = firstIsA ? minA : minB
  const secondMin = firstIsA ? minB : minA
  const preferred = firstIsA ? a[key] : b[key]
  const used = Math.min(Math.max(preferred, firstMin), total - secondMin)
  const second = round(total - used)
  const first = round(total - second)
  if (first + 0.05 < firstMin || second + 0.05 < secondMin) return null
  const firstBox = key === 'w'
    ? { x: start, y: firstIsA ? a.y : b.y, w: first, h: firstIsA ? a.h : b.h }
    : { x: firstIsA ? a.x : b.x, y: start, w: firstIsA ? a.w : b.w, h: first }
  const secondBox = key === 'w'
    ? { x: round(start + first), y: firstIsA ? b.y : a.y, w: second, h: firstIsA ? b.h : a.h }
    : { x: firstIsA ? b.x : a.x, y: round(start + first), w: firstIsA ? b.w : a.w, h: second }
  return firstIsA ? { a: firstBox, b: secondBox } : { a: secondBox, b: firstBox }
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function pct(value: number) {
  return Math.round(value)
}

import type { LayoutCandidate, LayoutPlan } from './compose.ts'
import { minSize } from './layout.ts'
import { aspectPenalty, shapeViolation } from './shape.ts'
import type { LayoutNode, ScreenWidget, WidgetKind } from './types.ts'

export const PARTITION_GAP = 12

const FOCUS_SHARE = { standard: 0.4, large: 0.5, xlarge: 0.6 } as const
export type FocusSize = keyof typeof FOCUS_SHARE
export type FocusPlace = 'left' | 'top' | 'center'

const PLACE_LABEL: Record<FocusPlace, string> = { left: '靠左', top: '靠上', center: '居中' }
const SIZE_LABEL: Record<FocusSize, string> = { standard: '标准重点', large: '大重点', xlarge: '超大重点' }
const SHORT: Partial<Record<WidgetKind, string>> = {
  map: '地图', hotBoard: '热搜', bubbles: '气泡', trend: '趋势', newsList: '焦点',
  progress: '进展', hourly: '小时', eventRank: '事件', coverage: '覆盖', sources: '来源', peers: '对比',
}

export function bodyPixels(metricsOn: boolean) {
  const width = 1920 - 40
  const gaps = metricsOn ? 30 : 20
  const height = 1080 - 28 - 48 - (metricsOn ? 64 : 0) - 24 - gaps
  return { width, height }
}

export function leafRects(tree: LayoutNode, width: number, height: number, gap = PARTITION_GAP) {
  const rects = new Map<string, { x: number; y: number; w: number; h: number }>()
  placeNode(tree, 0, 0, width, height, gap, rects)
  return rects
}

function placeNode(node: LayoutNode, x: number, y: number, width: number, height: number, gap: number, rects: Map<string, { x: number; y: number; w: number; h: number }>) {
  if (node.type === 'widget') {
    rects.set(node.widgetId, { x, y, w: width, h: height })
    return
  }
  const horizontal = node.direction === 'horizontal'
  const count = node.children.length
  const track = horizontal ? width : height
  const inner = Math.max(count, track - gap * Math.max(0, count - 1))
  const spans = distribute(inner, node.ratios)
  let cursor = horizontal ? x : y
  node.children.forEach((child, index) => {
    const span = spans[index] ?? 0
    const nextX = horizontal ? cursor : x
    const nextY = horizontal ? y : cursor
    const nextW = horizontal ? span : width
    const nextH = horizontal ? height : span
    placeNode(child, nextX, nextY, nextW, nextH, gap, rects)
    cursor += span + (index < count - 1 ? gap : 0)
  })
}

function distribute(total: number, ratios: number[]) {
  const sum = ratios.reduce((item, value) => item + value, 0) || 1
  const raw = ratios.map((value) => total * value / sum)
  const floors = raw.map((value) => Math.floor(value))
  let remainder = total - floors.reduce((item, value) => item + value, 0)
  const order = raw.map((value, index) => ({ index, fraction: value - (floors[index] ?? 0) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (const item of order) {
    if (remainder <= 0) break
    floors[item.index] = (floors[item.index] ?? 0) + 1
    remainder -= 1
  }
  return floors
}

export interface DividerHit {
  path: number[]
  index: number
  axis: 'x' | 'y'
  x: number
  y: number
  w: number
  h: number
}

export function dividerHits(tree: LayoutNode, width: number, height: number, gap = PARTITION_GAP) {
  const hits: DividerHit[] = []
  walkDividers(tree, 0, 0, width, height, gap, [], hits)
  return hits
}

function walkDividers(node: LayoutNode, x: number, y: number, width: number, height: number, gap: number, path: number[], hits: DividerHit[]) {
  if (node.type === 'widget') return
  const horizontal = node.direction === 'horizontal'
  const count = node.children.length
  const track = horizontal ? width : height
  const inner = Math.max(count, track - gap * Math.max(0, count - 1))
  const spans = distribute(inner, node.ratios)
  let cursor = horizontal ? x : y
  node.children.forEach((child, index) => {
    const span = spans[index] ?? 0
    const nextX = horizontal ? cursor : x
    const nextY = horizontal ? y : cursor
    const nextW = horizontal ? span : width
    const nextH = horizontal ? height : span
    walkDividers(child, nextX, nextY, nextW, nextH, gap, [...path, index], hits)
    if (index < count - 1) {
      if (horizontal) hits.push({ path, index, axis: 'x', x: cursor + span, y, w: gap, h: height })
      else hits.push({ path, index, axis: 'y', x, y: cursor + span, w: width, h: gap })
    }
    cursor += span + gap
  })
}

export function planPartitions(widgets: ScreenWidget[], focusId: string | null, metricsOn = true): LayoutPlan {
  if (widgets.length === 0) return { candidates: [], more: [], reason: '还没有组件。勾选后即可查看排版。' }
  if (widgets.length > 6) {
    return { candidates: [], more: [], reason: `目前一次排版支持 2 到 6 个主体组件，现在有 ${widgets.length} 个。请减少后再生成，这些组件不会被删掉。` }
  }
  const focus = widgets.find((item) => item.id === focusId) ?? widgets[0]
  if (!focus) return { candidates: [], more: [], reason: '还没有组件。勾选后即可查看排版。' }
  if (widgets.length === 1) {
    const solo = fullBody(widgets, focus, metricsOn)
    return { candidates: [solo], more: [], reason: '' }
  }
  const body = bodyPixels(metricsOn)
  const aux = widgets.filter((item) => item.id !== focus.id)
  const found = new Map<string, LayoutCandidate>()
  for (const place of ['left', 'top', 'center'] as const) {
    for (const size of ['standard', 'large', 'xlarge'] as const) {
      patterns(place, aux.length).forEach((pattern, patternIndex) => {
        const built = assignPattern(focus, aux, place, size, pattern, patternIndex, body.width, body.height)
        if (!built) return
        const signature = built.widgets.map((item) => `${item.id}:${Math.round(item.x)},${Math.round(item.y)},${Math.round(item.w)},${Math.round(item.h)}`).sort().join('|')
        const previous = found.get(signature)
        if (!previous || built.score > previous.score) found.set(signature, built)
      })
    }
  }
  const ranked = [...found.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  if (!ranked.length) {
    return { candidates: [], more: [], reason: '这些组件用完整分区放不下。请减少组件，或换一个重点。组件不会被缩小或隐藏。' }
  }
  const recommended: LayoutCandidate[] = []
  for (const place of ['left', 'top', 'center'] as const) {
    const best = ranked.find((item) => item.place === place)
    if (best) recommended.push(best)
  }
  for (const item of ranked) {
    if (recommended.length >= 3) break
    if (recommended.some((chosen) => chosen.id === item.id || chosen.family === item.family)) continue
    recommended.push(item)
  }
  const chosen = new Set(recommended.map((item) => item.id))
  return { candidates: recommended.slice(0, 3), more: ranked.filter((item) => !chosen.has(item.id)).slice(0, 12), reason: '' }
}

function fullBody(widgets: ScreenWidget[], focus: ScreenWidget, metricsOn: boolean): LayoutCandidate {
  const body = bodyPixels(metricsOn)
  const tree: LayoutNode = { type: 'widget', widgetId: focus.id }
  const rect = leafRects(tree, body.width, body.height).get(focus.id)
  const box = rect ? percentBox(rect, body.width, body.height) : { x: 0, y: 0, w: 100, h: 100 }
  return {
    id: 'solo',
    name: `${shortName(focus)}完整展示`,
    family: 'solo',
    focusId: focus.id,
    focusTitle: focus.title,
    place: 'left',
    size: 'standard',
    tree,
    widgets: widgets.map((item) => ({ ...item, ...box, role: 'primary' as const })),
    score: 1,
  }
}

function patterns(place: FocusPlace, count: number): LayoutNode[] {
  if (place === 'center' && count < 2) return []
  if (place === 'center') return centerPatterns(count)
  if (place === 'top') return topPatterns(count)
  return leftPatterns(count)
}

function leftPatterns(count: number): LayoutNode[] {
  if (count === 1) return [leaf(0)]
  if (count === 2) return [stack([0, 1]), row([0, 1])]
  if (count === 3) return [stack([0, 1, 2]), vgroup([leaf(0), row([1, 2])]), vgroup([row([0, 1]), leaf(2)])]
  if (count === 4) return [
    vgroup([row([0, 1]), row([2, 3])]),
    weightedRows([0, 1], [2, 3], 0.62),
    weightedRows([0, 1], [2, 3], 0.38),
  ]
  return [
    vgroup([row([0, 1]), row([2, 3, 4])]),
    vgroup([row([0, 1, 2]), row([3, 4])]),
    hgroup([stack([0, 1]), stack([2, 3, 4])]),
    hgroup([stack([0, 1, 2]), stack([3, 4])]),
  ]
}

function topPatterns(count: number): LayoutNode[] {
  if (count === 1) return [leaf(0)]
  if (count === 2) return [row([0, 1])]
  if (count === 3) return [row([0, 1, 2])]
  if (count === 4) return [row([0, 1, 2, 3]), vgroup([row([0, 1]), row([2, 3])]), weightedRows([0, 1], [2, 3], 0.38)]
  return [vgroup([row([0, 1]), row([2, 3, 4])]), vgroup([row([0, 1, 2]), row([3, 4])])]
}

function centerPatterns(count: number): LayoutNode[] {
  const splits = count === 2 ? [[1, 1]] : count === 3 ? [[1, 2], [2, 1]] : count === 4 ? [[2, 2]] : [[2, 3], [3, 2]]
  const trees: LayoutNode[] = []
  for (const [left, right] of splits) {
    if (left === undefined || right === undefined) continue
    const leftIds = Array.from({ length: left }, (_, index) => index)
    const rightIds = Array.from({ length: right }, (_, index) => left + index)
    const leftStacks = leftIds.length === 2 ? [stackNodes(leftIds), stackNodes(leftIds, [0.62, 0.38]), stackNodes(leftIds, [0.38, 0.62])] : [stackNodes(leftIds)]
    const rightStacks = rightIds.length === 2 ? [stackNodes(rightIds), stackNodes(rightIds, [0.62, 0.38]), stackNodes(rightIds, [0.38, 0.62])] : [stackNodes(rightIds)]
    for (const leftTree of leftStacks) {
      for (const rightTree of rightStacks) {
        trees.push(centerShell(leftTree, rightTree, 0.5))
        if (leftIds.length !== rightIds.length) continue
        trees.push(centerShell(leftTree, rightTree, 0.45))
        trees.push(centerShell(leftTree, rightTree, 0.55))
      }
    }
  }
  return trees
}

function leaf(index: number): LayoutNode {
  return { type: 'widget', widgetId: `$${index}` }
}

function stack(ids: number[]): LayoutNode {
  return stackNodes(ids)
}

function stackNodes(ids: number[], ratios?: number[]): LayoutNode {
  if (ids.length === 1) return leaf(ids[0] ?? 0)
  return { type: 'split', direction: 'vertical', ratios: ratios ?? ids.map(() => 1), children: ids.map((id) => leaf(id)) }
}

function weightedRows(top: number[], bottom: number[], topShare: number): LayoutNode {
  return { type: 'split', direction: 'vertical', ratios: [topShare, 1 - topShare], children: [row(top), row(bottom)] }
}

function row(ids: number[]): LayoutNode {
  if (ids.length === 1) return leaf(ids[0] ?? 0)
  return { type: 'split', direction: 'horizontal', ratios: ids.map(() => 1), children: ids.map((id) => leaf(id)) }
}

function vgroup(children: LayoutNode[]): LayoutNode {
  return { type: 'split', direction: 'vertical', ratios: children.map(() => 1), children }
}

function hgroup(children: LayoutNode[]): LayoutNode {
  return { type: 'split', direction: 'horizontal', ratios: children.map(() => 1), children }
}

function centerShell(left: LayoutNode, right: LayoutNode, leftShare: number): LayoutNode {
  return {
    type: 'split',
    direction: 'horizontal',
    ratios: [leftShare, 1, 1 - leftShare],
    children: [left, { type: 'widget', widgetId: '$focus' }, right],
  }
}

function assignPattern(
  focus: ScreenWidget,
  aux: ScreenWidget[],
  place: FocusPlace,
  size: FocusSize,
  pattern: LayoutNode,
  patternIndex: number,
  width: number,
  height: number,
): LayoutCandidate | null {
  const share = FOCUS_SHARE[size]
  const shell = place === 'center'
    ? scaleCenter(pattern, share)
    : place === 'left'
      ? { type: 'split' as const, direction: 'horizontal' as const, ratios: [share, 1 - share], children: [{ type: 'widget' as const, widgetId: '$focus' }, pattern] }
      : { type: 'split' as const, direction: 'vertical' as const, ratios: [share, 1 - share], children: [{ type: 'widget' as const, widgetId: '$focus' }, pattern] }
  const slots = [...leafRects(shell, width, height).entries()].filter(([id]) => id !== '$focus')
  const order = [...aux].sort((a, b) => pickiness(b) - pickiness(a) || a.id.localeCompare(b.id))
  const assigned = greedy(order, slots, width, height)
  if (!assigned) return null
  const tree = rename(shell, new Map([['$focus', focus.id], ...assigned]))
  const rects = leafRects(tree, width, height)
  const painted = [focus, ...aux].map((item) => {
    const rect = rects.get(item.id)
    if (!rect) return null
    return { ...item, ...percentBox(rect, width, height), role: item.id === focus.id ? 'primary' as const : 'secondary' as const }
  })
  if (painted.some((item) => !item)) return null
  const widgets = painted.filter((item): item is ScreenWidget => Boolean(item))
  if (widgets.length !== aux.length + 1) return null
  for (const item of widgets) {
    if (!fitsWidget(item, width, height)) return null
  }
  const signature = assigned.map(([, id]) => id).join('.')
  return {
    id: `${place}-${size}-${patternIndex}-${signature}`,
    name: `${shortName(focus)}${PLACE_LABEL[place]} · ${SIZE_LABEL[size]}`,
    family: `${place}-${size}`,
    focusId: focus.id,
    focusTitle: focus.title,
    place,
    size,
    tree,
    widgets,
    score: scoreLayout(widgets, focus, size),
  }
}

function scaleCenter(pattern: LayoutNode, share: number): LayoutNode {
  if (pattern.type !== 'split') return pattern
  const [left = 0.5, , right = 0.5] = pattern.ratios
  const side = left + right || 1
  const remain = 1 - share
  return { ...pattern, ratios: [remain * left / side, share, remain * right / side] }
}

function pickiness(widget: ScreenWidget) {
  if (widget.type === 'map' || widget.type === 'bubbles') return 3
  if (widget.type === 'trend' || widget.type === 'coverage' || widget.type === 'hourly') return 2
  return 1
}

function greedy(
  widgets: ScreenWidget[],
  slots: [string, { x: number; y: number; w: number; h: number }][],
  width: number,
  height: number,
) {
  const open = [...slots]
  const pairs: [string, string][] = []
  for (const widget of widgets) {
    let best: { slot: string; cost: number } | null = null
    for (const [slot, rect] of open) {
      const cost = slotCost(widget, rect, width, height)
      if (!Number.isFinite(cost)) continue
      if (!best || cost < best.cost || (cost === best.cost && slot < best.slot)) best = { slot, cost }
    }
    if (!best) return null
    pairs.push([best.slot, widget.id])
    const used = best.slot
    const index = open.findIndex(([slot]) => slot === used)
    if (index >= 0) open.splice(index, 1)
  }
  return improve(pairs, widgets, slots, width, height)
}

function improve(
  pairs: [string, string][],
  widgets: ScreenWidget[],
  slots: [string, { x: number; y: number; w: number; h: number }][],
  width: number,
  height: number,
) {
  const bySlot = new Map(slots)
  const byWidget = new Map(widgets.map((item) => [item.id, item]))
  let guard = 0
  let changed = true
  while (changed && guard < 8) {
    changed = false
    guard += 1
    for (let i = 0; i < pairs.length; i += 1) {
      for (let j = i + 1; j < pairs.length; j += 1) {
        const left = pairs[i]
        const right = pairs[j]
        if (!left || !right) continue
        const before = pairCost(left, bySlot, byWidget, width, height) + pairCost(right, bySlot, byWidget, width, height)
        const swappedLeft: [string, string] = [left[0], right[1]]
        const swappedRight: [string, string] = [right[0], left[1]]
        const after = pairCost(swappedLeft, bySlot, byWidget, width, height) + pairCost(swappedRight, bySlot, byWidget, width, height)
        if (after + 0.01 < before) {
          pairs[i] = swappedLeft
          pairs[j] = swappedRight
          changed = true
        }
      }
    }
  }
  if (pairs.some((pair) => !Number.isFinite(pairCost(pair, bySlot, byWidget, width, height)))) return null
  return pairs
}

function pairCost(
  pair: [string, string],
  slots: Map<string, { x: number; y: number; w: number; h: number }>,
  widgets: Map<string, ScreenWidget>,
  width: number,
  height: number,
) {
  const rect = slots.get(pair[0])
  const widget = widgets.get(pair[1])
  if (!rect || !widget) return Number.POSITIVE_INFINITY
  return slotCost(widget, rect, width, height)
}

function slotCost(widget: ScreenWidget, rect: { w: number; h: number }, width: number, height: number) {
  const box = percentBox({ x: 0, y: 0, w: rect.w, h: rect.h }, width, height)
  if (box.w + 0.05 < minSize(widget.type).w || box.h + 0.05 < minSize(widget.type).h) return Number.POSITIVE_INFINITY
  if (shapeViolation(widget.type, box.w, box.h, widget.scope.mapScope ?? 'auto')) return Number.POSITIVE_INFINITY
  let cost = Math.max(0, aspectPenalty(widget.type, box.w, box.h, widget.scope.mapScope ?? 'auto'))
  const pixel = box.h <= 0 ? 1 : (box.w / box.h) * (width / height)
  if ((widget.type === 'trend' || widget.type === 'coverage' || widget.type === 'hourly') && pixel < 1.7) cost += 6
  if ((widget.type === 'hotBoard' || widget.type === 'eventRank' || widget.type === 'newsList') && pixel > 2.4) cost += 4
  if ((widget.type === 'map' || widget.type === 'bubbles') && (pixel < 0.85 || pixel > 1.8)) cost += 4
  return cost
}

function fitsWidget(widget: ScreenWidget, width: number, height: number) {
  if (width <= 0 || height <= 0) return false
  const min = minSize(widget.type)
  if (widget.w + 0.05 < min.w || widget.h + 0.05 < min.h) return false
  return !shapeViolation(widget.type, widget.w, widget.h, widget.scope.mapScope ?? 'auto')
}

function scoreLayout(widgets: ScreenWidget[], focus: ScreenWidget, size: FocusSize) {
  let score = 40
  for (const item of widgets) {
    const penalty = aspectPenalty(item.type, item.w, item.h, item.scope.mapScope ?? 'auto')
    score -= Math.max(0, penalty)
    if (penalty < 0) score += 4
    if ((item.type === 'newsList' || item.type === 'eventRank') && item.w * item.h > 2800) score -= (item.w * item.h - 2800) / 80
  }
  if (focus.type === 'map' || focus.type === 'bubbles' || focus.type === 'trend') {
    score += size === 'xlarge' ? 8 : size === 'large' ? 5 : 2
  }
  if (focus.type === 'newsList' || focus.type === 'eventRank') {
    score -= size === 'xlarge' ? 24 : size === 'large' ? 10 : 0
  }
  return score
}

function percentBox(rect: { x: number; y: number; w: number; h: number }, width: number, height: number) {
  return {
    x: (rect.x / width) * 100,
    y: (rect.y / height) * 100,
    w: (rect.w / width) * 100,
    h: (rect.h / height) * 100,
  }
}

function rename(node: LayoutNode, ids: Map<string, string>): LayoutNode {
  if (node.type === 'widget') return { type: 'widget', widgetId: ids.get(node.widgetId) ?? node.widgetId }
  return { type: 'split', direction: node.direction, ratios: normalize(node.ratios), children: node.children.map((child) => rename(child, ids)) }
}

function normalize(ratios: number[]) {
  const sum = ratios.reduce((item, value) => item + value, 0) || 1
  return ratios.map((value) => value / sum)
}

function shortName(widget: ScreenWidget) {
  return SHORT[widget.type] ?? widget.title
}

export function swapLeaves(tree: LayoutNode, sourceId: string, targetId: string): LayoutNode {
  return mapIds(tree, (id) => id === sourceId ? targetId : id === targetId ? sourceId : id)
}

function mapIds(node: LayoutNode, map: (id: string) => string): LayoutNode {
  if (node.type === 'widget') return { type: 'widget', widgetId: map(node.widgetId) }
  return { ...node, children: node.children.map((child) => mapIds(child, map)) }
}

export function previewSwap(tree: LayoutNode, widgets: ScreenWidget[], sourceId: string, targetId: string, width: number, height: number) {
  const nextTree = swapLeaves(tree, sourceId, targetId)
  const painted = paint(widgets, nextTree, width, height)
  const source = painted.find((item) => item.id === sourceId)
  const target = painted.find((item) => item.id === targetId)
  if (!source || !target) return { ok: false as const, reason: '没有找到要交换的组件', tree, widgets }
  const sourceProblem = shapeViolation(source.type, source.w, source.h, source.scope.mapScope ?? 'auto')
  const targetProblem = shapeViolation(target.type, target.w, target.h, target.scope.mapScope ?? 'auto')
  if (sourceProblem || targetProblem || !fitsWidget(source, width, height) || !fitsWidget(target, width, height)) {
    const who = sourceProblem || !fitsWidget(source, width, height) ? source : target
    return { ok: false as const, reason: `「${who.title}」换过去后放不下。位置保持不变，可以重新排版。`, tree, widgets }
  }
  return { ok: true as const, reason: `松手后与「${target.title}」交换`, tree: nextTree, widgets: painted }
}

export function paint(widgets: ScreenWidget[], tree: LayoutNode, width: number, height: number) {
  const rects = leafRects(tree, width, height)
  return widgets.map((item) => {
    const rect = rects.get(item.id)
    return rect ? { ...item, ...percentBox(rect, width, height) } : item
  })
}

export function dragDivider(
  tree: LayoutNode,
  widgets: ScreenWidget[],
  width: number,
  height: number,
  path: number[],
  index: number,
  delta: number,
) {
  const located = locateSplit(tree, path, width, height)
  if (!located) return tree
  const { node, track } = located
  const count = node.children.length
  const inner = Math.max(count, track - PARTITION_GAP * Math.max(0, count - 1))
  const spans = distribute(inner, node.ratios)
  const current = spans[index] ?? 0
  const next = spans[index + 1] ?? 0
  const pair = current + next
  const desired = Math.max(1, Math.min(pair - 1, current + delta))
  const pairRatio = (node.ratios[index] ?? 0) + (node.ratios[index + 1] ?? 0)
  const original = node.ratios[index] ?? 0
  const target = pair <= 0 ? original : pairRatio * desired / pair
  const fits = (ratio: number) => {
    const ratios = node.ratios.map((value, item) => item === index ? ratio : item === index + 1 ? pairRatio - ratio : value)
    return acceptable(writeRatios(tree, path, normalize(ratios)), widgets, width, height)
  }
  let best = original
  let low = Math.min(original, target)
  let high = Math.max(original, target)
  if (fits(target)) best = target
  else {
    for (let step = 0; step < 18; step += 1) {
      const mid = (low + high) / 2
      if (fits(mid)) {
        best = mid
        if (target > original) low = mid
        else high = mid
      } else if (target > original) high = mid
      else low = mid
    }
  }
  const ratios = node.ratios.map((value, item) => item === index ? best : item === index + 1 ? pairRatio - best : value)
  return writeRatios(tree, path, normalize(ratios))
}

function acceptable(tree: LayoutNode, widgets: ScreenWidget[], width: number, height: number) {
  const painted = paint(widgets, tree, width, height)
  return painted.every((item) => leafRects(tree, width, height).has(item.id) && fitsWidget(item, width, height))
}

function locateSplit(tree: LayoutNode, path: number[], width: number, height: number) {
  let node: LayoutNode = tree
  let x = 0
  let y = 0
  let w = width
  let h = height
  for (const index of path) {
    if (node.type !== 'split') return null
    const horizontal = node.direction === 'horizontal'
    const count = node.children.length
    const track = horizontal ? w : h
    const inner = Math.max(count, track - PARTITION_GAP * Math.max(0, count - 1))
    const spans = distribute(inner, node.ratios)
    let cursor = horizontal ? x : y
    for (let child = 0; child < index; child += 1) cursor += (spans[child] ?? 0) + PARTITION_GAP
    const span = spans[index] ?? 0
    if (horizontal) { x = cursor; w = span } else { y = cursor; h = span }
    const next = node.children[index]
    if (!next) return null
    node = next
  }
  if (node.type !== 'split') return null
  return { node, track: node.direction === 'horizontal' ? w : h }
}

function writeRatios(node: LayoutNode, path: number[], ratios: number[]): LayoutNode {
  if (path.length === 0) {
    if (node.type !== 'split') return node
    return { ...node, ratios }
  }
  if (node.type !== 'split') return node
  const [head, ...rest] = path
  return {
    ...node,
    children: node.children.map((child, index) => index === head ? writeRatios(child, rest, ratios) : child),
  }
}

export function removeLeaf(tree: LayoutNode, id: string): LayoutNode | null {
  return strip(tree, id)
}

function strip(node: LayoutNode, id: string): LayoutNode | null {
  if (node.type === 'widget') return node.widgetId === id ? null : node
  const children: LayoutNode[] = []
  const ratios: number[] = []
  node.children.forEach((child, index) => {
    const next = strip(child, id)
    if (next) {
      children.push(next)
      ratios.push(node.ratios[index] ?? 1)
    }
  })
  if (children.length === 0) return null
  if (children.length === 1) return children[0] ?? null
  return { type: 'split', direction: node.direction, ratios: normalize(ratios), children }
}

export function readLayoutNode(value: unknown): LayoutNode | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Partial<LayoutNode> & { children?: unknown; ratios?: unknown }
  if (raw.type === 'widget' && typeof (raw as { widgetId?: unknown }).widgetId === 'string') {
    return { type: 'widget', widgetId: (raw as { widgetId: string }).widgetId }
  }
  if (raw.type !== 'split' || (raw.direction !== 'horizontal' && raw.direction !== 'vertical')) return undefined
  if (!Array.isArray(raw.children) || !Array.isArray(raw.ratios) || raw.children.length !== raw.ratios.length || raw.children.length < 2) return undefined
  const children = raw.children.map((child) => readLayoutNode(child))
  if (children.some((child) => !child)) return undefined
  return { type: 'split', direction: raw.direction, ratios: normalize(raw.ratios.map((item) => Number(item) || 0)), children: children.filter((child): child is LayoutNode => Boolean(child)) }
}

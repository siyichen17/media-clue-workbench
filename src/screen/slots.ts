import type { LayoutCandidate, LayoutPlan } from './compose.ts'
import type { ScreenWidget, WidgetKind } from './types.ts'

/** 主体区 12×8。12×6 时四川大地图和通栏趋势不能同时放下，所以行数用 8。 */
export const GRID_COLS = 12
export const GRID_ROWS = 8
export const GRID_VERSION = 1

export interface WidgetSizeVariant {
  id: string
  label: string
  cols: number
  rows: number
  presentation: string
}

const SICHUAN_MAP: WidgetSizeVariant[] = [
  { id: 'map-standard', label: '标准地图', cols: 4, rows: 5, presentation: '等比四川地图' },
  { id: 'map-large', label: '大地图', cols: 5, rows: 6, presentation: '更大的四川地图' },
]

const CHINA_MAP: WidgetSizeVariant[] = [
  { id: 'map-standard', label: '标准地图', cols: 5, rows: 4, presentation: '等比全国地图' },
  { id: 'map-large', label: '大地图', cols: 6, rows: 5, presentation: '更大的全国地图' },
]

const VARIANTS: Record<Exclude<WidgetKind, 'map'>, WidgetSizeVariant[]> = {
  eventRank: [
    { id: 'rank-standard', label: '标准排行', cols: 3, rows: 3, presentation: '短列表' },
    { id: 'rank-long', label: '长排行', cols: 3, rows: 6, presentation: '更多事件' },
    { id: 'rank-wide', label: '宽排行', cols: 4, rows: 3, presentation: '名称更完整' },
  ],
  hotBoard: [
    { id: 'hot-short', label: '短列表', cols: 3, rows: 3, presentation: '少量热搜' },
    { id: 'hot-long', label: '长列表', cols: 3, rows: 6, presentation: '更多条目' },
    { id: 'hot-wide', label: '宽列表', cols: 4, rows: 3, presentation: '标题更完整' },
  ],
  bubbles: [
    { id: 'bubble-compact', label: '精简主题', cols: 3, rows: 3, presentation: '较少气泡' },
    { id: 'bubble-full', label: '更多主题', cols: 4, rows: 4, presentation: '更多主题和完整标签' },
  ],
  trend: [
    { id: 'trend-standard', label: '标准横卡', cols: 4, rows: 2, presentation: '近期曲线' },
    { id: 'trend-wide', label: '宽横卡', cols: 6, rows: 2, presentation: '更长时间轴' },
    { id: 'trend-full', label: '通栏', cols: 12, rows: 2, presentation: '整行趋势' },
  ],
  newsList: [
    { id: 'focus-standard', label: '标准卡', cols: 4, rows: 3, presentation: '标题和摘要' },
    { id: 'focus-wide', label: '宽幅卡', cols: 6, rows: 3, presentation: '更长的摘要' },
  ],
  progress: [
    { id: 'progress-vertical', label: '纵向进展', cols: 3, rows: 4, presentation: '自上而下' },
    { id: 'progress-horizontal', label: '横向时间线', cols: 6, rows: 2, presentation: '从左到右' },
  ],
  hourly: [
    { id: 'hour-standard', label: '标准矩阵', cols: 4, rows: 3, presentation: '八列小时格' },
    { id: 'hour-wide', label: '宽矩阵', cols: 6, rows: 2, presentation: '十二列小时格' },
  ],
  coverage: [
    { id: 'coverage-standard', label: '标准矩阵', cols: 6, rows: 3, presentation: '主要媒体和事件' },
    { id: 'coverage-wide', label: '宽矩阵', cols: 8, rows: 3, presentation: '更多媒体列' },
  ],
  sources: [
    { id: 'source-standard', label: '标准排行', cols: 3, rows: 3, presentation: '前几家机构' },
    { id: 'source-long', label: '更多机构', cols: 3, rows: 6, presentation: '更长的排行' },
  ],
  peers: [
    { id: 'peer-standard', label: '标准对比', cols: 3, rows: 3, presentation: '主要媒体' },
    { id: 'peer-long', label: '更多媒体', cols: 3, rows: 6, presentation: '更长的对比' },
  ],
}

export function variantsFor(type: WidgetKind, mapScope: 'auto' | 'china' | 'sichuan' = 'auto') {
  if (type === 'map') return mapScope === 'china' ? CHINA_MAP : SICHUAN_MAP
  return VARIANTS[type]
}

export function variantById(type: WidgetKind, id: string | undefined, mapScope: 'auto' | 'china' | 'sichuan' = 'auto') {
  return variantsFor(type, mapScope).find((item) => item.id === id) ?? null
}

export function largestVariant(type: WidgetKind, mapScope: 'auto' | 'china' | 'sichuan' = 'auto') {
  return [...variantsFor(type, mapScope)].sort((a, b) => b.cols * b.rows - a.cols * a.rows || b.cols - a.cols)[0]
}

export function smallestVariant(type: WidgetKind, mapScope: 'auto' | 'china' | 'sichuan' = 'auto') {
  return [...variantsFor(type, mapScope)].sort((a, b) => a.cols * a.rows - b.cols * b.rows || a.cols - b.cols)[0]
}

export function spanBox(col: number, row: number, cols: number, rows: number) {
  return {
    x: (col / GRID_COLS) * 100,
    y: (row / GRID_ROWS) * 100,
    w: (cols / GRID_COLS) * 100,
    h: (rows / GRID_ROWS) * 100,
  }
}

interface Cell {
  col: number
  row: number
  cols: number
  rows: number
}

export interface DropPreview {
  ok: boolean
  kind: 'stay' | 'move' | 'swap' | 'shift' | 'blocked'
  widgets: ScreenWidget[]
  reason: string
  key: string
  mark?: { x: number; y: number; w: number; h: number }
}

function scopeOf(widget: ScreenWidget) {
  return widget.scope.mapScope ?? 'auto'
}

export function cellOf(widget: ScreenWidget): Cell | null {
  const variant = variantById(widget.type, widget.variantId, scopeOf(widget))
  const col = widget.col
  const row = widget.row
  if (!variant || col === undefined || row === undefined || !Number.isInteger(col) || !Number.isInteger(row)) return null
  return { col, row, cols: variant.cols, rows: variant.rows }
}

function fitsCell(cell: Cell) {
  return cell.col >= 0 && cell.row >= 0 && cell.col + cell.cols <= GRID_COLS && cell.row + cell.rows <= GRID_ROWS
}

function hits(a: Cell, b: Cell) {
  return a.col < b.col + b.cols && a.col + a.cols > b.col && a.row < b.row + b.rows && a.row + a.rows > b.row
}

function sameSize(a: Cell, b: Cell) {
  return a.cols === b.cols && a.rows === b.rows
}

function place(widget: ScreenWidget, col: number, row: number, variant = variantById(widget.type, widget.variantId, scopeOf(widget))): ScreenWidget {
  const size = variant ?? smallestVariant(widget.type, scopeOf(widget))
  if (!size) return widget
  return { ...widget, ...spanBox(col, row, size.cols, size.rows), col, row, variantId: size.id }
}

function withRoles(widgets: ScreenWidget[], focusId: string) {
  return widgets.map((item) => ({ ...item, role: item.id === focusId ? 'primary' as const : 'secondary' as const }))
}

export function planGridLayouts(widgets: ScreenWidget[], focusId: string | null): LayoutPlan {
  if (widgets.length === 0) return { candidates: [], more: [], reason: '还没有组件。勾选后即可查看排版。' }
  const focus = widgets.find((item) => item.id === focusId) ?? widgets[0]
  if (!focus) return { candidates: [], more: [], reason: '还没有组件。勾选后即可查看排版。' }
  const pool = new Map<string, LayoutCandidate>()
  const accept = (candidate: LayoutCandidate | null) => {
    if (!candidate) return
    const signature = candidate.widgets.map((item) => `${item.id}:${item.col},${item.row},${item.variantId}`).sort().join('|')
    const previous = pool.get(signature)
    if (!previous || candidate.score > previous.score) pool.set(signature, candidate)
  }
  if (widgets.length === 1) accept(solo(focus))
  else {
    accept(banded(widgets, focus, 'center'))
    accept(banded(widgets, focus, 'mirror'))
    accept(banded(widgets, focus, 'flank'))
    accept(banded(widgets, focus, 'center', false))
  }
  const ranked = [...pool.values()].sort((a, b) => b.score - a.score || a.family.localeCompare(b.family) || a.id.localeCompare(b.id))
  const recommended: LayoutCandidate[] = []
  for (const item of ranked) {
    if (recommended.some((chosen) => chosen.family === item.family)) continue
    recommended.push(item)
    if (recommended.length === 3) break
  }
  const chosen = new Set(recommended.map((item) => item.id))
  if (!recommended.length) {
    return { candidates: [], more: [], reason: '这些组件用标准尺寸放不下同一屏。请减少组件，或换一个重点。' }
  }
  return { candidates: recommended, more: ranked.filter((item) => !chosen.has(item.id)), reason: '' }
}

function solo(focus: ScreenWidget): LayoutCandidate | null {
  const variant = largestVariant(focus.type, scopeOf(focus))
  if (!variant) return null
  const col = Math.floor((GRID_COLS - variant.cols) / 2)
  const row = Math.floor((GRID_ROWS - variant.rows) / 2)
  const painted = withRoles([place(focus, col, row, variant)], focus.id)
  return {
    id: `solo-${variant.id}`,
    name: variant.label,
    family: 'solo',
    focusId: focus.id,
    focusTitle: focus.title,
    widgets: painted,
    score: variant.cols * variant.rows,
  }
}

function banded(widgets: ScreenWidget[], focus: ScreenWidget, family: 'center' | 'mirror' | 'flank', preferLarge = true): LayoutCandidate | null {
  const sizes = variantsFor(focus.type, scopeOf(focus))
  const ordered = [...sizes].sort((a, b) => preferLarge ? b.cols * b.rows - a.cols * a.rows : a.cols * a.rows - b.cols * b.rows)
  const band = bandChoice(widgets, focus)
  for (const variant of ordered) {
    const painted = stamp(widgets, focus, variant, family, band)
    if (!painted) continue
    const largest = ordered[0]
    const reduced = largest && variant.id !== largest.id
    return {
      id: `${family}-${variant.id}`,
      name: `${reduced ? variant.label : titleOf(family, focus)}`,
      family,
      focusId: focus.id,
      focusTitle: focus.title,
      widgets: painted,
      score: variant.cols * variant.rows * 10 + painted.reduce((sum, item) => sum + item.w * item.h, 0) / 100 - (reduced ? 30 : 0),
    }
  }
  return null
}

function titleOf(family: 'center' | 'mirror' | 'flank', focus: ScreenWidget) {
  if (focus.type === 'map' && family === 'center') return '中央地图'
  if (focus.type === 'map' && family === 'mirror') return '地图居右'
  if (focus.type === 'map' && family === 'flank') return '左侧地图'
  if (family === 'flank') return '左侧重点'
  if (family === 'mirror') return '右侧重点'
  return '重点居中'
}

function bandChoice(widgets: ScreenWidget[], focus: ScreenWidget) {
  if (focus.type === 'trend' || focus.type === 'hourly' || focus.type === 'coverage') return null
  const widget = widgets.find((item) => item.type === 'trend')
    ?? widgets.find((item) => item.type === 'hourly')
    ?? widgets.find((item) => item.type === 'coverage')
  if (!widget) return null
  const full = variantsFor(widget.type, scopeOf(widget)).find((item) => item.cols === GRID_COLS)
  return full ? { widget, variant: full } : null
}

function stamp(
  widgets: ScreenWidget[],
  focus: ScreenWidget,
  variant: WidgetSizeVariant,
  family: 'center' | 'mirror' | 'flank',
  band: { widget: ScreenWidget; variant: WidgetSizeVariant } | null,
): ScreenWidget[] | null {
  const occupancy = emptyGrid()
  const placed = new Map<string, ScreenWidget>()
  const bandRows = band?.variant.rows ?? 0
  if (variant.rows > GRID_ROWS - bandRows) return null
  const center = Math.floor((GRID_COLS - variant.cols) / 2)
  const col = family === 'flank' ? 0 : family === 'mirror' ? GRID_COLS - center - variant.cols : center
  if (!occupy(occupancy, col, 0, variant.cols, variant.rows)) return null
  placed.set(focus.id, place(focus, col, 0, variant))
  if (band) {
    const row = GRID_ROWS - band.variant.rows
    if (!occupy(occupancy, 0, row, band.variant.cols, band.variant.rows)) return null
    placed.set(band.widget.id, place(band.widget, 0, row, band.variant))
  }
  const rest = widgets.filter((item) => !placed.has(item.id))
  if (!packRest(rest, occupancy, placed)) return null
  if (placed.size !== widgets.length) return null
  return withRoles(widgets.map((item) => placed.get(item.id) ?? item), focus.id)
}

function packRest(items: ScreenWidget[], occupancy: boolean[][], placed: Map<string, ScreenWidget>): boolean {
  const open = occupancy.reduce((sum, line) => sum + line.filter((cell) => !cell).length, 0)
  const need = items.reduce((sum, item) => {
    const small = smallestVariant(item.type, scopeOf(item))
    return sum + (small ? small.cols * small.rows : 0)
  }, 0)
  if (need > open) return false
  let bestScore = -1
  const winner: { map: Map<string, ScreenWidget> | null } = { map: null }
  let visits = 0
  const search = (pending: ScreenWidget[], score: number) => {
    visits += 1
    if (visits > 4000) return
    if (pending.length === 0) {
      if (score > bestScore) {
        bestScore = score
        winner.map = new Map(placed)
      }
      return
    }
    const upper = score + pending.reduce((sum, item) => {
      const large = largestVariant(item.type, scopeOf(item))
      return sum + (large ? large.cols * large.rows : 0)
    }, 0)
    if (upper <= bestScore) return
    const item = pending[0]
    if (!item) return
    const options = firstChoice(item, occupancy)
    if (options.length === 0) return
    for (const spot of options) {
      occupy(occupancy, spot.col, spot.row, spot.variant.cols, spot.variant.rows)
      placed.set(item.id, place(item, spot.col, spot.row, spot.variant))
      search(pending.slice(1), score + spot.variant.cols * spot.variant.rows)
      placed.delete(item.id)
      clear(occupancy, spot.col, spot.row, spot.variant.cols, spot.variant.rows)
    }
  }
  search([...items].sort((a, b) => preferredSpan(b) - preferredSpan(a) || a.order - b.order), 0)
  if (!winner.map) return false
  for (const [id, widget] of winner.map) placed.set(id, widget)
  return true
}

function preferredSpan(widget: ScreenWidget) {
  const large = largestVariant(widget.type, scopeOf(widget))
  return large ? large.rows * 10 + large.cols : 0
}

function firstChoice(widget: ScreenWidget, occupancy: boolean[][]) {
  const sizes = [...variantsFor(widget.type, scopeOf(widget))].sort((a, b) => b.cols * b.rows - a.cols * a.rows || b.rows - a.rows)
  const spots: { col: number; row: number; variant: WidgetSizeVariant }[] = []
  for (const variant of sizes) {
    const spot = firstFit(occupancy, variant.cols, variant.rows)
    if (spot) spots.push({ ...spot, variant })
  }
  return spots
}

function firstFit(occupancy: boolean[][], cols: number, rows: number) {
  for (let row = 0; row <= GRID_ROWS - rows; row += 1) {
    for (let col = 0; col <= GRID_COLS - cols; col += 1) {
      if (free(occupancy, col, row, cols, rows)) return { col, row }
    }
  }
  return null
}

function emptyGrid() {
  return Array.from({ length: GRID_ROWS }, () => Array.from({ length: GRID_COLS }, () => false))
}

function free(occupancy: boolean[][], col: number, row: number, cols: number, rows: number) {
  if (col < 0 || row < 0 || col + cols > GRID_COLS || row + rows > GRID_ROWS) return false
  for (let y = row; y < row + rows; y += 1) {
    for (let x = col; x < col + cols; x += 1) {
      if (occupancy[y]?.[x]) return false
    }
  }
  return true
}

function occupy(occupancy: boolean[][], col: number, row: number, cols: number, rows: number) {
  if (!free(occupancy, col, row, cols, rows)) return false
  for (let y = row; y < row + rows; y += 1) {
    for (let x = col; x < col + cols; x += 1) {
      const line = occupancy[y]
      if (line) line[x] = true
    }
  }
  return true
}

export function previewDrop(widgets: ScreenWidget[], id: string, pointerCol: number, pointerRow: number, originCol: number, originRow: number): DropPreview {
  const moving = widgets.find((item) => item.id === id)
  const current = moving ? cellOf(moving) : null
  if (!moving || !current) return blocked(widgets, '这个组件还不是网格尺寸，位置保持不变。')
  const grabbedCol = pointerCol - (originCol - current.col)
  const grabbedRow = pointerRow - (originRow - current.row)
  const col = Math.max(0, Math.min(GRID_COLS - current.cols, grabbedCol))
  const row = Math.max(0, Math.min(GRID_ROWS - current.rows, grabbedRow))
  const hit = widgets.find((item) => {
    if (item.id === id) return false
    const cell = cellOf(item)
    return cell ? pointerCol >= cell.col && pointerCol < cell.col + cell.cols && pointerRow >= cell.row && pointerRow < cell.row + cell.rows : false
  })
  const hitCell = hit ? cellOf(hit) : null
  if (hit && hitCell && sameSize(current, hitCell)) {
    const next = widgets.map((item) => {
      if (item.id === moving.id) return place(item, hitCell.col, hitCell.row)
      if (item.id === hit.id) return place(item, current.col, current.row)
      return item
    })
    return { ok: true, kind: 'swap', widgets: next, reason: `松手后与「${hit.title}」交换`, key: `swap:${hit.id}`, mark: spanBox(hitCell.col, hitCell.row, current.cols, current.rows) }
  }
  const proposal = { ...current, col, row }
  if (proposal.col === current.col && proposal.row === current.row) {
    return { ok: true, kind: 'stay', widgets, reason: '仍在原来的位置', key: 'stay' }
  }
  const blockers = widgets.filter((item) => {
    if (item.id === id) return false
    const cell = cellOf(item)
    return cell ? hits(proposal, cell) : false
  })
  if (blockers.length === 0) {
    const next = widgets.map((item) => item.id === id ? place(item, col, row) : item)
    return { ok: true, kind: 'move', widgets: next, reason: '松手后吸附到这个位置', key: `move:${col},${row}`, mark: spanBox(col, row, current.cols, current.rows) }
  }
  const shifted = moveBlockers(widgets, moving, proposal, blockers)
  const footprint = spanBox(col, row, current.cols, current.rows)
  if (shifted) {
    const names = blockers.map((item) => item.title).join('、')
    return { ok: true, kind: 'shift', widgets: shifted, reason: `松手后为「${moving.title}」腾出位置，${names}就近让开`, key: `shift:${col},${row}`, mark: footprint }
  }
  return blocked(widgets, `「${moving.title}」附近没有空位。可以换一个尺寸，或先预览重新排版。位置保持不变。`, footprint)
}

function blocked(widgets: ScreenWidget[], reason: string, mark?: DropPreview['mark']): DropPreview {
  return { ok: false, kind: 'blocked', widgets, reason, key: `blocked:${reason}`, mark }
}

export function previewVariant(widgets: ScreenWidget[], id: string, variantId: string): DropPreview {
  const moving = widgets.find((item) => item.id === id)
  const current = moving ? cellOf(moving) : null
  const variant = moving ? variantById(moving.type, variantId, scopeOf(moving)) : null
  if (!moving || !current || !variant) return blocked(widgets, '没有这个尺寸。')
  if (variant.id === moving.variantId) return { ok: true, kind: 'stay', widgets, reason: `已经是${variant.label}`, key: 'stay' }
  let col = current.col
  let row = current.row
  if (col + variant.cols > GRID_COLS) col = GRID_COLS - variant.cols
  if (row + variant.rows > GRID_ROWS) row = GRID_ROWS - variant.rows
  const proposal = { col, row, cols: variant.cols, rows: variant.rows }
  if (!fitsCell(proposal)) return blocked(widgets, `${variant.label}超出画布，没有更换。`)
  const blockers = widgets.filter((item) => {
    if (item.id === id) return false
    const cell = cellOf(item)
    return cell ? hits(proposal, cell) : false
  })
  const resized = place(moving, col, row, variant)
  const footprint = spanBox(col, row, variant.cols, variant.rows)
  if (blockers.length === 0) {
    return { ok: true, kind: 'move', widgets: widgets.map((item) => item.id === id ? resized : item), reason: `切换为${variant.label}`, key: `size:${variant.id}`, mark: footprint }
  }
  const shifted = moveBlockers(widgets.map((item) => item.id === id ? resized : item), resized, proposal, blockers)
  if (!shifted) return blocked(widgets, `${variant.label}空间不足。可以预览重新排版，当前布局不会变化。`, footprint)
  return { ok: true, kind: 'shift', widgets: shifted, reason: `切换为${variant.label}，附近组件让开`, key: `size:${variant.id}`, mark: footprint }
}

function moveBlockers(widgets: ScreenWidget[], moving: ScreenWidget, proposal: Cell, blockers: ScreenWidget[]) {
  const fixed = widgets.filter((item) => item.id !== moving.id && !blockers.some((blocker) => blocker.id === item.id))
  const occupancy = emptyGrid()
  const movingCell = { ...proposal }
  if (!occupy(occupancy, movingCell.col, movingCell.row, movingCell.cols, movingCell.rows)) return null
  for (const item of fixed) {
    const cell = cellOf(item)
    if (!cell || !occupy(occupancy, cell.col, cell.row, cell.cols, cell.rows)) return null
  }
  const moved = new Map<string, { col: number; row: number }>()
  const pending = [...blockers].sort((a, b) => {
    const left = cellOf(a)
    const right = cellOf(b)
    return (right ? right.cols * right.rows : 0) - (left ? left.cols * left.rows : 0)
  })
  if (!settle(pending, occupancy, moved)) return null
  return widgets.map((item) => {
    if (item.id === moving.id) return place(item, proposal.col, proposal.row, variantById(item.type, item.variantId, scopeOf(item)) ?? undefined)
    const spot = moved.get(item.id)
    return spot ? place(item, spot.col, spot.row) : item
  })
}

function settle(blockers: ScreenWidget[], occupancy: boolean[][], moved: Map<string, { col: number; row: number }>): boolean {
  const next = blockers[0]
  if (!next) return true
  const cell = cellOf(next)
  if (!cell) return false
  const spots = nearby(cell).filter((spot) => free(occupancy, spot.col, spot.row, cell.cols, cell.rows))
  for (const spot of spots) {
    occupy(occupancy, spot.col, spot.row, cell.cols, cell.rows)
    moved.set(next.id, spot)
    if (settle(blockers.slice(1), occupancy, moved)) return true
    moved.delete(next.id)
    clear(occupancy, spot.col, spot.row, cell.cols, cell.rows)
  }
  return false
}

function nearby(cell: Cell) {
  const spots: { col: number; row: number; distance: number }[] = []
  for (let row = 0; row <= GRID_ROWS - cell.rows; row += 1) {
    for (let col = 0; col <= GRID_COLS - cell.cols; col += 1) {
      const distance = Math.max(Math.abs(col - cell.col), Math.abs(row - cell.row))
      const travel = Math.abs(col - cell.col) + Math.abs(row - cell.row)
      if (distance === 0 || distance > 4) continue
      spots.push({ col, row, distance: travel })
    }
  }
  return spots.sort((a, b) => a.distance - b.distance || a.row - b.row || a.col - b.col)
}

function clear(occupancy: boolean[][], col: number, row: number, cols: number, rows: number) {
  for (let y = row; y < row + rows; y += 1) {
    for (let x = col; x < col + cols; x += 1) {
      const line = occupancy[y]
      if (line) line[x] = false
    }
  }
}

export function tidyWidgets(widgets: ScreenWidget[], focusId: string | null): { ok: true; widgets: ScreenWidget[]; note: string } | { ok: false; reason: string } {
  if (!widgets.every((item) => cellOf(item))) return { ok: false, reason: '还有组件没有网格尺寸，先升级为网格布局。' }
  const focus = widgets.find((item) => item.id === focusId) ?? widgets.find((item) => item.role === 'primary') ?? widgets[0]
  if (!focus) return { ok: false, reason: '还没有组件。' }
  const notes: string[] = []
  const occupancy = emptyGrid()
  const placed = new Map<string, ScreenWidget>()
  const ordered = [...widgets].sort((a, b) => {
    if (a.id === focus.id) return -1
    if (b.id === focus.id) return 1
    return (a.row ?? 0) - (b.row ?? 0) || (a.col ?? 0) - (b.col ?? 0) || a.order - b.order
  })
  for (const item of ordered) {
    const current = variantById(item.type, item.variantId, scopeOf(item)) ?? smallestVariant(item.type, scopeOf(item))
    const options = [current, ...variantsFor(item.type, scopeOf(item)).filter((variant) => variant.id !== current?.id)]
      .filter((variant): variant is WidgetSizeVariant => Boolean(variant))
      .sort((a, b) => {
        if (a.id === current?.id) return -1
        if (b.id === current?.id) return 1
        return b.cols * b.rows - a.cols * a.rows
      })
    const spot = options.map((variant) => ({ variant, at: firstFit(occupancy, variant.cols, variant.rows) })).find((item) => item.at)
    if (!spot?.at) return { ok: false, reason: `「${item.title}」按现有尺寸整理后放不下。布局没有变化。` }
    if (spot.variant.id !== item.variantId) notes.push(`「${item.title}」改为${spot.variant.label}`)
    occupy(occupancy, spot.at.col, spot.at.row, spot.variant.cols, spot.variant.rows)
    placed.set(item.id, place(item, spot.at.col, spot.at.row, spot.variant))
  }
  const next = widgets.map((item) => placed.get(item.id) ?? item)
  const same = next.every((item) => {
    const previous = widgets.find((widget) => widget.id === item.id)
    return previous?.col === item.col && previous?.row === item.row && previous?.variantId === item.variantId
  })
  if (same) return { ok: false, reason: '当前位置已经对齐，没有需要整理的空隙。' }
  const note = notes.length ? `整理时需要调整尺寸：${notes.join('，')}。` : '空位会收拢，组件尺寸保持不变。'
  return { ok: true, widgets: next, note }
}

export function pointerToCell(xPercent: number, yPercent: number) {
  return {
    col: Math.max(0, Math.min(GRID_COLS - 1, Math.floor((xPercent / 100) * GRID_COLS))),
    row: Math.max(0, Math.min(GRID_ROWS - 1, Math.floor((yPercent / 100) * GRID_ROWS))),
  }
}

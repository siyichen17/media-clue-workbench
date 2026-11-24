import { SCREEN_COLS, SCREEN_ROWS, type ScreenWidget } from './types.ts'

export interface GridRect {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export function overlaps(a: GridRect, b: GridRect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function inside(item: GridRect) {
  return item.x >= 0 && item.y >= 0 && item.w > 0 && item.h > 0 && item.x + item.w <= SCREEN_COLS && item.y + item.h <= SCREEN_ROWS
}

export function clampSize(widget: ScreenWidget): ScreenWidget {
  const minW = 4
  const minH = 3
  const w = Math.min(SCREEN_COLS, Math.max(minW, widget.w))
  const h = Math.min(SCREEN_ROWS, Math.max(minH, widget.h))
  const x = Math.min(Math.max(0, widget.x), SCREEN_COLS - w)
  const y = Math.min(Math.max(0, widget.y), SCREEN_ROWS - h)
  return { ...widget, x, y, w, h }
}

export function resolvePlacement(widgets: ScreenWidget[], moving: ScreenWidget): { ok: true; widgets: ScreenWidget[] } | { ok: false; reason: string } {
  if (moving.w < 4 || moving.h < 3) return { ok: false, reason: '小于该组件的最小宽高，已撤回。' }
  if (!inside(moving)) return { ok: false, reason: '不能放到画布外面，已撤回。' }
  const others = widgets.filter((item) => item.id !== moving.id)
  if (others.some((item) => overlaps(item, moving))) return { ok: false, reason: '这个位置会和已有组件重叠，已撤回。' }
  return { ok: true, widgets: widgets.map((item) => item.id === moving.id ? moving : item) }
}

export function findFreeSlot(widgets: ScreenWidget[], draft: ScreenWidget): ScreenWidget | null {
  for (let y = 0; y <= SCREEN_ROWS - draft.h; y += 1) {
    for (let x = 0; x <= SCREEN_COLS - draft.w; x += 1) {
      const candidate = { ...draft, x, y }
      if (inside(candidate) && widgets.every((item) => !overlaps(item, candidate))) return candidate
    }
  }
  return null
}

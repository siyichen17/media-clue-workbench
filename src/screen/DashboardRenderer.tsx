import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { NewsItem } from '../types/domain.ts'
import { MetricValue, ScreenWidgetBody } from './ScreenWidgets.tsx'
import { exchangeWidgets } from './compose.ts'
import { GRID_VERSION, cellOf, pointerToCell, previewDrop, previewVariant, variantsFor, type DropPreview } from './slots.ts'
import { dividerHits, dragDivider, leafRects, previewSwap } from './partition.ts'
import type { LayoutNode } from './types.ts'
import { paletteOf, resolveAppearance, themeVars } from './theme.ts'
import { DashThemeProvider } from './themeContext.tsx'
import { minSize } from './layout.ts'
import { BODY_ASPECT, shapeProfile } from './shape.ts'
import { rangeLabel, type TransientFilters } from './query.ts'
import type { ScreenTemplate, ScreenWidget } from './types.ts'

export const DESIGN_W = 1920
export const DESIGN_H = 1080

export type BoardMode = 'configure' | 'edit' | 'preview' | 'display'

export function DashboardRenderer({
  template,
  mode,
  scale,
  selectedId,
  transient,
  onCommit,
  onSelect,
  onSetFocus,
  onRemove,
  onArrange,
  onPartition,
  onNews,
  onHot,
  holdPlayback = false,
}: {
  template: ScreenTemplate
  mode: BoardMode
  scale: number
  selectedId?: string | null
  transient: TransientFilters
  onCommit?: (widgets: ScreenWidget[], mode: 'auto' | 'generated' | 'manual') => void
  onSelect?: (id: string) => void
  onSetFocus?: (id: string) => void
  onRemove?: (id: string) => void
  onArrange?: () => void
  onPartition?: (tree: LayoutNode, widgets: ScreenWidget[], tuned: boolean) => void
  onNews: (items: NewsItem[], title: string) => void
  onHot: (eventId: string) => void
  holdPlayback?: boolean
}) {
  const editing = mode === 'edit'
  const stageRef = useRef<HTMLDivElement>(null)
  const [ghost, setGhost] = useState<string | null>(null)
  const [hint, setHint] = useState('')
  const [live, setLive] = useState<ScreenWidget[] | null>(null)
  const [outline, setOutline] = useState<{ x: number; y: number; w: number; h: number; ok: boolean } | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [canArrange, setCanArrange] = useState(false)
  const widgets = live ?? template.widgets
  const gridded = template.gridVersion === GRID_VERSION && !template.partition
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 })
  const [liveTree, setLiveTree] = useState<LayoutNode | null>(null)
  const activeTree = liveTree ?? template.partition
  const rects = activeTree && stageBox.w > 0 ? leafRects(activeTree, stageBox.w, stageBox.h) : null

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const measure = () => setStageBox({ w: node.clientWidth, h: node.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [template.partition, template.selectedMetrics.length, template.widgets.length])

  function localPoint(event: { clientX: number; clientY: number }) {
    const stage = stageRef.current
    const box = stage?.getBoundingClientRect()
    if (!stage || !box || box.width <= 0 || box.height <= 0) return null
    return {
      x: ((event.clientX - box.left) / box.width) * stage.clientWidth,
      y: ((event.clientY - box.top) / box.height) * stage.clientHeight,
    }
  }

  function beginPartitionMove(event: ReactPointerEvent<HTMLElement>, widget: ScreenWidget) {
    const tree = template.partition
    const stage = stageRef.current
    if (!tree || !stage || stageBox.w <= 0) return
    event.preventDefault()
    const origin = { x: event.clientX, y: event.clientY }
    let moved = false
    let nextTree = tree
    let nextWidgets = template.widgets
    let accepted = false
    const move = (next: PointerEvent) => {
      if (Math.hypot(next.clientX - origin.x, next.clientY - origin.y) > 4) moved = true
      const point = localPoint(next)
      const current = point ? leafRects(tree, stage.clientWidth, stage.clientHeight) : null
      const target = point && current
        ? [...current.entries()].find(([id, rect]) => id !== widget.id && point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h)
        : undefined
      if (!target) {
        nextTree = tree
        accepted = false
        setLiveTree(null)
        setHint(moved ? '拖到另一个组件上才能交换。' : '')
        return
      }
      const preview = previewSwap(tree, template.widgets, widget.id, target[0], stage.clientWidth, stage.clientHeight)
      nextTree = preview.tree
      nextWidgets = preview.widgets
      accepted = preview.ok
      setLiveTree(preview.ok ? preview.tree : null)
      setHint(preview.reason)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      setLiveTree(null)
      setHint('')
      if (moved && accepted) onPartition?.(nextTree, nextWidgets, template.tuned === true)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  function paintCommit(tree: LayoutNode) {
    const stage = stageRef.current
    if (!stage) return template.widgets
    const placed = leafRects(tree, stage.clientWidth, stage.clientHeight)
    return template.widgets.map((item) => {
      const rect = placed.get(item.id)
      if (!rect || stage.clientWidth <= 0 || stage.clientHeight <= 0) return item
      return {
        ...item,
        x: (rect.x / stage.clientWidth) * 100,
        y: (rect.y / stage.clientHeight) * 100,
        w: (rect.w / stage.clientWidth) * 100,
        h: (rect.h / stage.clientHeight) * 100,
      }
    })
  }

  function beginDivider(event: ReactPointerEvent<HTMLElement>, path: number[], index: number, axis: 'x' | 'y') {
    const tree = template.partition
    const stage = stageRef.current
    if (!tree || !stage) return
    event.preventDefault()
    event.stopPropagation()
    const origin = axis === 'x' ? event.clientX : event.clientY
    let nextTree = tree
    const move = (next: PointerEvent) => {
      const box = stage.getBoundingClientRect()
      const scale = axis === 'x' ? stage.clientWidth / box.width : stage.clientHeight / box.height
      const delta = ((axis === 'x' ? next.clientX : next.clientY) - origin) * scale
      nextTree = dragDivider(tree, template.widgets, stage.clientWidth, stage.clientHeight, path, index, delta)
      setLiveTree(nextTree)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      setLiveTree(null)
      if (JSON.stringify(nextTree) !== JSON.stringify(tree)) onPartition?.(nextTree, paintCommit(nextTree), true)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  function beginMove(event: ReactPointerEvent<HTMLElement>, widget: ScreenWidget) {
    if (!editing) return
    if ((event.target as HTMLElement).closest('.dash-resize, .size-bar, .split-handle')) return
    if (template.partition) {
      beginPartitionMove(event, widget)
      return
    }
    if (gridded && cellOf(widget)) {
      beginGridMove(event, widget)
      return
    }
    event.preventDefault()
    event.stopPropagation()
    onSelect?.(widget.id)
    const origin = template.widgets
    const startX = event.clientX
    const startY = event.clientY
    const move = (next: PointerEvent) => {
      const stage = stageRef.current?.getBoundingClientRect()
      if (!stage) return
      const x = ((next.clientX - stage.left) / stage.width) * 100
      const y = ((next.clientY - stage.top) / stage.height) * 100
      const target = origin.find((item) => item.id !== widget.id && contains(item, x, y))
      setGhost(target?.id ?? null)
      if (!target) {
        setLive(null)
        setHint('拖到另一块组件上再松手')
        return
      }
      const exchanged = exchangeWidgets(origin, widget.id, target.id)
      setLive(exchanged.ok ? exchanged.widgets : null)
      setHint(exchanged.ok ? `松手后与「${target.title}」换位` : exchanged.reason)
    }
    const end = (next: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      const stage = stageRef.current?.getBoundingClientRect()
      setGhost(null)
      setLive(null)
      if (!stage || Math.hypot(next.clientX - startX, next.clientY - startY) <= 4) { setHint(''); return }
      const x = ((next.clientX - stage.left) / stage.width) * 100
      const y = ((next.clientY - stage.top) / stage.height) * 100
      const target = origin.find((item) => item.id !== widget.id && contains(item, x, y))
      if (!target) { setHint('没有落到其他组件上，位置保持不变'); return }
      const exchanged = exchangeWidgets(origin, widget.id, target.id)
      if (!exchanged.ok) { setHint(exchanged.reason); return }
      onCommit?.(exchanged.widgets, 'manual')
      setHint('')
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  function beginGridMove(event: ReactPointerEvent<HTMLElement>, widget: ScreenWidget) {
    event.preventDefault()
    event.stopPropagation()
    onSelect?.(widget.id)
    const stage = stageRef.current?.getBoundingClientRect()
    const current = cellOf(widget)
    if (!stage || !current) return
    const down = pointerToCell(((event.clientX - stage.left) / stage.width) * 100, ((event.clientY - stage.top) / stage.height) * 100)
    const origin = template.widgets
    let shown: DropPreview = { ok: true, kind: 'stay', widgets: origin, reason: '', key: 'stay' }
    let latest = shown
    let timer = 0
    let ended = false
    const paint = (preview: DropPreview) => {
      shown = preview
      const neighbor = preview.widgets.find((item) => item.id !== widget.id && origin.some((source) => source.id === item.id && (source.x !== item.x || source.y !== item.y)))
      setGhost(neighbor?.id ?? null)
      setCanArrange(!preview.ok)
      setHint(preview.reason)
      setOutline(preview.mark ? { ...preview.mark, ok: preview.ok } : null)
      setLive(preview.ok && preview.kind !== 'stay' ? preview.widgets : null)
    }
    const finish = (commitShown: boolean) => {
      if (ended) return
      ended = true
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('keydown', cancel)
      setGhost(null)
      setLive(null)
      setOutline(null)
      if (!commitShown) { setHint('已取消拖动'); setCanArrange(false); return }
      if (latest.kind === 'shift' && shown.key !== latest.key) { setHint('还没有停稳，位置保持不变'); setCanArrange(false); return }
      if (shown.ok && (shown.kind === 'move' || shown.kind === 'swap' || shown.kind === 'shift') && shown.key === latest.key) {
        onCommit?.(shown.widgets, 'manual')
        setHint('')
        setCanArrange(false)
        return
      }
      setHint(latest.kind === 'blocked' ? latest.reason : '')
      setCanArrange(latest.kind === 'blocked')
    }
    const move = (next: PointerEvent) => {
      const box = stageRef.current?.getBoundingClientRect()
      if (!box) return
      const cell = pointerToCell(((next.clientX - box.left) / box.width) * 100, ((next.clientY - box.top) / box.height) * 100)
      const preview = previewDrop(origin, widget.id, cell.col, cell.row, down.col, down.row)
      latest = preview
      setOutline(preview.mark ? { ...preview.mark, ok: preview.ok } : null)
      if (preview.kind === 'shift') {
        window.clearTimeout(timer)
        timer = window.setTimeout(() => { if (latest.key === preview.key) paint(preview) }, 160)
        return
      }
      window.clearTimeout(timer)
      paint(preview)
    }
    const end = () => finish(true)
    const cancel = (next: KeyboardEvent) => { if (next.key === 'Escape') finish(false) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('keydown', cancel)
  }

  function beginGridResize(event: ReactPointerEvent<HTMLElement>, widget: ScreenWidget, edge: Edge) {
    event.preventDefault()
    event.stopPropagation()
    const sizes = variantsFor(widget.type, widget.scope.mapScope ?? 'auto')
    const current = cellOf(widget)
    if (!current || sizes.length === 0) return
    const origin = template.widgets
    let last: DropPreview = { ok: true, kind: 'stay', widgets: origin, reason: '', key: 'stay' }
    const move = (next: PointerEvent) => {
      const box = stageRef.current?.getBoundingClientRect()
      if (!box) return
      const cell = pointerToCell(((next.clientX - box.left) / box.width) * 100, ((next.clientY - box.top) / box.height) * 100)
      const span = spanFromCorner(current, edge, cell.col, cell.row)
      const nearest = sizes.reduce((best, variant) => {
        const distance = Math.abs(variant.cols - span.cols) + Math.abs(variant.rows - span.rows)
        return distance < best.distance ? { variant, distance } : best
      }, { variant: sizes[0]!, distance: 99 })
      const preview = previewVariant(origin, widget.id, nearest.variant.id)
      last = preview
      setOutline(preview.mark ? { ...preview.mark, ok: preview.ok } : null)
      setCanArrange(!preview.ok)
      setHint(preview.reason)
      setLive(preview.ok && preview.kind !== 'stay' ? preview.widgets.map((item) => item.id === widget.id ? widget : item) : null)
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      setLive(null)
      setOutline(null)
      if (last.ok && last.kind !== 'stay') {
        onCommit?.(last.widgets, 'manual')
        setHint('')
        setCanArrange(false)
        return
      }
      setHint(last.kind === 'blocked' ? last.reason : '')
      setCanArrange(last.kind === 'blocked')
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  function beginResize(event: ReactPointerEvent<HTMLElement>, widget: ScreenWidget, edge: Edge) {
    if (!editing) return
    if (gridded && cellOf(widget)) {
      beginGridResize(event, widget, edge)
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startY = event.clientY
    const origin = template.widgets
    let last = origin
    const move = (next: PointerEvent) => {
      const stage = stageRef.current?.getBoundingClientRect()
      if (!stage) return
      const dx = ((next.clientX - startX) / stage.width) * 100
      const dy = ((next.clientY - startY) / stage.height) * 100
      const nextWidgets = resizeBy(origin, widget, edge, dx, dy)
      if (nextWidgets) {
        last = nextWidgets
        setLive(nextWidgets)
        setHint('松手后保留这个尺寸')
      } else {
        setHint('已经到最低可读尺寸或画布边界')
      }
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      setLive(null)
      if (last !== origin) onCommit?.(last, 'manual')
      setHint(last === origin ? '已经到最低可读尺寸，尺寸没有变化' : '')
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  const appearance = resolveAppearance(template)
  const palette = paletteOf(appearance.themeId)
  return (
    <DashThemeProvider value={{ palette, motion: appearance.motionEnabled }}>
    <div style={{ width: DESIGN_W * scale, height: DESIGN_H * scale, overflow: 'hidden' }}>
      <div className="dash-scale" data-theme={palette.id} data-motion={appearance.motionEnabled ? 'on' : 'off'} data-grid={editing && gridded ? '1' : undefined} style={{ width: DESIGN_W, height: DESIGN_H, transform: `scale(${scale})`, ...themeVars(palette) }} data-mode={mode}>
        <header className="dash-head">
          <strong>{template.name}</strong>
          <span>
            <em>{rangeLabel(template.globalFilters)}</em>
            <em>更新 2026-11-10 18:00</em>
            <em className="sim-mark">模拟演示</em>
          </span>
        </header>
        {template.selectedMetrics.length > 0 && (
          <div className="dash-metrics" style={{ gridTemplateColumns: `repeat(${template.selectedMetrics.length}, 1fr)` }}>
            {template.selectedMetrics.map((kind) => (
              <article key={kind} className="dash-card metric-card"><MetricValue template={template} kind={kind} /></article>
            ))}
          </div>
        )}
        <div className="dash-body-stage" ref={stageRef}>
          {template.widgets.length === 0 && <p className="dash-empty">还没有组件。打开「选择组件」勾选要展示的内容。</p>}
          {widgets.map((widget) => {
            const source = template.widgets.find((item) => item.id === widget.id)
            const shifting = Boolean(source && (source.x !== widget.x || source.y !== widget.y || source.w !== widget.w || source.h !== widget.h))
            const sizes = variantsFor(widget.type, widget.scope.mapScope ?? 'auto')
            return (
            <article
              key={widget.id}
              className={['dash-card', 'is-placed', selectedId === widget.id ? 'is-selected' : '', ghost === widget.id ? 'is-target' : '', shifting ? 'is-shifting' : '', editing ? 'is-edit' : ''].filter(Boolean).join(' ')}
              style={(() => {
                const rect = rects?.get(widget.id)
                return rect
                  ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h }
                  : { left: `${widget.x}%`, top: `${widget.y}%`, width: `${widget.w}%`, height: `${widget.h}%` }
              })()}
              onPointerDown={() => { if (editing) onSelect?.(widget.id) }}
            >
              <header className="dash-handle" role={editing ? 'button' : undefined} aria-label={editing ? `拖动${widget.title}` : undefined} onPointerDown={(event) => beginMove(event, widget)}>
                <b>{widget.title}</b>
                {editing && <em>按住标题拖动</em>}
              </header>
              <div className="dash-body">
                <ScreenWidgetBody template={template} widget={live ? (source ?? widget) : widget} transient={transient} interactive={!editing} showHints={editing} holdPlayback={holdPlayback} onNews={onNews} onHot={onHot} />
              </div>
              {editing && template.partition && selectedId === widget.id && (
                <div className="size-bar" onPointerDown={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => onSetFocus?.(widget.id)}>{widget.role === 'primary' ? '当前重点' : '设为重点'}</button>
                  <button type="button" onClick={() => onRemove?.(widget.id)}>删除</button>
                </div>
              )}
              {editing && gridded && selectedId === widget.id && (
                <div className="size-bar" onPointerDown={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => onSetFocus?.(widget.id)}>{widget.role === 'primary' ? '当前重点' : '设为重点'}</button>
                  <button type="button" aria-expanded={menuFor === widget.id} onClick={() => setMenuFor(menuFor === widget.id ? null : widget.id)}>尺寸</button>
                  <button type="button" onClick={() => onRemove?.(widget.id)}>删除</button>
                  {menuFor === widget.id && (
                    <div className="size-menu" role="menu">
                      {sizes.map((variant) => {
                        const preview = previewVariant(template.widgets, widget.id, variant.id)
                        return (
                          <button key={variant.id} type="button" role="menuitem" aria-pressed={widget.variantId === variant.id} onClick={() => {
                            if (widget.variantId === variant.id) { setMenuFor(null); return }
                            if (!preview.ok) { setHint(preview.reason); setCanArrange(true); return }
                            onCommit?.(preview.widgets, 'manual')
                            setMenuFor(null)
                            setHint('')
                            setCanArrange(false)
                          }}>
                            <i style={{ width: 22, height: Math.max(8, Math.round(22 * variant.rows / variant.cols)) }} />
                            <span>{variant.label}{preview.ok || widget.variantId === variant.id ? '' : ' · 空间不足'}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              {editing && !template.partition && ((gridded ? ['ne', 'nw', 'se', 'sw'] : ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw']) as Edge[]).map((edge) => (
                <div key={edge} role="button" className={`dash-resize ${edge}`} aria-label={gridded ? `切换${widget.title}尺寸` : `调整${widget.title}${edge}`} onPointerDown={(event) => beginResize(event, widget, edge)} />
              ))}
            </article>
            )
          })}
          {outline && <div className={outline.ok ? 'slot-outline' : 'slot-outline is-bad'} style={{ left: `${outline.x}%`, top: `${outline.y}%`, width: `${outline.w}%`, height: `${outline.h}%` }} />}
          {editing && activeTree && stageBox.w > 0 && dividerHits(activeTree, stageBox.w, stageBox.h).map((hit) => (
            <div
              key={`${hit.path.join('.')}-${hit.index}`}
              className={`split-handle is-${hit.axis}`}
              style={hit.axis === 'x'
                ? { left: hit.x - 4, top: hit.y, width: hit.w + 8, height: hit.h }
                : { left: hit.x, top: hit.y - 4, width: hit.w, height: hit.h + 8 }}
              onPointerDown={(event) => beginDivider(event, hit.path, hit.index, hit.axis)}
            />
          ))}
        </div>
        <footer className="dash-foot">模拟演示。地图颜色表示关联事件数，市州只在发生地能定位时着色。</footer>
        {hint && (
          <p className="dash-hint">
            {hint}
            {canArrange && onArrange && <button type="button" onClick={onArrange}>预览重新排版</button>}
          </p>
        )}
      </div>
    </div>
    </DashThemeProvider>
  )
}

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

function spanFromCorner(cell: { col: number; row: number; cols: number; rows: number }, edge: Edge, pointerCol: number, pointerRow: number) {
  const right = cell.col + cell.cols - 1
  const bottom = cell.row + cell.rows - 1
  if (edge === 'se') return { cols: Math.max(1, pointerCol - cell.col + 1), rows: Math.max(1, pointerRow - cell.row + 1) }
  if (edge === 'nw') return { cols: Math.max(1, right - pointerCol + 1), rows: Math.max(1, bottom - pointerRow + 1) }
  if (edge === 'ne') return { cols: Math.max(1, pointerCol - cell.col + 1), rows: Math.max(1, bottom - pointerRow + 1) }
  return { cols: Math.max(1, right - pointerCol + 1), rows: Math.max(1, pointerRow - cell.row + 1) }
}

function resizeBy(widgets: ScreenWidget[], widget: ScreenWidget, edge: Edge, dx: number, dy: number) {
  if (edge === 'ne' || edge === 'nw' || edge === 'se' || edge === 'sw') {
    const locked = widget.type === 'map' ? lockMapCorner(widget, edge, dx, dy) : { dx, dy }
    const horizontal = edge.includes('e') ? 'e' : 'w'
    const vertical = edge.includes('s') ? 's' : 'n'
    const across = resizeShared(widgets, widget, horizontal, locked.dx, locked.dy)
    const down = resizeShared(across ?? widgets, (across ?? widgets).find((item) => item.id === widget.id) ?? widget, vertical, locked.dx, locked.dy)
    return down ?? across
  }
  return resizeShared(widgets, widget, edge, dx, dy)
}

function lockMapCorner(widget: ScreenWidget, edge: Edge, dx: number, dy: number) {
  const growX = edge.includes('e') ? dx : -dx
  const growY = edge.includes('s') ? dy : -dy
  const ratio = widget.w / Math.max(widget.h, 0.01)
  let nextX = growX
  let nextY = growY
  if (Math.abs(growX) >= Math.abs(growY) * ratio) nextY = (widget.w + growX) / ratio - widget.h
  else nextX = (widget.h + growY) * ratio - widget.w
  return {
    dx: edge.includes('e') ? nextX : -nextX,
    dy: edge.includes('s') ? nextY : -nextY,
  }
}

function contains(item: ScreenWidget, x: number, y: number) {
  return x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h
}

function resizeShared(widgets: ScreenWidget[], widget: ScreenWidget, edge: 'n' | 's' | 'e' | 'w', dx: number, dy: number) {
  const horizontal = edge === 'e' || edge === 'w'
  let grow = edge === 'e' || edge === 's' ? (horizontal ? dx : dy) : -(horizontal ? dx : dy)
  const min = minSize(widget.type)
  if (widget.type === 'map') grow = clampMapGrow(widget, horizontal, grow)
  if (horizontal && widget.w + grow < min.w - 0.05) return null
  if (!horizontal && widget.h + grow < min.h - 0.05) return null
  if (Math.abs(grow) < 0.05) return null
  const neighbor = widgets.find((item) => {
    if (item.id === widget.id) return false
    if (edge === 'e') return Math.abs(item.x - (widget.x + widget.w)) < 3 && overlapSpan(item.y, item.h, widget.y, widget.h) > 8
    if (edge === 'w') return Math.abs(item.x + item.w - widget.x) < 3 && overlapSpan(item.y, item.h, widget.y, widget.h) > 8
    if (edge === 's') return Math.abs(item.y - (widget.y + widget.h)) < 3 && overlapSpan(item.x, item.w, widget.x, widget.w) > 8
    return Math.abs(item.y + item.h - widget.y) < 3 && overlapSpan(item.x, item.w, widget.x, widget.w) > 8
  })
  if (!neighbor) {
    const next = boxAfter(widget, edge, grow)
    if (next.x < -0.2 || next.y < -0.2 || next.x + next.w > 100.2 || next.y + next.h > 100.2) return null
    return widgets.map((item) => item.id === widget.id ? { ...item, ...next } : item)
  }
  const neighborMin = minSize(neighbor.type)
  const room = horizontal ? neighbor.w - neighborMin.w : neighbor.h - neighborMin.h
  if (grow > 0 && room <= 0) return null
  const taken = grow > 0 ? Math.min(grow, room) : grow
  if (taken === 0) return null
  return widgets.map((item) => {
    if (item.id === widget.id) return { ...item, ...boxAfter(widget, edge, taken) }
    if (item.id === neighbor.id) return { ...item, ...boxAfter(neighbor, opposite(edge), -taken) }
    return item
  })
}

function clampMapGrow(widget: ScreenWidget, horizontal: boolean, grow: number) {
  const hard = shapeProfile('map', widget.scope.mapScope ?? 'auto', widget.role).hardAspectRatio ?? [0.75, 1.7]
  if (horizontal) {
    const maxW = widget.h * hard[1] / BODY_ASPECT
    const minW = Math.max(minSize('map').w, widget.h * hard[0] / BODY_ASPECT)
    return Math.min(Math.max(widget.w + grow, minW), maxW) - widget.w
  }
  const maxH = widget.w * BODY_ASPECT / hard[0]
  const minH = Math.max(minSize('map').h, widget.w * BODY_ASPECT / hard[1])
  return Math.min(Math.max(widget.h + grow, minH), maxH) - widget.h
}

function opposite(edge: 'n' | 's' | 'e' | 'w'): 'n' | 's' | 'e' | 'w' {
  if (edge === 'e') return 'w'
  if (edge === 'w') return 'e'
  if (edge === 's') return 'n'
  return 's'
}

function boxAfter(widget: ScreenWidget, edge: 'n' | 's' | 'e' | 'w', grow: number) {
  if (edge === 'e') return { x: widget.x, y: widget.y, w: widget.w + grow, h: widget.h }
  if (edge === 'w') return { x: widget.x - grow, y: widget.y, w: widget.w + grow, h: widget.h }
  if (edge === 's') return { x: widget.x, y: widget.y, w: widget.w, h: widget.h + grow }
  return { x: widget.x, y: widget.y - grow, w: widget.w, h: widget.h + grow }
}

function overlapSpan(a: number, sizeA: number, b: number, sizeB: number) {
  return Math.min(a + sizeA, b + sizeB) - Math.max(a, b)
}

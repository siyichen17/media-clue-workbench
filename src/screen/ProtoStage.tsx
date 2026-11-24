import { useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import type { NewsItem } from '../types/domain.ts'
import type { CanvasWidget } from './protoCatalog.ts'
import { PROTO_WIDGETS } from './protoCatalog.ts'
import type { ProtoPack } from './protoData.ts'
import { inside, minSize, overlaps, type ProtoRect } from './protoStore.ts'
import { WidgetBody } from './ProtoWidgets.tsx'

type RectMap = Record<string, ProtoRect>

function snap(value: number) {
  return Math.round(value)
}

function measure(container: HTMLElement): RectMap {
  const base = container.getBoundingClientRect()
  const next: RectMap = {}
  container.querySelectorAll<HTMLElement>('[data-wid]').forEach((node) => {
    const id = node.dataset.wid
    if (!id || base.width === 0 || base.height === 0) return
    const rect = node.getBoundingClientRect()
    next[id] = {
      x: ((rect.left - base.left) / base.width) * 100,
      y: ((rect.top - base.top) / base.height) * 100,
      w: (rect.width / base.width) * 100,
      h: (rect.height / base.height) * 100,
    }
  })
  return next
}

export function ProtoStage({
  widgets,
  pack,
  mode,
  editing,
  rects,
  onRects,
  onReject,
  onOpen,
  onRemove,
  measureRef,
  toolbar,
}: {
  widgets: CanvasWidget[]
  pack: ProtoPack
  mode: 'thumb' | 'full'
  editing: boolean
  rects: RectMap | null
  onRects: (rects: RectMap | null) => void
  onReject: (message: string) => void
  onOpen: (title: string, items: NewsItem[]) => void
  onRemove?: (id: string, rects: RectMap) => void
  measureRef?: MutableRefObject<(() => RectMap) | null>
  toolbar?: ReactNode
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  if (measureRef) measureRef.current = () => (boxRef.current ? measure(boxRef.current) : {})
  const [live, setLive] = useState<RectMap | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const shown = live ?? rects
  const kpis = widgets.filter((widget) => PROTO_WIDGETS[widget.type]?.type === 'kpi')
  const others = widgets.filter((widget) => PROTO_WIDGETS[widget.type]?.type !== 'kpi')
  const cols = others.length <= 4 ? 2 : others.length <= 6 ? 3 : 4
  let widgetType = 0

  function place(start: ProtoRect, kind: 'move' | 'e' | 's' | 'se', dx: number, dy: number): ProtoRect {
    const limits = minSize(widgetType)
    let next = { ...start }
    if (kind === 'move') {
      next = { ...start, x: snap(start.x + dx), y: snap(start.y + dy) }
      next.x = Math.min(Math.max(0, next.x), 100 - next.w)
      next.y = Math.min(Math.max(0, next.y), 100 - next.h)
    } else {
      if (kind === 'e' || kind === 'se') next.w = snap(Math.max(limits.w, start.w + dx))
      if (kind === 's' || kind === 'se') next.h = snap(Math.max(limits.h, start.h + dy))
      next.w = Math.min(next.w, 100 - next.x)
      next.h = Math.min(next.h, 100 - next.y)
    }
    return next
  }

  function begin(event: React.PointerEvent, widget: CanvasWidget, kind: 'move' | 'e' | 's' | 'se') {
    if (!editing) return
    const handle = (event.target as HTMLElement).closest('.proto-handle, .proto-resize')
    if (kind === 'move' && !handle) return
    event.preventDefault()
    event.stopPropagation()
    setSelected(widget.id)
    const box = boxRef.current
    if (!box) return
    const origin = rects ?? measure(box)
    const startRect = origin[widget.id]
    if (!startRect) return
    const bounds = box.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    widgetType = widget.type
    const moved = (ev: PointerEvent) => Math.abs(ev.clientX - startX) > 2 || Math.abs(ev.clientY - startY) > 2
    const delta = (ev: PointerEvent) => ({
      dx: ((ev.clientX - startX) / bounds.width) * 100,
      dy: ((ev.clientY - startY) / bounds.height) * 100,
    })
    const move = (ev: PointerEvent) => {
      if (!moved(ev)) return
      const shift = delta(ev)
      setLive({ ...origin, [widget.id]: place(startRect, kind, shift.dx, shift.dy) })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const shift = delta(ev)
      const next = place(startRect, kind, shift.dx, shift.dy)
      const map = { ...origin, [widget.id]: next }
      const blocked = !inside(next) || Object.entries(map).some(([id, rect]) => id !== widget.id && overlaps(rect, next))
      setLive(null)
      if (!moved(ev)) return
      if (blocked) {
        onReject('这个位置会重叠或超出画布，已退回原处')
        return
      }
      onRects(map)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function remove(widget: CanvasWidget) {
    if (!onRemove) return
    const origin = rects ?? (boxRef.current ? measure(boxRef.current) : {})
    const next = { ...origin }
    delete next[widget.id]
    onRemove(widget.id, next)
  }

  function frame(widget: CanvasWidget) {
    const rect = shown?.[widget.id]
    const style = rect ? { position: 'absolute' as const, left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` } : undefined
    return (
      <div
        key={widget.id}
        data-wid={widget.id}
        className={`proto-frame${mode === 'thumb' ? ' preview-widget' : ''}${editing ? ' is-editing' : ''}${selected === widget.id && editing ? ' is-selected' : ''}`}
        style={style}
        onPointerDown={(event) => begin(event, widget, 'move')}
        onClick={(event) => { if (editing) { event.stopPropagation(); setSelected(widget.id) } }}
      >
        <WidgetBody widget={widget} pack={pack} mode={mode} editing={editing} onOpen={onOpen} />
        {editing && rect && selected === widget.id && <span className="proto-size">{Math.round(rect.w)}% × {Math.round(rect.h)}%</span>}
        {editing && onRemove && (
          <button type="button" className="proto-remove" aria-label={`删除${widget.title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); remove(widget) }}>×</button>
        )}
        {editing && (
          <>
            <i className="proto-resize e" onPointerDown={(event) => { event.stopPropagation(); begin(event, widget, 'e') }} />
            <i className="proto-resize s" onPointerDown={(event) => { event.stopPropagation(); begin(event, widget, 's') }} />
            <i className="proto-resize se" onPointerDown={(event) => { event.stopPropagation(); begin(event, widget, 'se') }} />
          </>
        )}
      </div>
    )
  }

  const free = Boolean(shown)
  const flow = mode === 'thumb' ? (
    <>
      {kpis.length > 0 && <div className="proto-thumb-kpis">{kpis.map(frame)}</div>}
      {others.map(frame)}
    </>
  ) : (
    <>
      {kpis.length > 0 && <div className="proto-kpi-row">{kpis.map(frame)}</div>}
      <div className="proto-full-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>{others.map(frame)}</div>
    </>
  )
  return (
    <div className={editing ? 'proto-stage is-editing' : 'proto-stage'}>
      {toolbar}
      <div className={mode === 'thumb' ? (free ? 'preview-grid is-free' : 'preview-grid') : (free ? 'proto-full-body is-free' : 'proto-full-body')} ref={boxRef}>
        {widgets.length === 0 ? <div className="proto-stage-empty">暂无组件，请在左侧添加</div> : (free ? widgets.map(frame) : flow)}
      </div>
    </div>
  )
}

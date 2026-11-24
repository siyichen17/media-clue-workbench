import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NewsDrawer } from '../components/news/NewsDrawer.tsx'
import { DATA_AS_OF_LABEL, presetLabel } from '../lib/dates.ts'
import { dateRangeOf } from '../lib/dates.ts'
import type { DrawerModel, NewsItem } from '../types/domain.ts'
import { ScreenWidgetBody } from './ScreenWidgets.tsx'
import { resolvePlacement } from './grid.ts'
import { listTemplates } from './store.ts'
import { EMPTY_TRANSIENT, rangeLabel, type TransientFilters } from './query.ts'
import type { ScreenTemplate, ScreenWidget } from './types.ts'

export function ScreenStage({
  template,
  mode,
  scale,
  transient,
  selectedId,
  notice,
  onSelect,
  onCommit,
  onReject,
  onTransient,
}: {
  template: ScreenTemplate
  mode: 'edit' | 'view' | 'preview'
  scale: number
  transient: TransientFilters
  selectedId: string | null
  notice: string
  onSelect: (id: string | null) => void
  onCommit: (widgets: ScreenWidget[]) => void
  onReject: (reason: string) => void
  onTransient: (next: TransientFilters) => void
}) {
  const navigate = useNavigate()
  const gridRef = useRef<HTMLDivElement>(null)
  const [drawer, setDrawer] = useState<DrawerModel | null>(null)
  const [ghost, setGhost] = useState<ScreenWidget | null>(null)
  const editing = mode === 'edit'
  const range = dateRangeOf(template.globalFilters)
  const active = ghost ? template.widgets.map((item) => item.id === ghost.id ? ghost : item) : template.widgets

  function openNews(items: NewsItem[], title: string) {
    if (editing || items.length === 0) return
    setDrawer({ kind: 'news', tags: [{ id: 'screen', label: title }], items })
  }

  function beginDrag(widget: ScreenWidget, event: React.PointerEvent, kind: 'move' | 'resize') {
    if (!editing) return
    event.preventDefault()
    event.stopPropagation()
    onSelect(widget.id)
    const host = gridRef.current
    if (!host) return
    const rect = host.getBoundingClientRect()
    const colW = rect.width / template.canvas.cols
    const rowH = rect.height / template.canvas.rows
    const startX = event.clientX
    const startY = event.clientY
    let next = widget
    const move = (ev: PointerEvent) => {
      const dx = Math.round((ev.clientX - startX) / colW)
      const dy = Math.round((ev.clientY - startY) / rowH)
      next = kind === 'move'
        ? { ...widget, x: widget.x + dx, y: widget.y + dy }
        : { ...widget, w: widget.w + dx, h: widget.h + dy }
      setGhost(next)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setGhost(null)
      const resolved = resolvePlacement(template.widgets, next)
      if (!resolved.ok) {
        onReject(resolved.reason)
        return
      }
      const changed = resolved.widgets.some((item) => {
        const prev = template.widgets.find((row) => row.id === item.id)
        return !prev || prev.x !== item.x || prev.y !== item.y || prev.w !== item.w || prev.h !== item.h
      })
      if (changed) onCommit(resolved.widgets)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="screen-stage" style={{ transform: `scale(${scale})` }} data-mode={mode}>
      <header className="screen-top">
        <div>
          <h1>{template.name}</h1>
          <p>{presetLabel(template.globalFilters.preset)} · {range.start} 至 {range.end} · 数据截止 {DATA_AS_OF_LABEL} · 模拟数据</p>
        </div>
        <div className="screen-top-actions">
          {mode !== 'edit' && (
            <select aria-label="切换模板" value={template.templateId} onChange={(event) => navigate(`/screen/view/${event.target.value}`)}>
              {listTemplates().system.map((item) => <option key={item.templateId} value={item.templateId}>{item.name}</option>)}
              {listTemplates().mine.map((item) => <option key={item.templateId} value={item.templateId}>{item.name}</option>)}
            </select>
          )}
          {mode === 'preview' && <span className="screen-pill">未保存预览</span>}
          {notice && <span className="screen-pill">{notice}</span>}
        </div>
      </header>
      {(transient.selectedDay || transient.categoryId || transient.topicId || transient.mediaId) && template.linkFilters && (
        <div className="screen-filters">
          <span>临时筛选 {transient.selectedDay ?? ''} {transient.topicId ?? ''} {transient.categoryId ?? ''} {transient.mediaId ?? ''}</span>
          <button type="button" onClick={() => onTransient(EMPTY_TRANSIENT)}>清除筛选</button>
        </div>
      )}
      <div className="screen-grid" ref={gridRef} style={{ gridTemplateColumns: `repeat(${template.canvas.cols}, 1fr)`, gridTemplateRows: `repeat(${template.canvas.rows}, 1fr)` }}>
        {active.map((widget) => (
          <section
            key={widget.id}
            className={selectedId === widget.id ? 'screen-card selected' : 'screen-card'}
            style={{ gridColumn: `${widget.x + 1} / span ${widget.w}`, gridRow: `${widget.y + 1} / span ${widget.h}` }}
            onClick={() => editing && onSelect(widget.id)}
          >
            <header className="screen-card-head" onPointerDown={(event) => beginDrag(widget, event, 'move')}>
              <strong>{widget.title}</strong>
              <small>{widget.followGlobal ? rangeLabel(template.globalFilters) : `${rangeLabel(widget.scope)} · 独立范围`}</small>
            </header>
            <div className="screen-card-body">
              <ScreenWidgetBody
                template={template}
                widget={widget}
                transient={transient}
                interactive={!editing}
                onNews={openNews}
                onHot={() => undefined}
              />
            </div>
            {editing && selectedId === widget.id && <button type="button" className="screen-resize" aria-label="调整宽高" onPointerDown={(event) => beginDrag(widget, event, 'resize')} />}
          </section>
        ))}
      </div>
      <div className="screen-dark-news">
        <NewsDrawer model={drawer} followedIds={new Set()} onClose={() => setDrawer(null)} onToggleFollow={() => undefined} entry="overview" />
      </div>
    </div>
  )
}

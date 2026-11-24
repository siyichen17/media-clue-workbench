import { useState } from 'react'
import { DashboardRenderer } from './DashboardRenderer.tsx'
import { EMPTY_TRANSIENT } from './query.ts'
import { groupedWidgetSpecs, METRIC_SPECS, type MetricKind, type ScreenTemplate, type ScreenWidget, type WidgetKind } from './types.ts'
import type { LayoutCandidate } from './compose.ts'
import type { CompositionPick } from './pick.ts'
import { GRID_VERSION, variantsFor } from './slots.ts'

export function CompositionPanel({
  pick,
  onToggleType,
  onRemove,
  onFocus,
  onToggleMetric,
  onShowPlans,
  onClose,
}: {
  pick: CompositionPick
  onToggleType: (type: WidgetKind) => void
  onRemove: (id: string) => void
  onFocus: (id: string) => void
  onToggleMetric: (kind: MetricKind) => void
  onShowPlans: () => void
  onClose: () => void
}) {
  return (
    <aside className="compose-drawer">
      <header>
        <h3>选择组件</h3>
        <button type="button" className="dash-btn" onClick={onClose}>关闭</button>
      </header>
      <div className="compose-columns">
        <section>
          <h4>组件</h4>
          {groupedWidgetSpecs().map((group) => (
            <div key={group.group}>
              <h5>{group.label}</h5>
              {group.specs.map((spec) => {
                const checked = pick.widgets.some((item) => item.type === spec.type)
                return (
                  <label key={spec.type} className={checked ? 'compose-card on' : 'compose-card'}>
                    <input type="checkbox" checked={checked} onChange={() => onToggleType(spec.type)} />
                    <WidgetSketch type={spec.type} />
                    <span>
                      <strong>{spec.name}</strong>
                      <em>{spec.purpose}。可选{variantsFor(spec.type, 'auto').map((item) => item.label).join('／')}。</em>
                    </span>
                  </label>
                )
              })}
            </div>
          ))}
        </section>
        <section>
          <h4>已选组件</h4>
          {pick.widgets.length === 0 && <p className="compose-note">还没有勾选组件。</p>}
          <ul className="compose-picked">
            {pick.widgets.map((item) => (
              <li key={item.id}>
                <button type="button" className={item.id === pick.focusId ? 'star on' : 'star'} onClick={() => onFocus(item.id)} aria-pressed={item.id === pick.focusId}>
                  {item.id === pick.focusId ? '重点' : '设为重点'}
                </button>
                <span>{item.title}</span>
                <button type="button" className="dash-btn" onClick={() => onRemove(item.id)}>取消</button>
              </li>
            ))}
          </ul>
          {pick.widgets.some((item) => item.type === 'peers') && <p className="compose-note">同行报道对比是旧模板里的组件，会保留到你取消它。</p>}
          <h4>指标</h4>
          <p className="compose-note">最多四个，显示在主体上方。全部取消后，主体用回这块高度。</p>
          <div className="compose-metrics">
            {METRIC_SPECS.map((spec) => (
              <label key={spec.type}>
                <input type="checkbox" checked={pick.metrics.includes(spec.type)} onChange={() => onToggleMetric(spec.type)} />
                {spec.name}
              </label>
            ))}
          </div>
          <button type="button" className="dash-btn primary" onClick={onShowPlans}>查看排版方案</button>
        </section>
      </div>
    </aside>
  )
}

export function PlanStrip({
  draft,
  candidates,
  more,
  metrics,
  reason,
  activeId,
  notice,
  onSelect,
  onApply,
  onRestore,
  canRestore,
  onClose,
}: {
  draft: ScreenTemplate
  candidates: LayoutCandidate[]
  more: LayoutCandidate[]
  metrics: ScreenTemplate['selectedMetrics']
  reason: string
  activeId: string | null
  notice: string
  onSelect: (id: string) => void
  onApply: () => void
  onRestore: () => void
  canRestore: boolean
  onClose: () => void
}) {
  const [showMore, setShowMore] = useState(false)
  const [place, setPlace] = useState<'all' | 'left' | 'top' | 'center'>('all')
  const [size, setSize] = useState<'recommended' | 'standard' | 'large' | 'xlarge'>('recommended')
  const pool = [...candidates, ...more]
  const focusTitle = pool[0]?.focusTitle ?? draft.widgets.find((item) => item.role === 'primary')?.title ?? '未选择'
  const matched = pool.filter((item) => (place === 'all' || item.place === place) && (size === 'recommended' || item.size === size))
  const shown = showMore ? matched : matched.slice(0, 3)
  const extraCount = Math.max(0, matched.length - 3)
  const emptyFilter = pool.length > 0 && matched.length === 0
  return (
    <section className="plan-strip">
      <header>
        <strong>排版方案</strong>
        <span>当前重点：{focusTitle}</span>
        <span>{notice}</span>
        <span className="plan-filters" role="group" aria-label="位置筛选">
          {([['all', '全部'], ['left', '靠左'], ['top', '靠上'], ['center', '居中']] as const).map(([id, label]) => (
            <button key={id} type="button" className="dash-btn" aria-pressed={place === id} onClick={() => { setPlace(id); setShowMore(false) }}>{label}</button>
          ))}
        </span>
        <span className="plan-filters" role="group" aria-label="尺寸筛选">
          {([['recommended', '推荐'], ['standard', '标准'], ['large', '大'], ['xlarge', '超大']] as const).map(([id, label]) => (
            <button key={id} type="button" className="dash-btn" aria-pressed={size === id} onClick={() => { setSize(id); setShowMore(false) }}>{label}</button>
          ))}
        </span>
        {extraCount > 0 && <button type="button" className="dash-btn" onClick={() => setShowMore((value) => !value)}>{showMore ? '收起更多排版' : `更多排版（${extraCount}）`}</button>}
        {extraCount === 0 && shown.length > 0 && <span>已展示全部可用排版</span>}
        <button type="button" className="dash-btn" disabled={!canRestore} onClick={onRestore}>恢复所选排版</button>
        <button type="button" className="dash-btn primary" disabled={!activeId} onClick={onApply}>应用此排版</button>
        <button type="button" className="dash-btn" onClick={onClose}>关闭</button>
      </header>
      {reason && <p className="compose-note">{reason}</p>}
      {emptyFilter && (
        <p className="compose-note">
          {size === 'xlarge' ? '超大重点放不下当前组件。可以改看「大」或「标准」。组件没有被缩小或隐藏。' : '这个位置或尺寸放不下当前组件。组件没有被缩小或隐藏。'}
          <button type="button" className="dash-btn" onClick={() => { setPlace('all'); setSize('recommended') }}>清除筛选</button>
        </p>
      )}
      <div className="plan-row">
        {shown.map((item) => (
          <button type="button" key={item.id} className={item.id === activeId ? 'plan-card on' : 'plan-card'} aria-label={`${item.name}，重点 ${item.focusTitle}`} onClick={() => onSelect(item.id)}>
            <span className="plan-preview">
              <DashboardRenderer template={previewTemplate(draft, item, metrics)} mode="preview" scale={420 / 1920} transient={EMPTY_TRANSIENT} onNews={() => undefined} onHot={() => undefined} />
            </span>
            <strong>{item.name}</strong>
            <em>重点：{item.focusTitle}</em>
          </button>
        ))}
      </div>
    </section>
  )
}

function WidgetSketch({ type }: { type: WidgetKind }) {
  return (
    <span className={`widget-sketch is-${type}`} aria-hidden="true">
      <i /><i /><i />
    </span>
  )
}

export function previewTemplate(draft: ScreenTemplate, candidate: LayoutCandidate, metrics: ScreenTemplate['selectedMetrics']): ScreenTemplate {
  const current = new Map(draft.widgets.map((item) => [item.id, item]))
  return {
    ...draft,
    selectedMetrics: metrics,
    layoutMode: 'generated',
    layoutRecipeId: candidate.id,
    primaryWidgetId: candidate.focusId,
    partition: candidate.tree,
    focusSize: candidate.size,
    focusPlace: candidate.place,
    tuned: false,
    gridVersion: candidate.tree ? undefined : draft.gridVersion,
    widgets: candidate.widgets.map((item) => {
      const saved = current.get(item.id)
      if (!saved) return item
      return { ...item, title: saved.title, scope: saved.scope, display: saved.display, followGlobal: saved.followGlobal }
    }),
  }
}

export function withBaselineGeometry(draft: ScreenTemplate): ScreenTemplate | null {
  const baseline = draft.layoutBaseline
  if (!baseline) return null
  const boxes = new Map(baseline.boxes.map((item) => [item.id, item]))
  if (draft.widgets.length !== baseline.boxes.length || draft.widgets.some((item) => !boxes.has(item.id))) return null
  return {
    ...draft,
    layoutMode: 'generated',
    layoutRecipeId: baseline.recipeId,
    primaryWidgetId: baseline.boxes.find((item) => item.role === 'primary')?.id ?? draft.primaryWidgetId ?? null,
    partition: baseline.partition,
    focusSize: baseline.focusSize,
    focusPlace: baseline.focusPlace,
    tuned: false,
    gridVersion: baseline.partition ? undefined : [...boxes.values()].every((box) => box.variantId && box.col !== undefined && box.row !== undefined) ? GRID_VERSION : undefined,
    widgets: draft.widgets.map((item) => {
      const box = boxes.get(item.id)
      if (!box) return item
      if (box.variantId && box.col !== undefined && box.row !== undefined) {
        return { ...item, x: box.x, y: box.y, w: box.w, h: box.h, role: box.role, variantId: box.variantId, col: box.col, row: box.row }
      }
      const rest = { ...item }
      delete rest.variantId
      delete rest.col
      delete rest.row
      return { ...rest, x: box.x, y: box.y, w: box.w, h: box.h, role: box.role }
    }),
  }
}

export function geometryMatches(widgets: ScreenWidget[], baseline: ScreenTemplate['layoutBaseline']) {
  if (!baseline || widgets.length !== baseline.boxes.length) return false
  return baseline.boxes.every((box) => {
    const widget = widgets.find((item) => item.id === box.id)
    return widget && widget.x === box.x && widget.y === box.y && widget.w === box.w && widget.h === box.h && widget.role === box.role
  })
}

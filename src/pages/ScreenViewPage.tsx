import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { NewsDrawer } from '../components/news/NewsDrawer.tsx'
import { CompositionPanel, PlanStrip, geometryMatches, previewTemplate, withBaselineGeometry } from '../screen/CompositionPanel.tsx'
import { DashboardRenderer, DESIGN_H, DESIGN_W, type BoardMode } from '../screen/DashboardRenderer.tsx'
import { generateLayoutCandidates, LAYOUT_ENGINE, layoutBaseline } from '../screen/compose.ts'
import { ThemePanel } from '../screen/ThemePanel.tsx'
import { resolveAppearance, type DashboardAppearance } from '../screen/theme.ts'
import { EMPTY_TRANSIENT, eventsIn, monitorMedia, widgetModel } from '../screen/query.ts'
import { focusWidget, removeWidget, seedPick, toggleMetric, toggleType, type CompositionPick } from '../screen/pick.ts'
import { bodyPixels, paint, removeLeaf } from '../screen/partition.ts'
import { getTemplate, isBuiltin, rememberScreen, saveDashboard } from '../screen/store.ts'
import { defaultPresentation, widgetSpec, type LayoutNode, type MetricKind, type PresentationSettings, type ScreenTemplate, type ScreenWidget } from '../screen/types.ts'
import type { DrawerModel } from '../types/domain.ts'
import '../screen/screen.css'

const emptyFollows = new Set<string>()

function ProgressSetting({ draft, widget, onChange }: { draft: ScreenTemplate; widget: ScreenWidget; onChange: (eventId: string) => void }) {
  let events: { id: string; name: string }[] = []
  try {
    events = eventsIn(widgetModel(draft, widget, EMPTY_TRANSIENT).news)
  } catch {
    events = []
  }
  return (
    <label>事件
      <select value={widget.scope.eventId} onChange={(event) => onChange(event.target.value)}>
        <option value="">当前范围最新事件</option>
        {events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
  )
}

function FocusSetting({ draft, widget, onChange }: { draft: ScreenTemplate; widget: ScreenWidget; onChange: (articleId: string) => void }) {
  let articles: { id: string; title: string }[] = []
  try {
    articles = [...widgetModel(draft, widget, EMPTY_TRANSIENT).news]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id))
      .slice(0, 8)
      .map((item) => ({ id: item.id, title: item.title }))
  } catch {
    articles = []
  }
  return (
    <label>焦点内容
      <select value={widget.scope.focusArticleId ?? ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">按最近更新轮播</option>
        {articles.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
    </label>
  )
}

function PlaybackSetting({ draft, onChange }: { draft: ScreenTemplate; onChange: (partial: Partial<PresentationSettings>) => void }) {
  const play = { ...defaultPresentation(), ...draft.presentation }
  return (
    <fieldset className="media-picks">
      <legend>播放</legend>
      <label><input type="checkbox" checked={play.autoplay} onChange={(event) => onChange({ autoplay: event.target.checked })} />焦点新闻轮播</label>
      <label>间隔秒
        <input type="number" min={8} max={60} value={play.intervalSeconds} onChange={(event) => onChange({ intervalSeconds: Math.min(60, Math.max(8, Number(event.target.value) || 12)) })} />
      </label>
      <label><input type="checkbox" checked={play.rotateHotPlatform} onChange={(event) => onChange({ rotateHotPlatform: event.target.checked })} />热搜平台缓慢切换</label>
      <label><input type="checkbox" checked={play.pauseOnHover} onChange={(event) => onChange({ pauseOnHover: event.target.checked })} />悬停时暂停</label>
      <label><input type="checkbox" checked={play.motionEnabled} onChange={(event) => onChange({ motionEnabled: event.target.checked })} />入场动效</label>
    </fieldset>
  )
}

function CoverageSetting({ widget, onChange }: { widget: ScreenWidget; onChange: (mediaIds: string[]) => void }) {
  const media = monitorMedia()
  const selected = new Set(widget.scope.mediaIds ?? [])
  return (
    <fieldset className="media-picks">
      <legend>媒体范围</legend>
      <p>{selected.size ? '只统计勾选的媒体' : '未勾选时沿用当前监控媒体'}</p>
      {media.map((item) => (
        <label key={item.id}>
          <input type="checkbox" checked={selected.has(item.id)} onChange={() => {
            const next = new Set(selected)
            if (next.has(item.id)) next.delete(item.id)
            else next.add(item.id)
            onChange([...next])
          }} />
          {item.name}
        </label>
      ))}
    </fieldset>
  )
}

export function ScreenViewPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const incoming = (location.state as { draft?: ScreenTemplate } | null)?.draft ?? null
  const saved = getTemplate(id)
  const editing = new URLSearchParams(location.search).get('edit') === '1'
  const preview = new URLSearchParams(location.search).get('preview') === '1'
  const initial = (editing || preview) && incoming ? incoming : saved
  const [draft, setDraft] = useState<ScreenTemplate | null>(initial)
  const [baseline, setBaseline] = useState<ScreenTemplate | null>(saved ?? initial)
  const [activeId, setActiveId] = useState(id)
  const idRef = useRef(id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState<'fit' | '50' | '75' | '100'>('fit')
  const [fit, setFit] = useState(1)
  const [composeOpen, setComposeOpen] = useState(false)
  const [plansOpen, setPlansOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [themePreview, setThemePreview] = useState<DashboardAppearance | null>(null)
  const [pick, setPick] = useState<CompositionPick | null>(null)
  const [name, setName] = useState(initial?.name ?? '')
  const [error, setError] = useState('')
  const [status, setStatus] = useState(saved ? '已保存' : '未保存')
  const [drawer, setDrawer] = useState<DrawerModel | null>(null)
  const [leave, setLeave] = useState(false)
  const undoRef = useRef<ScreenTemplate[]>([])
  const redoRef = useRef<ScreenTemplate[]>([])
  const [history, setHistory] = useState({ undo: 0, redo: 0 })
  const frameRef = useRef<HTMLDivElement>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline)

  useEffect(() => {
    if (draft) setName(draft.name)
  }, [draft?.name])

  useEffect(() => {
    const node = frameRef.current
    if (!node) return
    const measure = () => {
      const rect = node.getBoundingClientRect()
      setFit(Math.min(rect.width / DESIGN_W, rect.height / DESIGN_H))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [editing, preview])

  const scale = zoom === 'fit' ? fit : zoom === '50' ? 0.5 : zoom === '75' ? 0.75 : 1
  const mode: BoardMode = preview ? 'preview' : editing ? 'edit' : 'display'

  function commit(next: ScreenTemplate) {
    if (!draft) return
    undoRef.current.push(draft)
    redoRef.current = []
    setDraft(next)
    setHistory({ undo: undoRef.current.length, redo: 0 })
    setStatus('未保存')
    setError('')
  }

  function undo() {
    const previous = undoRef.current.pop()
    if (!previous || !draft) return
    redoRef.current.push(draft)
    setDraft(previous)
    setPick(seedPick(previous))
    setHistory({ undo: undoRef.current.length, redo: redoRef.current.length })
  }

  function redo() {
    const next = redoRef.current.pop()
    if (!next || !draft) return
    undoRef.current.push(draft)
    setDraft(next)
    setPick(seedPick(next))
    setHistory({ undo: undoRef.current.length, redo: redoRef.current.length })
  }

  function ensurePick() {
    if (!draft) return null
    const next = pick ?? seedPick(draft)
    if (!pick) setPick(next)
    return next
  }

  function openCompose() {
    ensurePick()
    setPlansOpen(false)
    setThemeOpen(false)
    setComposeOpen(true)
  }

  function openPlans() {
    ensurePick()
    setComposeOpen(false)
    setThemeOpen(false)
    setPlansOpen(true)
  }

  function openTheme() {
    if (!draft) return
    setThemePreview(resolveAppearance(draft))
    setComposeOpen(false)
    setPlansOpen(false)
    setThemeOpen(true)
  }

  function applyTheme() {
    if (!draft || !themePreview) return
    commit({
      ...draft,
      appearance: themePreview,
      presentation: { ...defaultPresentation(), ...draft.presentation, motionEnabled: themePreview.motionEnabled },
    })
    setThemeOpen(false)
  }

  function updateWidget(id: string, recipe: (widget: ScreenWidget) => ScreenWidget) {
    if (!draft) return
    commit({ ...draft, widgets: draft.widgets.map((item) => item.id === id ? recipe(item) : item) })
  }

  function stageRemove() {
    if (!draft || !selectedId) return
    const next = removeWidget(pick ?? seedPick(draft), selectedId)
    setPick(next)
    setComposeOpen(false)
    setPlansOpen(true)
    setError('')
  }

  function changePick(recipe: (current: CompositionPick) => CompositionPick) {
    if (!draft) return
    setPick(recipe(pick ?? seedPick(draft)))
    setError('')
  }

  function applyActive() {
    if (!draft || !pick) return
    const result = generateLayoutCandidates(pick.widgets, pick.focusId)
    const listed = [...result.candidates, ...result.more]
    const candidate = listed.find((item) => item.id === pick.activeRecipe) ?? result.candidates[0]
    if (!candidate) { setError(result.reason); return }
    const baseline = layoutBaseline(candidate)
    const next = previewTemplate(draft, candidate, pick.metrics)
    commit({
      ...next,
      layoutPreset: candidate.id === 'left' ? 'leftFocus' : candidate.id === 'stack' ? 'topFocus' : 'mapCenter',
      layoutBaseline: baseline,
      layoutEngine: LAYOUT_ENGINE,
      gridVersion: undefined,
      partition: candidate.tree,
      focusSize: candidate.size,
      focusPlace: candidate.place,
      tuned: false,
      primaryWidgetId: candidate.focusId,
    })
    setPlansOpen(false)
    setError('')
  }

  function setPlacedFocus(id: string) {
    if (!draft) return
    commit({
      ...draft,
      primaryWidgetId: id,
      layoutMode: 'manual',
      widgets: draft.widgets.map((item) => ({ ...item, role: item.id === id ? 'primary' as const : 'secondary' as const })),
    })
  }

  function removePlaced(id: string) {
    if (!draft) return
    const widgets = draft.widgets.filter((item) => item.id !== id)
    const primary = widgets.some((item) => item.id === draft.primaryWidgetId) ? draft.primaryWidgetId ?? null : widgets[0]?.id ?? null
    const tree = draft.partition ? removeLeaf(draft.partition, id) : undefined
    const body = bodyPixels(draft.selectedMetrics.length > 0)
    const painted = tree ? paint(widgets, tree, body.width, body.height) : widgets
    commit({
      ...draft,
      partition: tree ?? undefined,
      primaryWidgetId: primary,
      layoutMode: 'manual',
      widgets: painted.map((item) => ({ ...item, role: item.id === primary ? 'primary' as const : 'secondary' as const })),
    })
    if (selectedId === id) setSelectedId(null)
  }

  function applyPartition(tree: LayoutNode, widgets: ScreenWidget[], tuned: boolean) {
    if (!draft) return
    commit({ ...draft, partition: tree, widgets, tuned, layoutMode: 'manual', gridVersion: undefined })
  }

  function restoreLayout() {
    if (!draft) return
    const restored = withBaselineGeometry(draft)
    if (!restored) { setError('组件已经变化，请重新查看排版方案。'); return }
    commit(restored)
  }

  function rename(value: string) {
    if (!draft || value === draft.name) return
    commit({ ...draft, name: value })
  }

  function save(next: 'stay' | 'display' | 'leave' = 'stay') {
    if (!draft) return false
    const titled = name.trim()
    const current = titled && titled !== draft.name ? { ...draft, name: titled } : draft
    const result = saveDashboard(idRef.current, current)
    if (!result.ok) { setError(result.error); setStatus('保存失败，草稿还在'); return false }
    idRef.current = result.template.templateId
    setDraft(result.template)
    setBaseline(result.template)
    setActiveId(result.template.templateId)
    setStatus(result.created ? '已另存为个人模板' : '已保存')
    setError('')
    const savedId = result.template.templateId
    rememberScreen(savedId)
    if (next === 'display') navigate(`/screen/view/${savedId}`, { replace: true })
    else if (next === 'leave') navigate('/screen', { state: { templateId: savedId } })
    else if (result.created) navigate(`/screen/view/${savedId}?edit=1`, { replace: true, state: { draft: result.template } })
    return true
  }

  if (!draft) return <main className="proto-missing"><p>没有找到这份大屏。</p><Link to="/screen">返回配置页</Link></main>
  if (mode === 'display' && !draft.widgets.some((item) => item.role === 'primary')) {
    return <main className="proto-missing"><p>没有主位组件，不能正式展示。</p><Link to="/screen">返回配置页</Link></main>
  }
  const selected = draft.widgets.find((item) => item.id === selectedId) ?? null
  const plans = pick ? generateLayoutCandidates(pick.widgets, pick.focusId) : { candidates: [], more: [], reason: '' }
  const chosen = [...plans.candidates, ...plans.more].find((item) => item.id === pick?.activeRecipe) ?? null
  const viewingPlan = Boolean(editing && plansOpen && chosen && pick)
  const canvasTemplate = viewingPlan && chosen && pick ? previewTemplate(draft, chosen, pick.metrics) : draft
  const shownTemplate = themeOpen && themePreview
    ? { ...canvasTemplate, appearance: themePreview, presentation: { ...defaultPresentation(), ...canvasTemplate.presentation, motionEnabled: themePreview.motionEnabled } }
    : canvasTemplate
  const canvasMode: BoardMode = viewingPlan ? 'preview' : mode

  return (
    <main className="screen-editor">
      <div className={mode === 'display' ? 'dash-float-bar' : 'screen-editor-bar'}>
        <div className="bar-side">
          <button type="button" className="dash-btn" onClick={() => { if (dirty && editing) { setLeave(true); return } rememberScreen(activeId); navigate('/screen', { state: { templateId: activeId } }) }}>返回</button>
          {editing ? (
            <input className="name-input" aria-label="模板名称" value={name} onChange={(event) => setName(event.target.value)} onBlur={() => rename(name.trim() || draft.name)} />
          ) : <strong>{draft.name}</strong>}
          <span>{dirty ? '有未保存修改' : status}</span>
        </div>
        <div className="bar-side">
          {editing && <button type="button" className="dash-btn" onClick={() => composeOpen ? setComposeOpen(false) : openCompose()}>选择组件</button>}
          {editing && !draft.partition && <button type="button" className="dash-btn" onClick={() => openPlans()}>升级为分区布局</button>}
          {editing && draft.tuned && <span>已微调</span>}
          {editing && <button type="button" className="dash-btn" onClick={() => plansOpen ? setPlansOpen(false) : openPlans()}>排版方案</button>}
          {editing && <button type="button" className="dash-btn" onClick={() => themeOpen ? setThemeOpen(false) : openTheme()}>主题</button>}
          {editing && <button type="button" className="dash-btn" disabled={!history.undo} onClick={undo}>撤销</button>}
          {editing && <button type="button" className="dash-btn" disabled={!history.redo} onClick={redo}>重做</button>}
          {editing && <button type="button" className="dash-btn" onClick={() => navigate(`/screen/view/${activeId}?preview=1`, { state: { draft } })}>预览</button>}
          <button type="button" className="dash-btn" onClick={() => document.fullscreenElement ? document.exitFullscreen().catch(() => setError('没有退出浏览器全屏，草稿还在')) : document.documentElement.requestFullscreen().catch(() => setError('浏览器没有进入全屏，当前页面已经铺满窗口'))}>全屏</button>
          {editing && <button type="button" className="dash-btn" onClick={() => { if (baseline) { setDraft(structuredClone(baseline)); setPick(null); setPlansOpen(false); setComposeOpen(false); setThemeOpen(false) } undoRef.current = []; redoRef.current = []; setHistory({ undo: 0, redo: 0 }); setStatus('已恢复最近保存版本') }}>取消</button>}
          {editing && <button type="button" className="dash-btn primary" onClick={() => save()}>保存</button>}
          {!editing && <button type="button" className="dash-btn" onClick={() => navigate(`/screen/view/${activeId}?edit=1`, { state: { draft } })}>编辑</button>}
        </div>
      </div>
      {error && <p className="dash-form-error">{error}</p>}
      <div className="screen-editor-stage" ref={frameRef}>
        {viewingPlan && <p className="plan-banner">{`正在预览分区方案「${chosen?.name}」。应用后才替换，关闭则保留原来的布局。`}</p>}
        <DashboardRenderer
          template={shownTemplate}
          mode={canvasMode}
          scale={scale || 1}
          selectedId={selectedId}
          transient={EMPTY_TRANSIENT}
          onCommit={(widgets, layoutMode) => commit({ ...draft, widgets, layoutMode, gridVersion: draft.gridVersion })}
          onSetFocus={setPlacedFocus}
          onRemove={removePlaced}
          onPartition={applyPartition}
          onArrange={() => openPlans()}
          onSelect={setSelectedId}
          onNews={(items, title) => setDrawer({ kind: 'news', tags: [{ id: 'screen', label: title }], items, note: '模拟数据，截止 2026-11-10 18:00。' })}
          holdPlayback={drawer !== null || themeOpen}
          onHot={(eventId) => navigate('/hot', { state: { eventId, from: `/screen/view/${activeId}` } })}
        />
        {editing && (
          <div className="canvas-zoom">
            <button type="button" className={zoom === 'fit' ? 'on' : ''} onClick={() => setZoom('fit')}>适应画布</button>
            <button type="button" className={zoom === '75' ? 'on' : ''} onClick={() => setZoom('75')}>75%</button>
            <button type="button" className={zoom === '100' ? 'on' : ''} onClick={() => setZoom('100')}>100%</button>
          </div>
        )}
      </div>
      {editing && composeOpen && pick && (
        <CompositionPanel
          pick={pick}
          onToggleType={(type) => changePick((current) => toggleType(current, type))}
          onRemove={(id) => changePick((current) => removeWidget(current, id))}
          onFocus={(id) => changePick((current) => focusWidget(current, id))}
          onToggleMetric={(kind: MetricKind) => {
            const next = toggleMetric(pick, kind)
            setPick(next.pick)
            setError(next.error)
          }}
          onShowPlans={openPlans}
          onClose={() => setComposeOpen(false)}
        />
      )}
      {editing && selected && !viewingPlan && (
        <aside className="screen-editor-panel right">
          <header className="panel-head">
            <h3>{selected.title}</h3>
            <button type="button" className="dash-btn" onClick={() => setSelectedId(null)}>关闭</button>
          </header>
          <p className="panel-purpose">{widgetSpec(selected.type)?.purpose}</p>
          {selected.type === 'eventRank' && (
            <label>排序
              <select value={selected.display.sort} onChange={(event) => updateWidget(selected.id, (item) => ({ ...item, display: { ...item.display, sort: event.target.value === 'count' ? 'count' : 'latest' } }))}>
                <option value="latest">最近报道时间</option>
                <option value="count">当前范围报道数</option>
              </select>
            </label>
          )}
          {selected.type === 'hotBoard' && (
            <label>平台
              <select value={selected.scope.hotPlatform} onChange={(event) => updateWidget(selected.id, (item) => ({ ...item, scope: { ...item.scope, hotPlatform: event.target.value === '百度' ? '百度' : '微博' } }))}>
                <option value="微博">微博</option>
                <option value="百度">百度</option>
              </select>
            </label>
          )}
          {selected.type === 'progress' && <ProgressSetting draft={draft} widget={selected} onChange={(eventId) => updateWidget(selected.id, (item) => ({ ...item, scope: { ...item.scope, eventId } }))} />}
          {selected.type === 'coverage' && <CoverageSetting widget={selected} onChange={(mediaIds) => updateWidget(selected.id, (item) => ({ ...item, scope: { ...item.scope, mediaIds } }))} />}
          {selected.type === 'map' && (
            <>
              <label>地图范围
                <select value={selected.scope.mapScope ?? 'auto'} onChange={(event) => updateWidget(selected.id, (item) => ({ ...item, scope: { ...item.scope, mapScope: event.target.value === 'china' ? 'china' : event.target.value === 'sichuan' ? 'sichuan' : 'auto' } }))}>
                  <option value="auto">按数据推荐</option>
                  <option value="sichuan">四川</option>
                  <option value="china">全国</option>
                </select>
              </label>
              <label>着色指标
                <select value={selected.scope.mapMetric ?? 'eventCount'} onChange={(event) => updateWidget(selected.id, (item) => ({ ...item, scope: { ...item.scope, mapMetric: event.target.value === 'articleCount' ? 'articleCount' : 'eventCount' } }))}>
                  <option value="eventCount">关联事件数</option>
                  <option value="articleCount">报道数</option>
                </select>
              </label>
            </>
          )}
          {selected.type === 'newsList' && <FocusSetting draft={draft} widget={selected} onChange={(focusArticleId) => updateWidget(selected.id, (item) => ({ ...item, scope: { ...item.scope, focusArticleId } }))} />}
          <PlaybackSetting draft={draft} onChange={(partial) => commit({
            ...draft,
            presentation: { ...defaultPresentation(), ...draft.presentation, ...partial },
            appearance: typeof partial.motionEnabled === 'boolean'
              ? { ...resolveAppearance(draft), motionEnabled: partial.motionEnabled }
              : draft.appearance,
          })} />
          <button type="button" className="dash-btn" onClick={stageRemove}>移出并查看新排版</button>
        </aside>
      )}
      {editing && themeOpen && themePreview && (
        <ThemePanel
          value={themePreview}
          onChange={setThemePreview}
          onApply={applyTheme}
          onClose={() => setThemeOpen(false)}
          onReset={() => setThemePreview({ ...themePreview, motionEnabled: true })}
        />
      )}
      {editing && plansOpen && pick && (
        <PlanStrip
          draft={draft}
          metrics={pick.metrics}
          candidates={plans.candidates}
          more={plans.more}
          reason={plans.reason}
          activeId={pick.activeRecipe}
          notice="点方案只预览。应用后才替换画布，关闭则保留原来的布局。"
          onSelect={(id) => setPick({ ...pick, activeRecipe: id })}
          onApply={applyActive}
          onRestore={restoreLayout}
          canRestore={Boolean(draft.layoutBaseline) && !geometryMatches(draft.widgets, draft.layoutBaseline)}
          onClose={() => setPlansOpen(false)}
        />
      )}
      {leave && (
        <div className="dash-leave">
          <section>
            <h2>还有未保存的修改</h2>
            <button type="button" className="dash-btn primary" onClick={() => save('leave')}>保存后离开</button>
            <button type="button" className="dash-btn" onClick={() => navigate('/screen', { state: { templateId: activeId } })}>放弃修改</button>
            <button type="button" className="dash-btn" onClick={() => setLeave(false)}>继续编辑</button>
          </section>
        </div>
      )}
      <NewsDrawer model={drawer} followedIds={emptyFollows} onClose={() => setDrawer(null)} onToggleFollow={() => undefined} entry="overview" />
      {isBuiltin(draft.templateId) && mode === 'display' && <span className="sr-only">内置模板</span>}
    </main>
  )
}

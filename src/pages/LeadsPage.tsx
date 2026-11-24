import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { NewsDrawer } from '../components/news/NewsDrawer.tsx'
import { TOPICS, categoryById } from '../data/demo/catalog.ts'
import { DATA_END, DATA_START, formatStamp } from '../lib/dates.ts'
import { eventCatalog, hotNews } from '../lib/hotSelectors.ts'
import { loadProgressCache } from '../lib/hotStorage.ts'
import {
  actorName,
  absorbDraft,
  addManualArticles,
  archiveLead,
  attachReport,
  createManualLead,
  currentActor,
  detachReport,
  downloadCsv,
  findLead,
  freshArticles,
  leadTopic,
  leadsToCsv,
  markSeen,
  outcomeLabel,
  removeManualArticle,
  renameLead,
  restoreLead,
  returnPending,
  sameTitleLeads,
  saveNextPlan,
  saveNotes,
  startLead,
  statusLabel,
  syncEventArticles,
  visibleLeads,
  type ArchiveOutcome,
  type Lead,
  type LeadEntry,
  type LeadStatus,
} from '../lib/leads.ts'
import { levelLabel, materialLevel, materialNature, natureLabel } from '../lib/material.ts'
import { statusLabel as reportStatus, typeLabel } from '../lib/reportMeta.ts'
import { listReports } from '../lib/reportStore.ts'
import type { NewsItem } from '../types/domain.ts'
import type { ReportDocument } from '../types/report.ts'
import './leads.css'

const PAGE_SIZE = 20
const VIEW_KEY = 'clue-leads-view-v1'

interface LeadView {
  status: 'all' | LeadStatus
  q: string
  owner: string
  topic: string
  entry: '' | LeadEntry
  mine: boolean
  fresh: boolean
  from: string
  to: string
  sort: 'default' | 'action' | 'created'
  page: number
}

const DEFAULT_VIEW: LeadView = {
  status: 'all', q: '', owner: '', topic: '', entry: '', mine: false, fresh: false, from: '', to: '', sort: 'default', page: 1,
}

function readView(): LeadView {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY)
    return raw ? { ...DEFAULT_VIEW, ...JSON.parse(raw) as LeadView } : DEFAULT_VIEW
  } catch {
    return DEFAULT_VIEW
  }
}

function statusRank(status: LeadStatus) {
  if (status === 'pending') return 0
  if (status === 'active') return 1
  return 2
}

export function LeadsPage() {
  const [params, setParams] = useSearchParams()
  const news = useMemo(() => hotNews(), [])
  const newsById = useMemo(() => new Map(news.map((item) => [item.id, item])), [news])
  const [rows, setRows] = useState<Lead[]>(() => visibleLeads())
  const actor = currentActor()
  const [view, setView] = useState<LeadView>(readView)
  const [selected, setSelected] = useState<string[]>([])
  const [reports, setReports] = useState<ReportDocument[]>([])
  const [openId, setOpenId] = useState<string | null>(params.get('lead'))
  const [tab, setTab] = useState<'info' | 'materials' | 'analysis' | 'log'>('info')
  const [noteDraft, setNoteDraft] = useState('')
  const [noteDirty, setNoteDirty] = useState(false)
  const [leaveAsk, setLeaveAsk] = useState(false)
  const [archiveFor, setArchiveFor] = useState<string[] | null>(null)
  const [outcome, setOutcome] = useState<ArchiveOutcome>('topic')
  const [outcomeNote, setOutcomeNote] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [picker, setPicker] = useState(false)
  const [notice, setNotice] = useState('')
  const [batchNote, setBatchNote] = useState('')
  const [materialFilter, setMaterialFilter] = useState<'all' | 'fresh'>('all')
  const [drawerItems, setDrawerItems] = useState<NewsItem[] | null>(null)
  const [mergeDraft, setMergeDraft] = useState<{ title: string; notes: string; articleIds: string[]; targetId: string } | null>(null)
  const queryLead = params.get('lead')
  const returnFocus = useRef<HTMLElement | null>(null)
  const events = useMemo(() => eventCatalog(news), [news])

  function reload() {
    syncEventArticles(news)
    setRows(visibleLeads())
  }

  useEffect(() => {
    reload()
    void listReports().then(setReports).catch(() => setNotice('报告列表读取失败，线索列表仍可使用。'))
    const saved = Number(sessionStorage.getItem('clue-leads-scroll') || '0')
    window.scrollTo(0, saved)
    const onScroll = () => sessionStorage.setItem('clue-leads-scroll', String(window.scrollY))
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    sessionStorage.setItem(VIEW_KEY, JSON.stringify(view))
  }, [view])

  useEffect(() => {
    if (!queryLead) return
    const lead = findLead(queryLead)
    if (!lead || lead.mergedInto) return
    setOpenId((current) => {
      if (current !== queryLead) setTab('info')
      return queryLead
    })
    setNoteDraft(lead.notes)
    setNoteDirty(false)
  }, [queryLead])

  function patchView(partial: Partial<LeadView>, resetPage = true) {
    setSelected([])
    setView((current) => ({ ...current, ...partial, page: resetPage ? 1 : partial.page ?? current.page }))
  }

  function matches(lead: Lead, status: 'all' | LeadStatus) {
    if (status !== 'all' && lead.status !== status) return false
    const topic = leadTopic(lead, news)
    const eventName = lead.eventId ? news.find((item) => item.eventId === lead.eventId)?.eventName ?? '' : ''
    const bag = `${lead.title} ${eventName} ${lead.notes}`.toLowerCase()
    if (view.q && !bag.includes(view.q.trim().toLowerCase())) return false
    if (view.topic && topic?.topic.id !== view.topic && topic?.category.id !== view.topic) return false
    if (view.entry && !lead.entryPoints.includes(view.entry)) return false
    if (view.fresh && (lead.status === 'archived' || freshArticles(lead, actor).length === 0)) return false
    const day = lead.lastActionAt.slice(0, 10)
    if (view.from && day < view.from) return false
    if (view.to && day > view.to) return false
    return true
  }

  const scoped = rows.filter((lead) => matches(lead, 'all'))
  const counts = {
    all: scoped.length,
    pending: scoped.filter((lead) => lead.status === 'pending').length,
    active: scoped.filter((lead) => lead.status === 'active').length,
    archived: scoped.filter((lead) => lead.status === 'archived').length,
  }
  const filtered = scoped.filter((lead) => matches(lead, view.status))
  const sorted = [...filtered].sort((a, b) => {
    if (view.sort === 'created') return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
    if (view.sort === 'action') return b.lastActionAt.localeCompare(a.lastActionAt) || a.id.localeCompare(b.id)
    const freshDelta = Number(freshArticles(b, actor).length > 0 && b.status !== 'archived') - Number(freshArticles(a, actor).length > 0 && a.status !== 'archived')
    return statusRank(a.status) - statusRank(b.status) || freshDelta || b.lastActionAt.localeCompare(a.lastActionAt) || a.id.localeCompare(b.id)
  })
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const page = Math.min(view.page, pages)
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const opened = openId ? findLead(openId) : null

  function openLead(id: string) {
    const lead = findLead(id)
    if (!lead || lead.mergedInto) return
    returnFocus.current = document.activeElement as HTMLElement
    setOpenId(id)
    setTab('info')
    setNoteDraft(lead.notes)
    setNoteDirty(false)
    setMaterialFilter('all')
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('lead', id)
      return next
    }, { replace: true })
  }

  function closeLead() {
    setOpenId(null)
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('lead')
      return next
    }, { replace: true })
    returnFocus.current?.focus()
  }

  function askClose() {
    if (noteDirty) setLeaveAsk(true)
    else closeLead()
  }

  useEffect(() => {
    if (!openId && !createOpen && !archiveFor) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (archiveFor) setArchiveFor(null)
        else if (createOpen) setCreateOpen(false)
        else askClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function run(ids: string[], action: (id: string) => Lead | null) {
    let ok = 0
    let skipped = 0
    ids.forEach((id) => {
      const before = findLead(id)
      const after = action(id)
      if (before && after && after.updatedAt !== before.updatedAt) ok += 1
      else skipped += 1
    })
    reload()
    return { ok, skipped }
  }

  function exportRows(list: Lead[], label: string) {
    downloadCsv(`线索清单-${label}.csv`, leadsToCsv(list, news))
  }

  const pageIds = pageRows.map((lead) => lead.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id))

  return (
    <main className="leads-page">
      <header className="lead-top">
        <div>
          <h1>我的跟进</h1>
          <p>记下拟题、下一步和处理结果。关注只负责接收变化，结束跟进不会取消关注。</p>
        </div>
        <div className="lead-actions">
          <button type="button" className="btn-quiet" onClick={() => setCreateOpen(true)}>新建线索</button>
          <details>
            <summary className="btn-text">更多</summary>
            <div>
              <button type="button" className="btn-text" onClick={() => exportRows(filtered, '当前筛选')}>导出线索清单</button>
            </div>
          </details>
        </div>
      </header>
      <div className="lead-tabs" role="tablist" aria-label="线索状态">
        {([['all', '全部'], ['pending', '待处理'], ['active', '跟进中'], ['archived', '已结束']] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view.status === id} onClick={() => patchView({ status: id })}>{label} {counts[id]}</button>
        ))}
      </div>
      <section className="lead-card">
        <div className="lead-filters">
          <input type="search" value={view.q} placeholder="搜索标题、事件或备注" aria-label="搜索线索" onChange={(event) => patchView({ q: event.target.value })} />
          <select aria-label="主题或分类" value={view.topic} onChange={(event) => patchView({ topic: event.target.value })}>
            <option value="">全部主题</option>
            {Object.values(categoryById).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            {TOPICS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <label className="lead-check"><input type="checkbox" checked={view.fresh} onChange={(event) => patchView({ fresh: event.target.checked })} />有更新</label>
          <details>
            <summary className="btn-text">更多筛选</summary>
            <div className="lead-filters">
              <select aria-label="加入途径" value={view.entry} onChange={(event) => patchView({ entry: event.target.value as LeadView['entry'] })}>
                <option value="">全部途径</option>
                <option value="overview">线索总览</option>
                <option value="hot">热搜追踪</option>
                <option value="compete">竞品监控</option>
                <option value="manual">手工新建</option>
                <option value="legacy">早期跟进</option>
              </select>
              <input type="date" aria-label="最近跟进起" min={DATA_START} max={DATA_END} value={view.from} onChange={(event) => patchView({ from: event.target.value })} />
              <input type="date" aria-label="最近跟进止" min={DATA_START} max={DATA_END} value={view.to} onChange={(event) => patchView({ to: event.target.value })} />
              <select aria-label="排序" value={view.sort} onChange={(event) => patchView({ sort: event.target.value as LeadView['sort'] }, false)}>
                <option value="default">待处理优先</option>
                <option value="action">最近跟进</option>
                <option value="created">创建时间</option>
              </select>
              <button type="button" className="btn-text" onClick={() => patchView(DEFAULT_VIEW)}>重置筛选</button>
            </div>
          </details>
        </div>
        {selected.length > 0 && (
          <div className="lead-bulk">
            <strong>已选 {selected.length} 条</strong>
            <button type="button" className="btn-quiet" onClick={() => { const result = run(selected, startLead); setBatchNote(`开始跟进 ${result.ok} 条，${result.skipped} 条不是待处理。`) }}>继续跟进</button>
            <button type="button" className="btn-quiet" onClick={() => { setArchiveError(''); setArchiveFor(selected) }}>结束跟进</button>
            <button type="button" className="btn-text" onClick={() => exportRows(rows.filter((lead) => selected.includes(lead.id)), '已选')}>导出线索清单</button>
          </div>
        )}
        {batchNote && <p className="lead-banner">{batchNote}</p>}
        {notice && <p className="lead-banner">{notice}</p>}
        {sorted.length === 0 ? (
          <div>
            {rows.length === 0 ? (
              <p>还没有跟进。可以先到热点里发现事件，再加入跟进。只关注不会出现在这里。</p>
            ) : view.status !== 'all' && scoped.length > 0 ? (
              <p>这个状态下没有线索。</p>
            ) : (
              <p>没有符合筛选的线索。<button type="button" className="btn-text" onClick={() => patchView(DEFAULT_VIEW)}>清除筛选</button></p>
            )}
          </div>
        ) : (
          <div className="lead-table-wrap">
            <table className="lead-table">
              <thead>
                <tr>
                  <th><input type="checkbox" aria-label="全选当前页" checked={allPageSelected} onChange={(event) => setSelected(event.target.checked ? pageIds : [])} /></th>
                  <th>事件 / 拟题</th>
                  <th>下一步计划</th>
                  <th>未看新增材料</th>
                  <th>状态</th>
                  <th>最近跟进</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((lead) => {
                  const topic = leadTopic(lead, news)
                  const fresh = lead.status === 'archived' ? [] : freshArticles(lead, actor)
                  const eventName = lead.eventId ? news.find((item) => item.eventId === lead.eventId)?.eventName : ''
                  const pitch = lead.savedPitches?.find((item) => item.main) ?? lead.savedPitches?.[0]
                  const headline = eventName || lead.title
                  const pitchTitle = pitch?.title && pitch.title !== headline ? pitch.title : ''
                  return (
                    <tr key={lead.id} data-selected={selected.includes(lead.id) ? 'true' : 'false'}>
                      <td><input type="checkbox" aria-label={`选择 ${lead.title}`} checked={selected.includes(lead.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, lead.id] : current.filter((id) => id !== lead.id))} /></td>
                      <td>
                        <div className="lead-title" title={headline}>{headline}</div>
                        <p className="lead-faint">{pitchTitle || topic?.topic.name || '未关联主题'} · 材料 {lead.articles.length} 篇</p>
                      </td>
                      <td>{lead.nextPlan?.trim() ? lead.nextPlan.trim().slice(0, 42) : '还没写'}</td>
                      <td>{fresh.length > 0 ? <button type="button" className="btn-text" onClick={() => { openLead(lead.id); setTab('materials'); setMaterialFilter('fresh') }}>{fresh.length} 篇</button> : '无'}</td>
                      <td><span className={`lead-tag ${lead.status}`}>{statusLabel(lead.status)}</span></td>
                      <td>{lead.lastActionAt}</td>
                      <td>
                        <div className="lead-ops">
                          <button type="button" className="btn-quiet" onClick={() => openLead(lead.id)}>继续跟进</button>
                          {lead.status !== 'archived' && <button type="button" className="btn-text" onClick={() => { setArchiveError(''); setArchiveFor([lead.id]) }}>结束跟进</button>}
                          {lead.status === 'archived' && <button type="button" className="btn-text" onClick={() => { run([lead.id], restoreLead); setBatchNote('已恢复跟进，历史记录仍在。') }}>恢复跟进</button>}
                          <details>
                            <summary className="btn-text">更多</summary>
                            <div>
                              {lead.status === 'active' && <button type="button" className="btn-text" onClick={() => { run([lead.id], returnPending); setBatchNote('已退回待处理。') }}>退回待处理</button>}
                              <button type="button" className="btn-text" onClick={() => exportRows([lead], lead.title.slice(0, 12))}>导出这条清单</button>
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="lead-pager">
          <span className="lead-faint">共 {sorted.length} 条 · 第 {page}/{pages} 页 · 每页 {PAGE_SIZE} 条 · 全选只作用于当前页</span>
          <div>
            <button type="button" className="btn-quiet" disabled={page <= 1} onClick={() => { setSelected([]); setView((current) => ({ ...current, page: page - 1 })) }}>上一页</button>
            <button type="button" className="btn-quiet" disabled={page >= pages} onClick={() => { setSelected([]); setView((current) => ({ ...current, page: page + 1 })) }}>下一页</button>
          </div>
        </div>
      </section>
      {opened && <LeadDrawer
        lead={opened}
        news={news}
        newsById={newsById}
        reports={reports}
        actor={actor}
        tab={tab}
        setTab={setTab}
        noteDraft={noteDraft}
        noteDirty={noteDirty}
        materialFilter={materialFilter}
        setMaterialFilter={setMaterialFilter}
        onNote={(value) => { setNoteDraft(value); setNoteDirty(value !== opened.notes) }}
        onClose={askClose}
        onSaveNote={() => { const saved = saveNotes(opened.id, noteDraft); if (!saved) setNotice('备注保存失败。'); else { setNoteDirty(false); reload() } }}
        onCancelNote={() => { setNoteDraft(opened.notes); setNoteDirty(false) }}
        onReload={reload}
        onArchive={() => { setArchiveError(''); setArchiveFor([opened.id]) }}
        onOpenNews={setDrawerItems}
        onPick={() => setPicker(true)}
        onNotice={setNotice}
      />}
      {leaveAsk && (
        <div className="lead-mask">
          <section className="lead-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-title">
            <h2 id="leave-title">备注还没保存</h2>
            <p>关闭后这次修改会丢掉。保存会写入工作备注，不会改新闻正文。</p>
            <div className="lead-actions">
              <button type="button" className="btn-primary" onClick={() => { if (opened) saveNotes(opened.id, noteDraft); setNoteDirty(false); setLeaveAsk(false); reload(); closeLead() }}>保存并关闭</button>
              <button type="button" className="btn-quiet" onClick={() => { setLeaveAsk(false); setNoteDirty(false); closeLead() }}>放弃修改</button>
              <button type="button" className="btn-text" onClick={() => setLeaveAsk(false)}>继续编辑</button>
            </div>
          </section>
        </div>
      )}
      {archiveFor && (
        <div className="lead-mask">
          <section className="lead-dialog" role="dialog" aria-modal="true" aria-labelledby="archive-title">
            <h2 id="archive-title">结束跟进</h2>
            <p>结束后进入已结束列表。材料、分析草稿、备注和报告关联都保留。这只记录你的处理结果，不代表新闻已经发布，也不会定稿或删除报告。主题关注不受影响。已结束的线索不再作为未读更新提醒，恢复后可以继续查看新增报道。</p>
            <label>处理结果
              <select value={outcome} onChange={(event) => setOutcome(event.target.value as ArchiveOutcome)}>
                <option value="topic">形成选题</option>
                <option value="handoff">已交接</option>
                <option value="pause">暂不跟进</option>
                <option value="other">其他</option>
              </select>
            </label>
            <p className="lead-faint">“已交接”只记在这条线索上，系统没有发送消息，对方也还没有确认。</p>
            <textarea aria-label="处理说明" value={outcomeNote} onChange={(event) => setOutcomeNote(event.target.value)} placeholder="请填写简短结果" />
            {archiveError && <p className="lead-banner">{archiveError}</p>}
            <div className="lead-actions">
              <button type="button" className="btn-primary" onClick={() => {
                try {
                  const result = run(archiveFor, (id) => archiveLead(id, outcome, outcomeNote))
                  setBatchNote(`已结束跟进 ${result.ok} 条，${result.skipped} 条没有变化。报告没有被定稿或删除。`)
                  setArchiveFor(null)
                  setOutcomeNote('')
                } catch (error) {
                  setArchiveError(error instanceof Error ? error.message : '归档失败')
                }
              }}>确认结束</button>
              <button type="button" className="btn-quiet" onClick={() => setArchiveFor(null)}>取消</button>
            </div>
          </section>
        </div>
      )}
      {createOpen && <CreateDialog news={news} events={events} onClose={() => setCreateOpen(false)} onDone={(id) => { setCreateOpen(false); reload(); if (id) openLead(id) }} onExists={(draft) => setMergeDraft(draft)} />}
      {mergeDraft && (
        <div className="lead-mask">
          <section className="lead-dialog" role="dialog" aria-modal="true" aria-labelledby="merge-title">
            <h2 id="merge-title">这个事件已有线索</h2>
            <p>可以打开已有记录，或把当前草稿并进去。已有标题和负责人保持不变，备注追加，材料按报道编号去重。再次合并不会重复写入。</p>
            <p className="lead-faint">草稿标题「{mergeDraft.title}」，说明：{mergeDraft.notes || '无'}，材料 {mergeDraft.articleIds.length} 篇。</p>
            <div className="lead-actions">
              <button type="button" className="btn-primary" onClick={() => { const id = mergeDraft.targetId; setMergeDraft(null); setCreateOpen(false); openLead(id) }}>打开已有记录</button>
              <button type="button" className="btn-quiet" onClick={() => { const saved = absorbDraft(mergeDraft.targetId, mergeDraft); setMergeDraft(null); setCreateOpen(false); reload(); if (saved) openLead(saved.id) }}>合并草稿</button>
              <button type="button" className="btn-text" onClick={() => setMergeDraft(null)}>取消</button>
            </div>
          </section>
        </div>
      )}
      {picker && opened && <Picker news={news} exclude={new Set(opened.articles.map((item) => item.articleId))} onClose={() => setPicker(false)} onAdd={(ids) => { addManualArticles(opened.id, ids); setPicker(false); reload() }} />}
      <NewsDrawer
        model={drawerItems ? { kind: 'news', tags: [{ id: 'lead', label: '线索材料' }], items: drawerItems, note: '从线索打开的报道。关注按钮只收藏材料，不会新建线索。' } : null}
        followedIds={new Set()}
        entry="overview"
        onClose={() => setDrawerItems(null)}
        onToggleFollow={() => undefined}
      />
    </main>
  )
}

function LeadDrawer({
  lead, news, newsById, reports, actor, tab, setTab, noteDraft, noteDirty, materialFilter, setMaterialFilter, onNote, onClose, onSaveNote, onCancelNote, onReload, onArchive, onOpenNews, onPick, onNotice,
}: {
  lead: Lead
  news: NewsItem[]
  newsById: Map<string, NewsItem>
  reports: ReportDocument[]
  actor: string
  tab: 'info' | 'materials' | 'analysis' | 'log'
  setTab: (tab: 'info' | 'materials' | 'analysis' | 'log') => void
  noteDraft: string
  noteDirty: boolean
  materialFilter: 'all' | 'fresh'
  setMaterialFilter: (value: 'all' | 'fresh') => void
  onNote: (value: string) => void
  onClose: () => void
  onSaveNote: () => void
  onCancelNote: () => void
  onReload: () => void
  onArchive: () => void
  onOpenNews: (items: NewsItem[]) => void
  onPick: () => void
  onNotice: (text: string) => void
}) {
  const navigate = useNavigate()
  const topic = leadTopic(lead, news)
  const eventName = lead.eventId ? news.find((item) => item.eventId === lead.eventId)?.eventName : ''
  const fresh = freshArticles(lead, actor)
  const [plan, setPlan] = useState(lead.nextPlan ?? '')
  useEffect(() => { setPlan(lead.nextPlan ?? '') }, [lead.id, lead.nextPlan])
  const shown = lead.articles
    .map((item) => ({ meta: item, news: newsById.get(item.articleId) ?? null }))
    .filter((item) => materialFilter === 'all' || fresh.some((row) => row.articleId === item.meta.articleId))
    .sort((a, b) => (b.news?.publishedAt ?? '').localeCompare(a.news?.publishedAt ?? ''))
  const eventReports = reports.filter((item) => item.scope.eventId && item.scope.eventId === lead.eventId)
  const manualReports = reports.filter((item) => lead.reportRefs.some((ref) => ref.reportId === item.id) && !eventReports.some((row) => row.id === item.id))
  const progress = loadProgressCache().filter((item) => item.eventId === lead.eventId)
  useEffect(() => {
    const close = document.getElementById('lead-close')
    close?.focus()
  }, [lead.id])
  return (
    <div className="lead-mask" onClick={onClose}>
      <aside className="lead-drawer" role="dialog" aria-modal="true" aria-labelledby="lead-drawer-title" onClick={(event) => event.stopPropagation()}>
        <header>
          <div className="lead-row">
            <div>
              <h2 id="lead-drawer-title">{lead.title}</h2>
              <p className="lead-faint"><span className={`lead-tag ${lead.status}`}>{statusLabel(lead.status)}</span> · 最近跟进 {lead.lastActionAt}</p>
            </div>
            <button id="lead-close" type="button" className="btn-quiet" onClick={onClose}>关闭</button>
          </div>
          <div className="lead-tabs">
            {([['info', '当前工作'], ['materials', '分析与材料'], ['analysis', '关联报告'], ['log', '处理记录']] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
        </header>
        <div className="lead-scroll">
          {tab === 'info' && (
            <>
              <p>跟进原因：{lead.notes.trim() || '还没写。'}</p>
              <p>当前拟题：{lead.savedPitches?.find((item) => item.main)?.title || lead.savedPitches?.[0]?.title || '还没有拟题。'}</p>
              {lead.savedPitches && lead.savedPitches.length > 1 && <p className="lead-faint">其他候选：{lead.savedPitches.filter((item) => !item.main).map((item) => item.title).join('；')}</p>}
              <p>下一步计划：{lead.nextPlan?.trim() || '还没写。'}</p>
              <p>最新处理：{lead.currentOutcome ? `${outcomeLabel(lead.currentOutcome.outcome)} ${lead.currentOutcome.note}` : lead.logs[0] ? `${lead.logs[0].at} ${lead.logs[0].detail}` : '还没有处理记录。'}</p>
              <p>关联事件：{lead.eventId ? (eventName || '关联对象暂不可用') : '未关联事件'}</p>
              <p className="lead-faint">主题 {topic?.topic.name ?? '无'} · 创建于 {lead.createdAt}</p>
              <TitleField leadId={lead.id} title={lead.title} onReload={onReload} />
              <label>下一步计划
                <textarea value={plan} aria-label="下一步计划" onChange={(event) => setPlan(event.target.value)} />
              </label>
              <div className="lead-actions">
                <button type="button" className="btn-primary" disabled={plan === (lead.nextPlan ?? '')} onClick={() => { const saved = saveNextPlan(lead.id, plan); if (!saved) onNotice('下一步计划保存失败。'); else { onNotice('下一步计划已保存'); onReload() } }}>保存计划</button>
              </div>
              <label>工作备注
                <textarea value={noteDraft} aria-label="工作备注" onChange={(event) => onNote(event.target.value)} />
              </label>
              <p className="lead-faint">{noteDirty ? '未保存' : '已保存'} · 备注只给跟进人看，不会改写新闻或已有分析。</p>
              <div className="lead-actions">
                <button type="button" className="btn-primary" disabled={!noteDirty} onClick={onSaveNote}>保存备注</button>
                <button type="button" className="btn-text" disabled={!noteDirty} onClick={onCancelNote}>取消</button>
              </div>
              <p>当前处理结论：{lead.currentOutcome ? `${outcomeLabel(lead.currentOutcome.outcome)} ${lead.currentOutcome.note}` : '无'}</p>
              {lead.archiveHistory.length > 0 && <p className="lead-faint">历史归档：{lead.archiveHistory.map((item) => `${item.at} ${outcomeLabel(item.outcome)}`).join('；')}</p>}
              <div className="lead-actions">
                {lead.status === 'pending' && <button type="button" className="btn-primary" onClick={() => { startLead(lead.id); onReload() }}>继续跟进</button>}
                {lead.status !== 'archived' && <button type="button" className="btn-quiet" onClick={onArchive}>结束跟进</button>}
                {lead.status === 'active' && <button type="button" className="btn-quiet" onClick={() => { returnPending(lead.id); onReload() }}>退回待处理</button>}
                {lead.status === 'archived' && <button type="button" className="btn-primary" onClick={() => { restoreLead(lead.id); onReload() }}>恢复跟进</button>}
              </div>
            </>
          )}
          {tab === 'materials' && (
            <>
              <div className="lead-actions">
                {lead.eventId && <button type="button" className="btn-quiet" onClick={() => navigate(`/hot?event=${lead.eventId}&from=leads`)}>打开个人分析树</button>}
                <button type="button" aria-pressed={materialFilter === 'all'} className="btn-quiet" onClick={() => setMaterialFilter('all')}>全部 {lead.articles.length}</button>
                <button type="button" aria-pressed={materialFilter === 'fresh'} className="btn-quiet" onClick={() => setMaterialFilter('fresh')}>新增 {fresh.length}</button>
                <button type="button" className="btn-quiet" onClick={onPick}>从新闻库补充</button>
                <button type="button" className="btn-text" onClick={() => { markSeen(lead.id, fresh.map((item) => item.articleId), actor); onReload() }}>标记当前更新已看</button>
              </div>
              {lead.status === 'archived' && fresh.length > 0 && <p className="lead-banner">结束后新增 {fresh.length} 篇。恢复跟进后这些报道仍在，直到你标记已看。主题关注没有取消。</p>}
              {progress.map((item) => (
                <article key={item.key} className="lead-news">
                  <div>
                    <h3>已有进展分析</h3>
                    <p className="lead-faint">{item.createdAt} · 基于 {item.materialIds.length} 篇 · 打开个人分析树查看，不在这里另存一份。</p>
                  </div>
                </article>
              ))}
              {shown.map((item) => (
                <article key={item.meta.articleId} className="lead-news">
                  <div>
                    <h3>{item.news?.title ?? '关联对象暂不可用'}</h3>
                    <p className="lead-faint">{item.news ? `${item.news.mediaName} · ${formatStamp(item.news.publishedAt)} · ${levelLabel(materialLevel(item.news))} · ${natureLabel(materialNature(item.news))}` : item.meta.articleId} · {item.meta.source === 'manual' ? '手动补充' : '事件材料'}</p>
                  </div>
                  <div className="lead-ops">
                    {item.news && <button type="button" className="btn-text" onClick={() => onOpenNews([item.news!])}>查看全文</button>}
                    {item.meta.source === 'manual' && <button type="button" className="btn-text" onClick={() => { removeManualArticle(lead.id, item.meta.articleId); onReload() }}>解除关联</button>}
                  </div>
                </article>
              ))}
              {shown.length === 0 && <p className="lead-faint">没有要显示的材料。</p>}
            </>
          )}
          {tab === 'analysis' && (
            <>
              <div className="lead-actions">
                <button type="button" className="btn-primary" onClick={() => navigate('/reports', { state: { compose: { type: 'topic', eventId: lead.eventId ?? undefined, start: DATA_START, end: DATA_END, articleIds: lead.articles.map((item) => item.articleId), leadIds: [lead.id], referenceNote: lead.notes ? '用户备注只作为工作记录，不自动当成新闻事实。' : '' } } })}>生成相关报告</button>
              </div>
              {[...new Map([...eventReports, ...manualReports].map((item) => [item.id, item])).values()].map((item) => {
                const ref = lead.reportRefs.find((row) => row.reportId === item.id)
                const base = ref?.materialCount ?? item.materials.length
                const current = lead.eventId ? news.filter((row) => row.eventId === lead.eventId).length : item.materials.length
                return (
                  <article key={item.id} className="lead-news">
                    <div>
                      <h3>{item.title}</h3>
                      <p className="lead-faint">{typeLabel(item.type)} · {reportStatus(item)} · {item.updatedAt.slice(0, 16).replace('T', ' ')}{item.archived ? ' · 已归档仍可打开' : ''}</p>
                      {current > base && <p className="lead-banner">该分析基于此前 {base} 篇材料，当前有新增内容。</p>}
                    </div>
                    <div className="lead-ops">
                      <button type="button" className="btn-text" onClick={() => navigate(`/reports/${item.id}`, { state: { leadId: lead.id } })}>打开</button>
                      {ref && <button type="button" className="btn-text" onClick={() => { detachReport(lead.id, item.id); onReload() }}>解除引用</button>}
                    </div>
                  </article>
                )
              })}
              <label>关联已有报告
                <select aria-label="关联已有报告" defaultValue="" onChange={(event) => { if (!event.target.value) return; const report = reports.find((item) => item.id === event.target.value); attachReport(lead.id, event.target.value, report?.materials.length ?? 0); onReload(); event.target.value = '' }}>
                  <option value="">选择报告</option>
                  {reports.filter((item) => !lead.reportRefs.some((ref) => ref.reportId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </label>
              {eventReports.length + manualReports.length === 0 && <p className="lead-faint">还没有关联报告。可以生成新报告，或引用已有报告。</p>}
            </>
          )}
          {tab === 'log' && lead.logs.map((item) => (
            <article key={item.id} className="lead-news">
              <div><h3>{item.action}</h3><p className="lead-faint">{item.at} · {item.by === '系统' ? '系统' : actorName(item.by)} · {item.detail}</p></div>
            </article>
          ))}
        </div>
      </aside>
    </div>
  )
}

function TitleField({ leadId, title, onReload }: { leadId: string; title: string; onReload: () => void }) {
  const [value, setValue] = useState(title)
  useEffect(() => setValue(title), [leadId, title])
  return (
    <label>线索标题
      <input type="text" value={value} aria-label="线索标题" onChange={(event) => setValue(event.target.value)} onBlur={() => { if (value.trim() && value.trim() !== title) { renameLead(leadId, value); onReload() } }} />
    </label>
  )
}

function CreateDialog({ news, events, onClose, onDone, onExists }: {
  news: NewsItem[]
  events: { id: string; name: string; topicId: string }[]
  onClose: () => void
  onDone: (id: string | null) => void
  onExists: (draft: { title: string; notes: string; articleIds: string[]; targetId: string }) => void
}) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [eventId, setEventId] = useState('')
  const [error, setError] = useState('')
  const names = sameTitleLeads(title)
  return (
    <div className="lead-mask" onClick={onClose}>
      <section className="lead-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="create-title">新建线索</h2>
        <label>标题<input type="text" value={title} aria-label="线索标题" onChange={(event) => setTitle(event.target.value)} /></label>
        <label>说明<textarea value={notes} aria-label="说明" onChange={(event) => setNotes(event.target.value)} /></label>
        <label>关联事件
          <select aria-label="关联事件" value={eventId} onChange={(event) => setEventId(event.target.value)}>
            <option value="">不关联</option>
            {events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {!eventId && names.length > 0 && <p className="lead-banner">已有同名线索「{names[0].title}」。没有事件编号时不会自动合并。</p>}
        {error && <p className="lead-banner">{error}</p>}
        <div className="lead-actions">
          <button type="button" className="btn-primary" onClick={() => {
            try {
              const eventName = events.find((item) => item.id === eventId)?.name
              const articleIds = eventId ? news.filter((item) => item.eventId === eventId).map((item) => item.id) : []
              const result = createManualLead({ title, notes, ownerId: currentActor(), eventId: eventId || null, eventName, articleIds })
              if (result.kind === 'exists') {
                onExists({ title: title.trim(), notes, articleIds, targetId: result.lead.id })
                return
              }
              onDone(result.lead.id)
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : '保存失败')
            }
          }}>保存</button>
          <button type="button" className="btn-quiet" onClick={onClose}>取消</button>
        </div>
      </section>
    </div>
  )
}

function Picker({ news, exclude, onClose, onAdd }: { news: NewsItem[]; exclude: Set<string>; onClose: () => void; onAdd: (ids: string[]) => void }) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const rows = news.filter((item) => !exclude.has(item.id) && (!q || item.title.includes(q) || item.eventName.includes(q))).slice(0, 30)
  return (
    <div className="lead-mask" onClick={onClose}>
      <section className="lead-dialog" role="dialog" aria-modal="true" aria-labelledby="pick-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="pick-title">补充材料</h2>
        <input type="search" value={q} aria-label="搜索新闻" placeholder="搜索标题或事件" onChange={(event) => setQ(event.target.value)} />
        {rows.map((item) => (
          <label key={item.id} className="lead-check"><input type="checkbox" checked={picked.includes(item.id)} onChange={(event) => setPicked((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />{item.title}</label>
        ))}
        <div className="lead-actions">
          <button type="button" className="btn-primary" disabled={!picked.length} onClick={() => onAdd(picked)}>加入所选</button>
          <button type="button" className="btn-quiet" onClick={onClose}>取消</button>
        </div>
      </section>
    </div>
  )
}

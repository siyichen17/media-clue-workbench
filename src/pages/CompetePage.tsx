import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { MediaManager } from '../components/compete/MediaDialogs.tsx'
import { CompeteCategoryChart, CompeteTrendChart } from '../components/compete/CompeteCharts.tsx'
import { ReportWizard } from '../components/compete/ReportWizard.tsx'
import { ChartCard } from '../components/overview/ChartCard.tsx'
import { NewsDrawer } from '../components/news/NewsDrawer.tsx'
import { CATEGORIES, categoryById } from '../data/demo/catalog.ts'
import { MONITOR_NEWS } from '../data/demo/monitor.ts'
import {
  alertKindLabel,
  buildCompeteAlerts,
  categorySeries,
  dailySeries,
  filterMonitorNews,
  hotTopicIds,
  mediaMetrics,
  selectedMediaIds,
  sharedEvents,
} from '../lib/competeSelectors.ts'
import {
  loadAlertRules,
  loadFilters,
  loadHandledAlerts,
  loadMediaState,
  profileName,
  saveFilters,
  saveHandledAlerts,
  saveMediaState,
  type AlertRule,
  type CompeteFilters,
  type MediaState,
} from '../lib/competeStorage.ts'
import { DATA_AS_OF_LABEL, dateRangeOf, formatStamp, presetLabel } from '../lib/dates.ts'
import { attachReport, followEvent, restoreLead } from '../lib/leads.ts'
import { levelLabel, materialLevel, materialNature, natureLabel } from '../lib/material.ts'
import { mediaColor } from '../lib/mediaColor.ts'
import { listReports } from '../lib/reportStore.ts'
import { loadFollows, saveFollows } from '../lib/storage.ts'
import type { DrawerModel, NewsItem } from '../types/domain.ts'
import type { ReportDocument } from '../types/report.ts'

const PAGE_SIZE = 8

export function CompetePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialMedia = loadMediaState()
  const [mediaState, setMediaState] = useState<MediaState>(initialMedia)
  const [filters, setFilters] = useState<CompeteFilters>(() => loadFilters(loadFiltersFallback(initialMedia)))
  const [rules] = useState<AlertRule[]>(() => loadAlertRules())
  const [handled, setHandled] = useState<Set<string>>(() => loadHandledAlerts())
  const [follows, setFollows] = useState<Set<string>>(() => loadFollows())
  const [tab, setTab] = useState<'news' | 'events' | 'alerts'>('news')
  const [query, setQuery] = useState('')
  const [tableMedia, setTableMedia] = useState('all')
  const [sort, setSort] = useState<'latest' | 'earliest'>('latest')
  const [page, setPage] = useState(0)
  const [alertStatus, setAlertStatus] = useState<'open' | 'done' | 'all'>('open')
  const [chartIds, setChartIds] = useState<string[] | null>(null)
  const [drawer, setDrawer] = useState<DrawerModel | null>(null)
  const [managerOpen, setManagerOpen] = useState(false)
  const [params] = useSearchParams()
  const [wizard, setWizard] = useState<{ type: 'date' | 'event'; eventId?: string; start?: string; end?: string; leadId?: string } | null>(() => {
    const state = location.state as { wizard?: { type: 'date' | 'event'; eventId?: string; start?: string; end?: string; leadId?: string } } | null
    if (state?.wizard) return state.wizard
    const eventId = params.get('event')
    if (!eventId) return null
    return { type: 'event', eventId, start: params.get('start') || undefined, end: params.get('end') || undefined }
  })
  const [reportsOpen, setReportsOpen] = useState(false)
  const [leadHint, setLeadHint] = useState<{ id: string; text: string; archived?: boolean } | null>(null)
  const [reports, setReports] = useState<ReportDocument[]>([])

  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    const media = params.get('media')
    if (!media) return
    const known = mediaState.profiles.some((item) => item.id === media && item.enabled && item.id !== filters.ownMediaId)
    if (known && !filters.peerIds.includes(media)) {
      updateFilters({ ...filters, peerIds: [...filters.peerIds, media] })
    }
    if (known) setTableMedia(media)
    navigate('/compete', { replace: true })
  }, [params])

  const range = dateRangeOf(filters)
  const mediaIds = selectedMediaIds(filters)
  const { news } = useMemo(() => filterMonitorNews(filters), [filters])
  const hotTopics = useMemo(() => hotTopicIds(range.start, range.end), [range.start, range.end])
  const metrics = useMemo(() => mediaMetrics(news, mediaIds, hotTopics), [news, mediaIds, hotTopics])
  const days = useMemo(() => dailySeries(news, mediaIds, range.start, range.end), [news, mediaIds, range.start, range.end])
  const categories = useMemo(() => categorySeries(news, mediaIds), [news, mediaIds])
  const events = useMemo(() => sharedEvents(news, filters.ownMediaId), [news, filters.ownMediaId])
  const alerts = useMemo(() => buildCompeteAlerts(news, rules, range.start, range.end), [news, rules, range.start, range.end])
  const visibleChartIds = (chartIds ?? mediaIds.slice(0, 4)).filter((id) => mediaIds.includes(id))
  const names = (id: string) => profileName(mediaState.profiles, id)

  function updateFilters(next: CompeteFilters) {
    const peerIds = next.peerIds.filter((id) => id !== next.ownMediaId)
    const resolved = { ...next, peerIds }
    setFilters(resolved)
    saveFilters(resolved)
    setPage(0)
    if (resolved.ownMediaId !== mediaState.ownMediaId) {
      const saved = { ...mediaState, ownMediaId: resolved.ownMediaId }
      setMediaState(saved)
      saveMediaState(saved)
    }
  }

  function openNews(items: NewsItem[], labels: { id: string; label: string }[]) {
    setDrawer({ kind: 'news', tags: labels, items })
  }

  const searched = news.filter((item) => {
    if (tableMedia !== 'all' && item.mediaId !== tableMedia) return false
    return !query.trim() || item.title.includes(query.trim())
  })
  const sorted = [...searched].sort((a, b) =>
    sort === 'latest' ? b.publishedAt.localeCompare(a.publishedAt) : a.publishedAt.localeCompare(b.publishedAt),
  )
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageRows = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const visibleAlerts = alerts.filter((item) => {
    const done = handled.has(item.id)
    if (alertStatus === 'open') return !done
    if (alertStatus === 'done') return done
    return true
  })
  const totalFromCards = metrics.reduce((sum, item) => sum + item.newsCount, 0)

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <div className="title-row">
            <h1>竞品监控</h1>
            <span className="demo-pill">模拟演示数据</span>
          </div>
          <p>跟踪同行报道动态，对比关注重点与内容差异</p>
        </div>
        <div className="head-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              void listReports().then((rows) => {
                setReports(rows)
                setReportsOpen(true)
              })
            }}
          >
            最近报告
          </button>
          <button type="button" className="btn ghost" onClick={() => setManagerOpen(true)}>
            管理媒体
          </button>
          <button type="button" className="btn active" onClick={() => setWizard({ type: 'date' })}>
            生成对比报告
          </button>
          <div className="cutoff">
            <span>演示数据截止时间</span>
            <strong>{DATA_AS_OF_LABEL}</strong>
          </div>
        </div>
      </header>

      <section className="filter-bar" aria-label="筛选">
        <div className="filter-controls">
          <div className="segmented" role="group" aria-label="日期范围">
            {(['7d', '14d', 'custom'] as const).map((preset) => (
              <button key={preset} type="button" aria-pressed={filters.preset === preset} onClick={() => updateFilters({ ...filters, preset })}>
                {presetLabel(preset)}
              </button>
            ))}
          </div>
          <label className="field">
            开始
            <input type="date" value={range.start} onChange={(event) => updateFilters({ ...filters, preset: 'custom', customStart: event.target.value })} />
          </label>
          <label className="field">
            结束
            <input type="date" value={range.end} onChange={(event) => updateFilters({ ...filters, preset: 'custom', customEnd: event.target.value })} />
          </label>
          <label className="field">
            本媒体
            <select value={filters.ownMediaId} onChange={(event) => updateFilters({ ...filters, ownMediaId: event.target.value })}>
              {mediaState.profiles.filter((item) => item.enabled).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            分类
            <select value={filters.categoryId} onChange={(event) => updateFilters({ ...filters, categoryId: event.target.value })}>
              <option value="all">全部分类</option>
              {CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            数据性质
            <select value={filters.nature} onChange={(event) => updateFilters({ ...filters, nature: event.target.value as CompeteFilters['nature'] })}>
              <option value="all">全部</option>
              <option value="real">真实</option>
              <option value="simulated">模拟</option>
            </select>
          </label>
        </div>
        <fieldset className="check-grid">
          <legend>对照媒体</legend>
          {mediaState.profiles.filter((item) => item.enabled && item.id !== filters.ownMediaId).map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                checked={filters.peerIds.includes(item.id)}
                onChange={(event) =>
                  updateFilters({
                    ...filters,
                    peerIds: event.target.checked ? [...filters.peerIds, item.id] : filters.peerIds.filter((id) => id !== item.id),
                  })
                }
              />
              {item.name}
            </label>
          ))}
        </fieldset>
        <p className="chart-note">日期按北京时间，结束日包含当天。收录数只统计当前条件下的报道，不代表媒体真实全部发稿量。卡片合计 {totalFromCards} 篇，与当前列表一致。</p>
      </section>

      <section className="media-grid" aria-label="媒体概况">
        {metrics.map((item) => {
          const profile = mediaState.profiles.find((profileItem) => profileItem.id === item.mediaId)
          const customEmpty = profile && !profile.builtin && !item.hasNews
          return (
            <article key={item.mediaId} className="card media-card">
              <div className="title-row">
                <span className="media-mark" style={{ background: mediaColor(item.mediaId) }}>{names(item.mediaId).slice(0, 1)}</span>
                <strong>{names(item.mediaId)}</strong>
                {item.mediaId === filters.ownMediaId && <span className="static-tag">本媒体</span>}
              </div>
              {customEmpty ? (
                <p className="chart-note">暂无数据。尚未接入该媒体的报道，不会显示为采集成功。</p>
              ) : (
                <dl className="metric-mini">
                  <div><dt>已收录报道</dt><dd>{item.newsCount}</dd></div>
                  <div><dt>事件</dt><dd>{item.eventCount}</dd></div>
                  <div><dt>涉及上榜事件的报道</dt><dd>{item.hotNewsCount}</dd></div>
                  <div><dt>粉丝量</dt><dd>—</dd></div>
                </dl>
              )}
              <div className="news-actions">
                <button
                  type="button"
                  className="btn tiny"
                  onClick={() =>
                    openNews(news.filter((row) => row.mediaId === item.mediaId), [
                      { id: 'range', label: `${range.start} 至 ${range.end}` },
                      { id: 'media', label: names(item.mediaId) },
                    ])
                  }
                >
                  查看报道
                </button>
                <button type="button" className="btn tiny" onClick={() => navigate(`/alerts?tab=rules&media=${item.mediaId}`)}>
                  设置预警
                </button>
              </div>
            </article>
          )
        })}
      </section>

      <section className="split-50">
        <ChartCard
          title="每日已收录报道数"
          caption="按发布时间计入当天。点击线条上的日期，查看该媒体当天的报道。颜色与媒体卡片一致。"
          extra={<ChartMediaToggle ids={mediaIds} visible={visibleChartIds} nameOf={names} onChange={setChartIds} />}
          empty={!news.length}
        >
          <CompeteTrendChart
            dates={days.map((item) => item.date)}
            series={visibleChartIds.map((id) => ({ id, name: names(id), data: days.map((day) => day.counts[id] ?? 0) }))}
            onSelect={(mediaId, date) =>
              openNews(
                news.filter((item) => item.mediaId === mediaId && item.publishedAt.slice(0, 10) === date),
                [
                  { id: 'date', label: date },
                  { id: 'media', label: names(mediaId) },
                ],
              )
            }
          />
        </ChartCard>
        <ChartCard title="话题分类分布" caption="一篇报道只计入主要分类。点击柱形查看该媒体、该分类的报道。" empty={!categories.length}>
          <CompeteCategoryChart
            categories={categories.map((item) => ({ id: item.categoryId, name: item.name }))}
            series={visibleChartIds.map((id) => ({ id, name: names(id), data: categories.map((item) => item.counts[id] ?? 0) }))}
            onSelect={(mediaId, categoryId) =>
              openNews(
                news.filter((item) => item.mediaId === mediaId && item.categoryId === categoryId),
                [
                  { id: 'range', label: `${range.start} 至 ${range.end}` },
                  { id: 'media', label: names(mediaId) },
                  { id: 'category', label: categoryById[categoryId]?.name ?? categoryId },
                ],
              )
            }
          />
        </ChartCard>
      </section>

      <section className="card">
        <div className="card-head">
          <div className="segmented" role="tablist" aria-label="内容">
            <button type="button" aria-selected={tab === 'news'} onClick={() => setTab('news')}>最新报道</button>
            <button type="button" aria-selected={tab === 'events'} onClick={() => setTab('events')}>共同事件</button>
            <button type="button" aria-selected={tab === 'alerts'} onClick={() => setTab('alerts')}>预警记录</button>
          </div>
        </div>
        <div className="card-body">
          {tab === 'news' && (
            <div className="stack">
              <div className="filter-controls">
                <label className="field grow">
                  标题
                  <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} placeholder="搜索标题" />
                </label>
                <label className="field">
                  媒体
                  <select value={tableMedia} onChange={(event) => { setTableMedia(event.target.value); setPage(0) }}>
                    <option value="all">全部所选媒体</option>
                    {mediaIds.map((id) => <option key={id} value={id}>{names(id)}</option>)}
                  </select>
                </label>
                <div className="segmented">
                  <button type="button" aria-pressed={sort === 'latest'} onClick={() => setSort('latest')}>最新</button>
                  <button type="button" aria-pressed={sort === 'earliest'} onClick={() => setSort('earliest')}>最早</button>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>媒体</th><th>标题</th><th>发布时间</th><th>分类</th><th>事件</th><th>材料</th><th>性质</th><th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr><td colSpan={8}>没有符合条件的报道</td></tr>
                    ) : pageRows.map((item) => (
                      <tr key={item.id}>
                        <td>{names(item.mediaId)}</td>
                        <td>{item.title}</td>
                        <td>{formatStamp(item.publishedAt)}</td>
                        <td>{categoryById[item.categoryId]?.name}</td>
                        <td>{item.eventName}</td>
                        <td>{levelLabel(materialLevel(item))}</td>
                        <td>{natureLabel(materialNature(item))}</td>
                        <td>
                          <button type="button" className="btn tiny" onClick={() => openNews([item], [{ id: 'one', label: item.eventName }])}>查看详情</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="title-row">
                <span className="chart-note">共 {sorted.length} 条</span>
                <button type="button" className="btn tiny" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>上一页</button>
                <span className="chart-note">{page + 1} / {pageCount}</span>
                <button type="button" className="btn tiny" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>下一页</button>
              </div>
            </div>
          )}
          {tab === 'events' && (
            <div className="table-wrap">
              {leadHint && <p className="hint">{leadHint.text} <button type="button" className="btn tiny" onClick={() => navigate(`/leads?lead=${leadHint.id}`)}>查看线索</button>{leadHint.archived && <button type="button" className="btn tiny" onClick={() => { restoreLead(leadHint.id); setLeadHint({ id: leadHint.id, text: '已恢复为待处理。' }) }}>恢复跟进</button>}</p>}
              <table className="data-table">
                <thead>
                  <tr><th>事件</th><th>媒体数</th><th>报道数</th><th>最近报道</th><th>本媒体</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr><td colSpan={6}>当前条件下没有至少两家媒体共同收录的事件</td></tr>
                  ) : events.map((item) => (
                    <tr key={item.eventId}>
                      <td>{item.eventName}</td>
                      <td>{item.mediaIds.length}</td>
                      <td>{item.newsCount}</td>
                      <td>{formatStamp(item.latestAt)}</td>
                      <td>{item.ownRecorded ? '有收录记录' : '本媒体未收录'}</td>
                      <td className="news-actions">
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() =>
                            openNews(
                              news.filter((row) => row.eventId === item.eventId),
                              [{ id: 'event', label: item.eventName }],
                            )
                          }
                        >
                          查看材料
                        </button>
                        <button type="button" className="btn tiny" onClick={() => setWizard({ type: 'event', eventId: item.eventId })}>
                          生成事件对比报告
                        </button>
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => {
                            const result = followEvent({
                              eventId: item.eventId,
                              eventName: item.eventName,
                              articleIds: news.filter((row) => row.eventId === item.eventId).map((row) => row.id),
                              entry: 'compete',
                            })
                            setLeadHint({
                              id: result.lead.id,
                              archived: result.kind === 'archived',
                              text: result.kind === 'archived'
                                ? `「${item.eventName}」已结束，没有自动恢复。`
                                : result.kind === 'created'
                                  ? `已加入「${item.eventName}」。`
                                  : `已合并到原线索「${item.eventName}」，备注、负责人和报告关联保持不变。`,
                            })
                          }}
                        >
                          跟进事件
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === 'alerts' && (
            <div className="stack">
              <div className="segmented">
                <button type="button" aria-pressed={alertStatus === 'open'} onClick={() => setAlertStatus('open')}>待处理</button>
                <button type="button" aria-pressed={alertStatus === 'done'} onClick={() => setAlertStatus('done')}>已处理</button>
                <button type="button" aria-pressed={alertStatus === 'all'} onClick={() => setAlertStatus('all')}>全部</button>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>时间</th><th>媒体</th><th>类型</th><th>触发说明</th><th>依据</th><th>状态</th><th>操作</th></tr>
                  </thead>
                  <tbody>
                    {visibleAlerts.length === 0 ? (
                      <tr><td colSpan={7}>没有符合条件的预警记录</td></tr>
                    ) : visibleAlerts.map((item) => (
                      <tr key={item.id}>
                        <td>{formatStamp(item.triggerAt)}</td>
                        <td>{names(item.mediaId)}</td>
                        <td>{alertKindLabel(item.kind)}{item.simulated ? ' · 模拟' : ''}</td>
                        <td>{item.summary}</td>
                        <td>{item.basis}</td>
                        <td>{handled.has(item.id) ? '已处理' : '待处理'}</td>
                        <td className="news-actions">
                          <button
                            type="button"
                            className="btn tiny"
                            onClick={() =>
                              openNews(
                                MONITOR_NEWS.filter((row) => item.newsIds.includes(row.id)),
                                [{ id: 'alert', label: item.summary }],
                              )
                            }
                          >
                            查看依据
                          </button>
                          <button
                            type="button"
                            className="btn tiny"
                            onClick={() => {
                              const next = new Set(handled)
                              if (next.has(item.id)) next.delete(item.id)
                              else next.add(item.id)
                              setHandled(next)
                              saveHandledAlerts(next)
                            }}
                          >
                            {handled.has(item.id) ? '标为待处理' : '标记已处理'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      <NewsDrawer
        entry="compete"
        model={drawer}
        followedIds={follows}
        onClose={() => setDrawer(null)}
        onToggleFollow={(id) => {
          const next = new Set(follows)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          setFollows(next)
          saveFollows(next)
        }}
      />
      {managerOpen && (
        <MediaManager
          state={mediaState}
          onClose={() => setManagerOpen(false)}
          onSave={(next) => {
            setMediaState(next)
            saveMediaState(next)
            updateFilters({
              ...filters,
              ownMediaId: next.ownMediaId,
              peerIds: filters.peerIds.filter((id) => next.profiles.some((item) => item.id === id && item.enabled && id !== next.ownMediaId)),
            })
            setManagerOpen(false)
          }}
        />
      )}
      {wizard && (
        <ReportWizard
          filters={filters}
          profiles={mediaState.profiles}
          initialType={wizard.type}
          initialEventId={wizard.eventId}
          initialRange={wizard.start && wizard.end ? { start: wizard.start, end: wizard.end } : undefined}
          onClose={() => setWizard(null)}
          onCreated={(id, materialCount) => {
            if (wizard.leadId) attachReport(wizard.leadId, id, materialCount)
            navigate(`/reports/${id}`, { state: { leadId: wizard.leadId } })
          }}
        />
      )}
      {reportsOpen && (
        <div className="modal-root">
          <button type="button" className="drawer-mask" aria-label="关闭最近报告" onClick={() => setReportsOpen(false)} />
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="recent-reports-title">
            <header className="drawer-head">
              <h2 id="recent-reports-title">最近报告</h2>
              <button type="button" className="icon-button" onClick={() => setReportsOpen(false)} aria-label="关闭">×</button>
            </header>
            <div className="drawer-scroll">
              {reports.length === 0 ? <div className="empty-state">还没有保存的报告</div> : reports.map((item) => (
                <button key={item.id} type="button" className="pick-row" onClick={() => navigate(`/reports/${item.id}`)}>
                  <strong>{item.title}</strong>
                  <span className="news-meta">{item.type === 'date' ? '日期对比' : item.type === 'event' ? '事件对比' : item.type} · {item.finalizedAt || item.status === 'final' ? '已定稿' : '草稿'} · {item.updatedAt.slice(0, 16).replace('T', ' ')}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

function loadFiltersFallback(state: MediaState): CompeteFilters {
  const peerIds = state.profiles.filter((item) => item.enabled && item.id !== state.ownMediaId).map((item) => item.id)
  return {
    preset: '7d',
    customStart: '2026-11-04',
    customEnd: '2026-11-10',
    ownMediaId: state.ownMediaId,
    peerIds,
    categoryId: 'all',
    nature: 'all',
  }
}

function ChartMediaToggle({
  ids,
  visible,
  nameOf,
  onChange,
}: {
  ids: string[]
  visible: string[]
  nameOf: (id: string) => string
  onChange: (ids: string[]) => void
}) {
  if (ids.length <= 4) return null
  return (
    <div className="check-grid compact">
      {ids.map((id) => (
        <label key={id}>
          <input
            type="checkbox"
            checked={visible.includes(id)}
            onChange={(event) => {
              const next = event.target.checked ? [...visible, id] : visible.filter((item) => item !== id)
              onChange(next.length ? next : [id])
            }}
          />
          {nameOf(id)}
        </label>
      ))}
    </div>
  )
}

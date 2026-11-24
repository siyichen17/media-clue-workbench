import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ReportWizard } from '../components/compete/ReportWizard.tsx'
import { MONITOR_NEWS } from '../data/demo/monitor.ts'
import { HOT_SNAPSHOTS } from '../data/demo/hotSnapshots.ts'
import { loadFilters, loadMediaState, profileName, type CompeteFilters } from '../lib/competeStorage.ts'
import { DATA_END, DATA_START } from '../lib/dates.ts'
import { generateNarrativeDocument, IncompleteMaterialsError } from '../lib/generateReport.ts'
import { AiRequestError } from '../lib/aiClient.ts'
import { attachReport, actorName, visibleLeads } from '../lib/leads.ts'
import { levelLabel, materialLevel, materialNature, natureLabel } from '../lib/material.ts'
import { buildReportStats, snapshotMaterial } from '../lib/reportStats.ts'
import { copyReport, groupReports, humanEditedAt, materialChanges, natureMix, scopeText, setGroupArchived, statusLabel, typeLabel } from '../lib/reportMeta.ts'
import { listReports } from '../lib/reportStore.ts'
import type { ReportDocument, ReportScope, ReportType } from '../types/report.ts'
import './reports.css'

const PAGE_SIZE = 8

const CHAPTERS: Record<'daily' | 'weekly' | 'topic' | 'media' | 'theme' | 'work', { id: string; title: string }[]> = {
  daily: [
    { id: 'overview', title: '今日概览' },
    { id: 'domains', title: '分类解读' },
    { id: 'changes', title: '值得关注的变化' },
    { id: 'suggestions', title: '后续选题建议' },
  ],
  weekly: [
    { id: 'overview', title: '本周摘要' },
    { id: 'domains', title: '重点领域与代表事件' },
    { id: 'changes', title: '主要事件在本周的变化' },
    { id: 'suggestions', title: '下阶段观察与选题建议' },
  ],
  media: [
    { id: 'overview', title: '核心发现' },
    { id: 'domains', title: '重点主题和代表事件' },
    { id: 'changes', title: '报道角度与材料特点' },
    { id: 'suggestions', title: '总结与观察建议' },
  ],
  topic: [
    { id: 'overview', title: '事件概况' },
    { id: 'progress', title: '进展与关键事实' },
    { id: 'claims', title: '不同说法与待核实' },
    { id: 'suggestions', title: '后续工作建议' },
  ],
  theme: [
    { id: 'overview', title: '主题范围' },
    { id: 'domains', title: '主要事件' },
    { id: 'changes', title: '可观察的变化' },
    { id: 'suggestions', title: '后续观察' },
  ],
  work: [
    { id: 'overview', title: '本周概述' },
    { id: 'progress', title: '重点推进' },
    { id: 'results', title: '阶段成果' },
    { id: 'open', title: '未完成事项' },
    { id: 'suggestions', title: '下周计划' },
  ],
}

type NarrativeKind = keyof typeof CHAPTERS

const TYPE_CARDS: { id: NarrativeKind | 'compare'; name: string; use: string; scene: string }[] = [
  { id: 'daily', name: '热搜日报 / 周报', use: '看这段时间有哪些热点值得继续关注。', scene: '每天或每周过一遍微博、百度。' },
  { id: 'media', name: '单媒体分析报告', use: '看一家媒体在选定时期主要报道什么。', scene: '复盘某一媒体或具体栏目。' },
  { id: 'compare', name: '多媒体对比报告', use: '比较多家媒体的选题或同一事件的说法。', scene: '至少两家媒体都有可用材料。' },
  { id: 'topic', name: '事件专题报告', use: '整理一个具体事件的事实、说法和建议。', scene: '围绕一次首飞、一次政策或一条线索。' },
  { id: 'theme', name: '主题观察报告', use: '看一个长期主题下各事件如何变化。', scene: '主题下的事件保持分开，不合成一条。' },
  { id: 'work', name: '我的工作周报', use: '整理当前账号这段时间真实写下的工作。', scene: '计划、草稿和定稿会分开写。' },
]

interface ComposeSeed {
  type: ReportType
  eventId?: string
  start?: string
  end?: string
  articleIds?: string[]
  leadIds?: string[]
  referenceNote?: string
}

export function ReportsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const seed = (location.state as { compose?: ComposeSeed } | null)?.compose
  const media = loadMediaState()
  const filters = loadFilters({
    preset: '7d',
    customStart: '2026-11-04',
    customEnd: DATA_END,
    ownMediaId: media.ownMediaId,
    peerIds: media.profiles.filter((item) => item.enabled && item.id !== media.ownMediaId).map((item) => item.id),
    categoryId: 'all',
    nature: 'all',
  })
  const [rows, setRows] = useState<ReportDocument[]>([])
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'all' | ReportType>('all')
  const [status, setStatus] = useState<'all' | 'draft' | 'final'>('all')
  const [createdFrom, setCreatedFrom] = useState('')
  const [archivedView, setArchivedView] = useState(false)
  const [page, setPage] = useState(1)
  const [menuId, setMenuId] = useState('')
  const [notice, setNotice] = useState('')
  const [creating, setCreating] = useState<NarrativeKind | 'pick' | null>(seed && seed.type !== 'date' && seed.type !== 'event' ? seed.type as NarrativeKind : null)
  const [compareKind, setCompareKind] = useState<'date' | 'event' | null>(null)

  function reload() {
    void listReports().then(setRows).catch(() => setLoadError('报告读取失败。已保存的报告仍在本机，请稍后重试。'))
  }

  useEffect(() => {
    reload()
  }, [])

  useEffect(() => {
    if (!seed?.type) return
    if (seed.type === 'date' || seed.type === 'event') setCompareKind(seed.type)
    else setCreating(seed.type)
  }, [seed])

  const groups = useMemo(() => groupReports(rows), [rows])
  const filtered = groups.filter(({ head }) => {
    if (Boolean(head.archived) !== archivedView) return false
    if (type !== 'all' && head.type !== type) return false
    if (status === 'draft' && statusLabel(head) !== '草稿') return false
    if (status === 'final' && statusLabel(head) !== '已定稿') return false
    if (createdFrom && humanEditedAt(head).slice(0, 10) < createdFrom) return false
    const haystack = `${head.title} ${head.scope.eventName ?? ''} ${scopeText(head)}`
    return !query.trim() || haystack.toLowerCase().includes(query.trim().toLowerCase())
  }).sort((a, b) => humanEditedAt(b.head).localeCompare(humanEditedAt(a.head)))
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function archive(groupId: string, archived: boolean) {
    await setGroupArchived(groupId, archived)
    setMenuId('')
    setNotice(archived ? '已移入归档。关联线索没有改变。' : '已恢复到报告列表。')
    reload()
  }

  return (
    <main className="reports-page">
      <header className="reports-top">
        <div>
          <h1>报告中心</h1>
          <p>按时间、媒体、事件或个人工作整理分析成果</p>
        </div>
        <button type="button" className="btn active" onClick={() => { setCreating('pick'); setCompareKind(null) }}>新建报告</button>
      </header>
      {loadError && <p className="reports-banner">{loadError}</p>}
      {notice && <p className="reports-banner">{notice}</p>}
      <div className="reports-filters" role="tablist" aria-label="报告状态">
        {([['all', '全部'], ['draft', '草稿'], ['final', '已定稿']] as const).map(([id, label]) => (
          <button key={id} type="button" className="btn" aria-pressed={status === id && !archivedView} onClick={() => { setStatus(id); setArchivedView(false); setPage(1) }}>{label}</button>
        ))}
        <button type="button" className="btn ghost" aria-pressed={archivedView} onClick={() => { setArchivedView((value) => !value); setPage(1) }}>{archivedView ? '返回报告列表' : '查看已归档报告'}</button>
      </div>
      <div className="reports-filters">
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="搜索报告名称、关联主题或事件" aria-label="搜索报告" />
        <select value={type} aria-label="报告类型" onChange={(event) => { setType(event.target.value as typeof type); setPage(1) }}>
          <option value="all">全部类型</option>
          <option value="daily">热搜日报</option>
          <option value="weekly">热搜周报</option>
          <option value="media">单媒体分析</option>
          <option value="date">多媒体日期对比</option>
          <option value="event">多媒体事件对比</option>
          <option value="topic">事件专题</option>
          <option value="theme">主题观察</option>
          <option value="work">工作报告</option>
        </select>
        <label className="reports-faint">最后编辑时间起
          <input type="date" value={createdFrom} aria-label="最后编辑时间起" min={DATA_START} max={DATA_END} onChange={(event) => { setCreatedFrom(event.target.value); setPage(1) }} />
        </label>
      </div>
      <section className="reports-card">
        {groups.length === 0 ? (
          <div className="reports-empty">
            <strong>还没有报告</strong>
            <p className="reports-faint">可以整理热搜日报或周报、单媒体分析、多媒体对比、事件专题、主题观察，以及当前账号的工作报告。</p>
            <button type="button" className="btn active" onClick={() => { setCreating('pick'); setCompareKind(null) }}>新建报告</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="reports-empty">
            <strong>没有符合筛选的报告</strong>
            <button type="button" className="btn" onClick={() => { setQuery(''); setType('all'); setStatus('all'); setCreatedFrom(''); setArchivedView(false) }}>重置筛选</button>
          </div>
        ) : (
          <table className="reports-table">
            <thead>
              <tr>
                <th>报告名称</th>
                <th>类型</th>
                <th>内容范围</th>
                <th>状态</th>
                <th>最后编辑时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ head }) => {
                const changes = materialChanges(head)
                return (
                  <tr key={head.groupId}>
                    <td>
                      <strong className="reports-title">{head.title}</strong>
                      <span className="reports-faint">{changes.hasChange ? (changes.added.length ? '有新增材料' : changes.revised.length ? '原材料已修订' : '材料关联变化') : '材料快照未变'}</span>
                    </td>
                    <td>{typeLabel(head.type)}</td>
                    <td>{scopeText(head)} · {head.materials.length} 篇 · {natureMix(head.materials)}</td>
                    <td>{statusLabel(head)}{head.archived ? ' · 已归档' : ''}</td>
                    <td>{humanEditedAt(head).slice(0, 16).replace('T', ' ')}</td>
                    <td>
                      <div className="reports-ops">
                        <button type="button" className="btn tiny" onClick={() => navigate(`/reports/${head.id}`)}>{statusLabel(head) === '草稿' ? '继续编辑' : '查看'}</button>
                        <button type="button" className="btn tiny" onClick={() => navigate(`/reports/${head.id}`, { state: { print: true } })}>导出</button>
                        <button type="button" className="btn tiny" aria-label={`${head.title}的更多操作`} onClick={() => setMenuId(menuId === head.id ? '' : head.id)}>更多</button>
                        {menuId === head.id && (
                          <div className="reports-menu">
                            <button type="button" onClick={() => void copyReport(head).then((copy) => navigate(`/reports/${copy.id}`))}>复制</button>
                            {head.archived
                              ? <button type="button" onClick={() => void archive(head.groupId || head.id, false)}>恢复归档</button>
                              : <button type="button" onClick={() => void archive(head.groupId || head.id, true)}>归档</button>}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
      {filtered.length > PAGE_SIZE && (
        <div className="reports-ops">
          <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</button>
          <span className="reports-faint">{page} / {pageCount}</span>
          <button type="button" className="btn" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>下一页</button>
        </div>
      )}
      {creating === 'pick' && (
        <section className="reports-dialog" aria-label="选择报告类型">
          <h2>选择报告类型</h2>
          <div className="reports-types">
            {TYPE_CARDS.map((card) => (
              <button key={card.id} type="button" className="reports-type" onClick={() => {
                if (card.id === 'compare') { setCreating(null); setCompareKind('date') }
                else setCreating(card.id)
              }}>
                <strong>{card.name}</strong>
                <span>{card.use}</span>
                <small>{card.scene}</small>
              </button>
            ))}
          </div>
          <button type="button" className="btn ghost" onClick={() => setCreating(null)}>取消</button>
        </section>
      )}
      {compareKind && (
        <ReportWizard
          filters={filters}
          profiles={media.profiles}
          initialType={compareKind}
          onClose={() => { setCompareKind(null); setCreating(null) }}
          onCreated={(id) => {
            setCompareKind(null)
            setCreating(null)
            navigate(`/reports/${id}`)
          }}
        />
      )}
      {creating && creating !== 'pick' && (
        <NarrativeComposer
          kind={creating}
          filters={filters}
          seed={seed ?? null}
          onClose={() => setCreating(null)}
          onCreated={(id, leadIds, count) => {
            leadIds.forEach((leadId) => attachReport(leadId, id, count))
            setCreating(null)
            navigate(`/reports/${id}`, { state: { leadId: leadIds[0] } })
          }}
        />
      )}
    </main>
  )
}

function buildHotBoard(start: string, end: string) {
  const grouped = new Map<string, { platform: string; title: string; bestRank: number; hits: number; first: string; last: string }>()
  HOT_SNAPSHOTS.forEach((item) => {
    const day = item.observedAt.slice(0, 10)
    if (day < start || day > end) return
    const key = `${item.platform}:${item.itemId}`
    const current = grouped.get(key)
    if (!current) {
      grouped.set(key, { platform: item.platform, title: item.title, bestRank: item.rank, hits: 1, first: item.observedAt, last: item.observedAt })
      return
    }
    current.hits += 1
    current.bestRank = Math.min(current.bestRank, item.rank)
    if (item.observedAt < current.first) current.first = item.observedAt
    if (item.observedAt > current.last) current.last = item.observedAt
  })
  return [...grouped.values()].sort((a, b) => a.bestRank - b.bestRank || b.hits - a.hits)
}

function NarrativeComposer({
  kind,
  filters,
  seed,
  onClose,
  onCreated,
}: {
  kind: NarrativeKind
  filters: CompeteFilters
  seed: ComposeSeed | null
  onClose: () => void
  onCreated: (id: string, leadIds: string[], count: number) => void
}) {
  const media = loadMediaState()
  const events = useMemo(() => {
    const map = new Map<string, string>()
    MONITOR_NEWS.forEach((item) => { if (item.eventId) map.set(item.eventId, item.eventName) })
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [])
  const [step, setStep] = useState(seed?.articleIds?.length ? 2 : 1)
  const [period, setPeriod] = useState<'daily' | 'weekly'>(kind === 'weekly' ? 'weekly' : 'daily')
  const reportKind: NarrativeKind = kind === 'daily' || kind === 'weekly' ? period : kind
  const [start, setStart] = useState(seed?.start || (reportKind === 'daily' ? DATA_END : filters.customStart))
  const [end, setEnd] = useState(seed?.end || DATA_END)
  const [eventId, setEventId] = useState(seed?.eventId || events[0]?.id || '')
  const [mediaId, setMediaId] = useState(media.ownMediaId)
  const [selected, setSelected] = useState<string[]>(seed?.articleIds ?? [])
  const [leadIds, setLeadIds] = useState<string[]>(seed?.leadIds ?? [])
  const [chapters, setChapters] = useState<string[]>(CHAPTERS[reportKind].map((item) => item.id))
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [incomplete, setIncomplete] = useState(false)
  const [running, setRunning] = useState(false)
  const pool = MONITOR_NEWS.filter((item) => {
    const day = item.publishedAt.slice(0, 10)
    if (day < start || day > end) return false
    if ((reportKind === 'topic' || reportKind === 'theme') && eventId && item.eventId !== eventId && reportKind === 'topic') return false
    if (reportKind === 'media' && item.mediaId !== mediaId) return false
    return true
  })
  const chosen = pool.filter((item) => selected.includes(item.id))
  const workLeads = visibleLeads().filter((lead) => {
    const day = (lead.lastActionAt || lead.createdAt).slice(0, 10)
    return day >= start && day <= end
  })
  const leads = reportKind === 'work' ? workLeads : visibleLeads().filter((lead) => !lead.eventId || lead.eventId === eventId || leadIds.includes(lead.id))
  const fullText = chosen.filter((item) => materialLevel(item) === 'full').length
  const mediaCount = new Set(chosen.map((item) => item.mediaId)).size
  const eventCount = new Set(chosen.map((item) => item.eventId).filter(Boolean)).size

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function generate(allowPartial = false) {
    const usable = reportKind === 'work' ? workLeads.length > 0 || chosen.length > 0 : chosen.length > 0
    if (running || !usable || chapters.length < 1) return
    setRunning(true)
    setError('')
    setIncomplete(false)
    setStage('准备材料')
    const profiles = media.profiles
    const materials = chosen.map((item) => snapshotMaterial(item, profiles))
    const eventName = events.find((item) => item.id === eventId)?.name ?? null
    const mediaName = profileName(profiles, mediaId)
    const span = Math.round((Date.parse(`${end}T00:00:00+08:00`) - Date.parse(`${start}T00:00:00+08:00`)) / 86400000)
    const singleShot = reportKind === 'daily' || reportKind === 'weekly' ? start === end : false
    const hotBoard = reportKind === 'daily' || reportKind === 'weekly' ? buildHotBoard(start, end) : undefined
    const platforms = [...new Set((hotBoard ?? []).map((item) => item.platform))]
    const scope: ReportScope = {
      kind: reportKind,
      filters: { ...filters, preset: 'custom', customStart: start, customEnd: end },
      eventId: reportKind === 'topic' ? eventId : null,
      eventName: reportKind === 'topic' ? eventName : reportKind === 'media' ? mediaName : null,
      mediaIds: reportKind === 'media' ? [mediaId] : [...new Set(materials.map((item) => item.mediaId))],
      samplingNote: singleShot
        ? '只有一个日期的快照时，这是热搜快照分析，不代表全天或整周官方榜。'
        : reportKind === 'media' ? `分析范围限于${mediaName || '所选媒体'}已收录报道，不代表该媒体全部发稿。` : null,
      hotBoard,
    }
    const stats = buildReportStats(pool, materials, scope, profiles)
    const records = (reportKind === 'work' ? workLeads : visibleLeads().filter((lead) => leadIds.includes(lead.id))).map((lead) => ({
      title: lead.title,
      status: lead.status,
      owner: actorName(lead.ownerId),
      notes: [lead.notes, lead.nextPlan ? `下一步计划：${lead.nextPlan}` : '', lead.currentOutcome ? `处理结果：${lead.currentOutcome.outcome}` : ''].filter(Boolean).join('；'),
    }))
    const activeChapters = chapters.filter((id) => CHAPTERS[reportKind].some((item) => item.id === id))
    const title = reportKind === 'topic'
      ? `${eventName || '专题'}专题报告`
      : reportKind === 'work'
        ? (span >= 6 && span <= 7 ? `${start} 工作周报` : `${start}至${end} 工作报告`)
        : reportKind === 'media'
          ? `${mediaName || '媒体'}分析 ${start}`
          : reportKind === 'daily'
            ? `${platforms.join('、') || '热搜'}热搜日报｜${start.slice(0, 10)}`
            : reportKind === 'weekly'
              ? `${platforms.join('、') || '热搜'}热搜周报｜${start}至${end}`
              : `${start} ${typeLabel(reportKind)}`
    const hotNote = hotBoard?.length
      ? `期间观测汇总，不是平台官方榜。${hotBoard.slice(0, 12).map((item) => `${item.platform}「${item.title}」最佳观测第${item.bestRank}位，命中${item.hits}次`).join('；')}`
      : ''
    try {
      const report = await generateNarrativeDocument({
        title,
        scope,
        stats,
        materials,
        chapterIds: activeChapters,
        workRecords: records,
        referenceNote: [seed?.referenceNote || '', reportKind === 'work' ? '只根据工作记录写。没有记录就写没有记录，不要用新闻编造成果。计划不是已完成。' : '这不是工作周报，不要写无工作记录。', hotNote, scope.samplingNote || ''].filter(Boolean).join(' '),
        leadIds: reportKind === 'work' ? workLeads.map((lead) => lead.id) : leadIds,
        onStage: setStage,
        allowPartial,
      })
      onCreated(report.id, reportKind === 'work' ? workLeads.map((lead) => lead.id) : leadIds, materials.length)
    } catch (reason) {
      if (reason instanceof IncompleteMaterialsError) {
        setIncomplete(true)
        setError(reason.message)
      } else {
        setError(reason instanceof AiRequestError ? reason.message : '生成失败。已完成的材料提取已保留，没有把未完成材料算进完整报告。')
      }
      setRunning(false)
      setStage('')
    }
  }

  return (
    <section className="reports-dialog" aria-label="配置报告">
      <h2>{typeLabel(reportKind)}</h2>
      <p className="reports-faint">步骤 {step} / 3 · 生成开始后材料范围固定。{stage ? `当前阶段：${stage}` : '还没有开始生成。'}</p>
      {error && <p className="reports-banner">{error}</p>}
      {step === 1 && (
        <div>
          <label>开始 <input type="date" value={start} min={DATA_START} max={DATA_END} onChange={(event) => setStart(event.target.value)} /></label>
          <label>结束 <input type="date" value={end} min={DATA_START} max={DATA_END} onChange={(event) => setEnd(event.target.value)} /></label>
          {(kind === 'daily' || kind === 'weekly') && (
            <div className="reports-types">
              <button type="button" className="btn" aria-pressed={period === 'daily'} onClick={() => setPeriod('daily')}>日报</button>
              <button type="button" className="btn" aria-pressed={period === 'weekly'} onClick={() => setPeriod('weekly')}>周报</button>
            </div>
          )}
          {reportKind === 'media' && (
            <label>媒体
              <select value={mediaId} onChange={(event) => setMediaId(event.target.value)}>
                {media.profiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          )}
          {kind === 'topic' && (
            <label>事件
              <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
                {events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          )}
          <p className="reports-faint">统计范围 {start} 至 {end}。可读全文 {fullText} 篇，其余按摘要或标题使用，不能当成全文证据。模拟与真实材料会在范围里标明。</p>
          <button type="button" className="btn active" onClick={() => { setSelected(pool.map((item) => item.id)); setStep(2) }}>下一步：确认材料</button>
        </div>
      )}
      {step === 2 && (
        <div>
          <p className="reports-faint">已选 {chosen.length} 篇报道，涉及 {mediaCount} 家媒体、{eventCount} 个事件。</p>
          {chosen.length > 12 && <p className="reports-faint">将分批分析，生成时间可能较长。</p>}
          <div className="reports-list">
            {pool.map((item) => (
              <label key={item.id}>
                <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                <span>{item.title}<small className="reports-faint"> {item.mediaName} · {item.publishedAt.slice(0, 10)} · {levelLabel(materialLevel(item))} · {natureLabel(materialNature(item))}</small></span>
              </label>
            ))}
          </div>
          <h3>线索记录</h3>
          {leads.length === 0 && <p className="reports-faint">范围内没有线索记录。跟进事项不会自动编造。</p>}
          {leads.map((lead) => (
            <label key={lead.id}>
              <input type="checkbox" checked={leadIds.includes(lead.id)} onChange={() => setLeadIds((current) => current.includes(lead.id) ? current.filter((id) => id !== lead.id) : [...current, lead.id])} />
              {lead.title}
            </label>
          ))}
          <button type="button" className="btn" onClick={() => setStep(1)}>上一步</button>
          <button type="button" className="btn active" disabled={!chosen.length} onClick={() => setStep(3)}>下一步：章节</button>
        </div>
      )}
      {step === 3 && (
        <div>
          {CHAPTERS[reportKind].map((chapter) => (
            <label key={chapter.id}>
              <input
                type="checkbox"
                checked={chapters.includes(chapter.id)}
                disabled={chapter.id === 'followups' && leadIds.length === 0}
                onChange={() => setChapters((current) => current.includes(chapter.id) ? current.filter((id) => id !== chapter.id) : [...current, chapter.id])}
              />
              {chapter.title}{chapter.id === 'followups' && leadIds.length === 0 ? '（未选择线索记录）' : ''}
            </label>
          ))}
          <button type="button" className="btn" onClick={() => setStep(2)} disabled={running}>返回材料</button>
          <button type="button" className="btn active" disabled={running || !chapters.length || (reportKind === 'work' ? workLeads.length + chosen.length < 1 : chosen.length < 1)} onClick={() => void generate(false)}>{running ? stage || '正在生成' : '生成草稿'}</button>
          {incomplete && <button type="button" className="btn" disabled={running} onClick={() => void generate(false)}>重试未完成部分</button>}
          {incomplete && <button type="button" className="btn" disabled={running} onClick={() => void generate(true)}>先生成已完成部分</button>}
        </div>
      )}
      <button type="button" className="btn ghost" onClick={onClose} disabled={running}>关闭</button>
    </section>
  )
}

import { useEffect, useMemo, useState } from 'react'
import '../admin/admin.css'
import { HOT_SNAPSHOTS } from '../data/demo/hotSnapshots.ts'
import { dateRangeOf } from '../lib/dates.ts'
import { loadSources, type DataSource, type SourceTask } from '../lib/adminStore.ts'
import { resolveEventId } from '../lib/hotSelectors.ts'
import { actorName, currentActor, loadLeads, outcomeLabel, type ArchiveRecord, type Lead } from '../lib/leads.ts'
import { isFinal, LOCAL_ACCOUNT } from '../lib/reportMeta.ts'
import { listReports } from '../lib/reportStore.ts'
import type { ReportDocument } from '../types/report.ts'

type MetricKey = 'success' | 'freshness' | 'pending' | 'created' | 'closed' | 'waiting' | 'topics' | 'handoff' | 'reports' | 'adopted'

export function KpiPage() {
  const [preset, setPreset] = useState<'7d' | '14d'>('7d')
  const [reports, setReports] = useState<ReportDocument[]>([])
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<MetricKey | null>(null)
  const range = dateRangeOf({ preset, customStart: '2026-11-04', customEnd: '2026-11-10' })
  const actor = currentActor()

  useEffect(() => {
    listReports().then(setReports).catch(() => setError('报告列表暂时没有读出，其余指标仍按本地记录计算。'))
  }, [])

  const model = useMemo(() => build(range.start, range.end, reports, loadSources(), actor), [range.start, range.end, reports, actor])
  const cards: { key: MetricKey; title: string; group: string }[] = [
    { key: 'success', title: '接入任务成功率', group: '数据运行' },
    { key: 'freshness', title: '最近成功更新', group: '数据运行' },
    { key: 'pending', title: '待关联热搜', group: '数据运行' },
    { key: 'created', title: '新建线索', group: '个人跟进' },
    { key: 'closed', title: '已记录处理结果', group: '个人跟进' },
    { key: 'waiting', title: '待处理等待', group: '个人跟进' },
    { key: 'topics', title: '形成选题', group: '工作成果' },
    { key: 'handoff', title: '已交接', group: '工作成果' },
    { key: 'reports', title: '已定稿报告', group: '工作成果' },
    { key: 'adopted', title: '确认采用', group: '工作成果' },
  ]

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>KPI 监控</h1>
          <p>三组口径分开计算。没有确认过的目标，不显示达标率，也不做综合评分。</p>
        </div>
      </header>
      {error && <p className="admin-note">{error}</p>}
      <section className="filter-bar">
        <div className="filter-controls">
          <div className="segmented">
            <button type="button" aria-pressed={preset === '7d'} onClick={() => setPreset('7d')}>最近7天</button>
            <button type="button" aria-pressed={preset === '14d'} onClick={() => setPreset('14d')}>最近14天</button>
          </div>
          <span>统计区间 {range.start} 至 {range.end} · 当前账号 {actorName(actor)}</span>
        </div>
      </section>
      {(['数据运行', '个人跟进', '工作成果'] as const).map((group) => (
        <section key={group} className="stack">
          <h2>{group}</h2>
          <p>{groupNote(group)}</p>
          <div className="metric-grid">
            {cards.filter((item) => item.group === group).map((card) => (
              <article key={card.key} className="metric-card">
                <h2>{card.title}</h2>
                <strong>{model[card.key].value}</strong>
                <p>{model[card.key].note}</p>
                <button type="button" className="btn tiny" onClick={() => setDetail(card.key)}>查看明细</button>
              </article>
            ))}
          </div>
        </section>
      ))}
      {detail && (
        <div className="admin-dialog" role="dialog" aria-modal="true">
          <div className="admin-sheet">
            <h2>{cards.find((item) => item.key === detail)?.title}</h2>
            <p>{model[detail].note}</p>
            <ul>
              {model[detail].rows.slice(0, 40).map((item) => <li key={item.id}>{item.label}</li>)}
            </ul>
            {model[detail].rows.length === 0 && <p>这个口径下没有记录。</p>}
            {model[detail].rows.length > 40 && <p>其余 {model[detail].rows.length - 40} 条未展开，计数仍包含它们。</p>}
            <button type="button" className="btn" onClick={() => setDetail(null)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  )
}

function groupNote(group: string) {
  if (group === '数据运行') return '任务按完成时间。失败和取消计入分母，进行中不算失败。没有任务记录时成功率是 —。待关联只统计还没确认事件的热搜条目。'
  if (group === '个人跟进') return '只统计当前账号。新建按创建时间，处理结果按当时写下的归档记录，不用现在的状态回推过去。等待时长从创建时间起算。'
  return '形成选题和交接来自当时记录的处理结果。定稿按定稿时间。没有确认采用的记录，不把定稿当成被采用。'
}

function dayOf(value: string) {
  return value.slice(0, 10)
}

function inRange(value: string, start: string, end: string) {
  const day = dayOf(value)
  return day >= start && day <= end
}

function mine(lead: Lead, actor: string) {
  return lead.ownerId === actor || lead.createdBy === actor
}

function recordsInRange(lead: Lead, start: string, end: string, actor: string) {
  return lead.archiveHistory.filter((item) => item.by === actor && inRange(item.at, start, end))
}

function build(start: string, end: string, reports: ReportDocument[], sources: DataSource[], actor: string) {
  const tasks = sources.flatMap((source) => source.tasks.filter((task) => !task.demo).map((task) => ({ ...task, source: source.name })))
  const ended = tasks.filter((task) => inRange(task.at, start, end) && /成功|失败|取消/.test(task.result))
  const succeeded = ended.filter((task) => task.result.includes('成功') && !task.result.includes('失败'))
  const pendingHot = latestHot().filter((item) => !resolveEventId(item))
  const leads = loadLeads().filter((item) => mine(item, actor) && !item.mergedInto)
  const created = leads.filter((item) => inRange(item.createdAt, start, end))
  const closed = leads.filter((item) => recordsInRange(item, start, end, actor).length > 0)
  const waiting = leads.filter((item) => item.status === 'pending')
  const topicRows = outcomeRows(leads, start, end, actor, 'topic')
  const handoffRows = outcomeRows(leads, start, end, actor, 'handoff')
  const finals = reports.filter((item) => item.createdBy === LOCAL_ACCOUNT && isFinal(item) && item.finalizedAt && inRange(item.finalizedAt, start, end))
  const latest = sources.map((source) => ({ source, task: latestSuccess(source) }))
  return {
    success: {
      value: ended.length ? `${Math.round((succeeded.length / ended.length) * 100)}%` : '—',
      note: ended.length ? `${succeeded.length}/${ended.length}，分母含失败和取消。` : '选定周期内没有已结束的接入任务。',
      rows: ended.map((task) => ({ id: task.id, label: `${task.at} ${task.source} ${task.result}` })),
    },
    freshness: {
      value: latest.some((item) => item.task) ? latest.filter((item) => item.task).sort((a, b) => (b.task!.at).localeCompare(a.task!.at))[0].task!.at.slice(0, 16).replace('T', ' ') : '—',
      note: '按数据源最近一次成功任务，不含演示检查。',
      rows: latest.map((item) => ({ id: item.source.id, label: item.task ? `${item.source.name} ${item.task.at}` : `${item.source.name} 还没有成功任务` })),
    },
    pending: {
      value: String(pendingHot.length),
      note: '最新快照里尚未确认事件的热搜。只关联主题的不算已归入事件。',
      rows: pendingHot.map((item) => ({ id: item.id, label: `${item.platform} ${item.title}` })),
    },
    created: {
      value: String(created.length),
      note: '按线索创建时间，归属当前账号。',
      rows: created.map((item) => ({ id: item.id, label: `${item.createdAt} ${item.title}` })),
    },
    closed: {
      value: String(closed.length),
      note: '周期内写过处理结果的线索，同一条多次记录只计一次。',
      rows: closed.map((item) => ({ id: item.id, label: `${item.title} ${recordsInRange(item, start, end, actor).map((row) => outcomeLabel(row.outcome)).join('、')}` })),
    },
    waiting: {
      value: waiting.length ? waiting.map((item) => waitHours(item.createdAt)).sort((a, b) => b - a)[0] + ' 小时' : '—',
      note: '当前仍待处理的记录。时长从创建时间算起，没有单独的进入待处理时间。',
      rows: waiting.map((item) => ({ id: item.id, label: `${item.title} 已等待 ${waitHours(item.createdAt)} 小时` })),
    },
    topics: {
      value: String(new Set(topicRows.map((item) => item.leadId)).size),
      note: '按当时记录的“形成选题”，不用当前状态回算。',
      rows: topicRows.map((item) => ({ id: item.id, label: item.label })),
    },
    handoff: {
      value: String(new Set(handoffRows.map((item) => item.leadId)).size),
      note: '按当时记录的“已交接”。',
      rows: handoffRows.map((item) => ({ id: item.id, label: item.label })),
    },
    reports: {
      value: String(finals.length),
      note: '按定稿时间。同一报告多次修订只在首次定稿计入，这里用定稿记录而不是当前草稿。',
      rows: finals.map((item) => ({ id: item.id, label: `${item.finalizedAt} ${item.title}` })),
    },
    adopted: {
      value: '—',
      note: '没有确认采用的记录。定稿和导出都不算被采用。',
      rows: [],
    },
  }
}

function latestHot() {
  const map = new Map<string, (typeof HOT_SNAPSHOTS)[number]>()
  for (const item of HOT_SNAPSHOTS) {
    const key = `${item.platform}:${item.itemId}`
    const prev = map.get(key)
    if (!prev || item.observedAt > prev.observedAt) map.set(key, item)
  }
  return [...map.values()]
}

function latestSuccess(source: DataSource): SourceTask | null {
  return source.tasks.filter((task) => !task.demo && task.result.includes('成功') && !task.result.includes('失败')).sort((a, b) => b.at.localeCompare(a.at))[0] ?? null
}

function outcomeRows(leads: Lead[], start: string, end: string, actor: string, outcome: ArchiveRecord['outcome']) {
  return leads.flatMap((lead) => recordsInRange(lead, start, end, actor).filter((item) => item.outcome === outcome).map((item) => ({
    id: `${lead.id}:${item.at}`,
    leadId: lead.id,
    label: `${item.at} ${lead.title}`,
  })))
}

function waitHours(createdAt: string) {
  const start = new Date(createdAt.replace(' ', 'T') + '+08:00').getTime()
  const end = new Date('2026-11-10T18:00:00+08:00').getTime()
  if (Number.isNaN(start)) return 0
  return Math.max(0, Math.round((end - start) / 36e5))
}

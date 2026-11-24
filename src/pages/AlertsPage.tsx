import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import '../admin/admin.css'
import { MEDIA, TOPICS } from '../data/demo/catalog.ts'
import { evaluateRules } from '../lib/adminAlerts.ts'
import {
  DATA_WATERMARK,
  kindLabel,
  loadRules,
  loadSources,
  mediaName,
  recordAudit,
  saveAlertRecords,
  saveRules,
  type AlertKind,
  type AlertRecord,
  type AlertRule,
} from '../lib/adminStore.ts'

const PAGE = 8

export function AlertsPage() {
  const [params] = useSearchParams()
  const sources = useMemo(() => loadSources(), [])
  const [rules, setRules] = useState<AlertRule[]>(() => loadRules())
  const [records, setRecords] = useState<AlertRecord[]>(() => evaluateRules(loadRules(), sources))
  const [tab, setTab] = useState<'records' | 'rules'>(params.get('tab') === 'rules' || params.get('media') ? 'rules' : 'records')
  const [status, setStatus] = useState('all')
  const [kind, setKind] = useState('all')
  const [page, setPage] = useState(0)
  const [active, setActive] = useState<AlertRecord | null>(null)
  const [editing, setEditing] = useState<AlertRule | null>(() => (params.get('media') ? draftRule('peer_news', params.get('media')) : null))
  const [message, setMessage] = useState('')

  const filtered = records.filter((item) => (status === 'all' || item.status === status) && (kind === 'all' || item.kind === kind))
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const view = filtered.slice(page * PAGE, page * PAGE + PAGE)

  function refresh(nextRules: AlertRule[]) {
    setRules(nextRules)
    saveRules(nextRules)
    setRecords(evaluateRules(nextRules, sources))
  }

  function patchRecord(id: string, patch: Partial<AlertRecord>, action: string) {
    const next = records.map((item) => (item.id === id ? { ...item, ...patch } : item))
    setRecords(next)
    saveAlertRecords(next)
    recordAudit({ object: '告警', action, result: '已保存' })
    setActive(next.find((item) => item.id === id) ?? null)
    setMessage(action)
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>告警中心</h1>
          <p>集中查看需要关注的变化，并回到对应的业务页面。</p>
        </div>
        <button type="button" className="btn" onClick={() => { setTab('rules'); setEditing(draftRule('peer_news', null)) }}>新建规则</button>
      </header>
      {message && <p className="admin-note">{message}</p>}
      <div className="segmented admin-tabs" role="tablist">
        <button type="button" aria-selected={tab === 'records'} onClick={() => setTab('records')}>告警记录</button>
        <button type="button" aria-selected={tab === 'rules'} onClick={() => setTab('rules')}>告警规则</button>
      </div>
      {tab === 'records' ? (
        <section className="card">
          <div className="card-body filter-controls">
            <label className="field">状态
              <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0) }}>
                <option value="all">全部</option>
                <option value="open">未处理</option>
                <option value="done">已处理</option>
                <option value="ignored">已忽略</option>
              </select>
            </label>
            <label className="field">类型
              <select value={kind} onChange={(event) => { setKind(event.target.value); setPage(0) }}>
                <option value="all">全部</option>
                <option value="topic_news">关注对象新增报道</option>
                <option value="peer_news">指定同行新报道</option>
                <option value="hot_rank">热榜名次</option>
                <option value="source_fail">数据源任务失败</option>
              </select>
            </label>
          </div>
          <div className="table-wrap">
            <table className="data-table admin-table">
              <thead>
                <tr><th>标题</th><th>类型</th><th>关联对象</th><th>触发时间</th><th>严重程度</th><th>处理状态</th><th>操作</th></tr>
              </thead>
              <tbody>
                {view.length === 0 ? <tr><td colSpan={7}>水位之后没有新的告警。历史数据不会在新建规则时全部重放。</td></tr> : view.map((item) => (
                  <tr key={item.id}>
                    <td><span className="admin-ellipsis" title={item.title}>{item.title}</span></td>
                    <td>{kindLabel(item.kind)}</td>
                    <td>{item.objectLabel}</td>
                    <td>{item.triggerAt.slice(0, 16).replace('T', ' ')}</td>
                    <td>{item.severity}</td>
                    <td>{item.status === 'open' ? '未处理' : item.status === 'done' ? '已处理' : '已忽略'}{item.read ? ' · 已读' : ''}</td>
                    <td><button type="button" className="btn tiny" onClick={() => { patchRecord(item.id, { read: true }, '已查看告警'); }}>查看</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-body news-actions">
            <span>第 {page + 1} / {pages} 页</span>
            <button type="button" className="btn tiny" disabled={page === 0} onClick={() => setPage(page - 1)}>上一页</button>
            <button type="button" className="btn tiny" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>下一页</button>
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="table-wrap">
            <table className="data-table admin-table">
              <thead><tr><th>名称</th><th>类型</th><th>对象</th><th>阈值</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {rules.length === 0 ? <tr><td colSpan={6}>还没有告警规则</td></tr> : rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.name}</td>
                    <td>{kindLabel(rule.kind)}</td>
                    <td>{rule.mediaId ? mediaName(rule.mediaId) : rule.topicId ? TOPICS.find((item) => item.id === rule.topicId)?.name : '—'}</td>
                    <td>{rule.rankEnter ? `前 ${rule.rankEnter} 名` : rule.rankRise ? `上升 ${rule.rankRise} 位` : '新增即提醒'}</td>
                    <td>{rule.enabled ? '启用' : '停用'}</td>
                    <td>
                      <div className="news-actions">
                        <button type="button" className="btn tiny" onClick={() => setEditing(rule)}>编辑</button>
                        <button type="button" className="btn tiny" onClick={() => { refresh(rules.map((item) => item.id === rule.id ? { ...item, enabled: !item.enabled } : item)); setMessage(rule.enabled ? '已停用规则，历史告警仍保留' : '已启用规则') }}>
                          {rule.enabled ? '停用' : '启用'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {active && (
        <div className="admin-dialog" role="dialog" aria-modal="true">
          <div className="admin-sheet">
            <h2>{active.title}</h2>
            <p>{kindLabel(active.kind)} · {active.severity}</p>
            <h3>为什么触发</h3>
            <p>{active.why}</p>
            <p>{active.numbers}</p>
            <h3>关联内容</h3>
            <p><Link to={active.href}>查看来源</Link></p>
            <label className="field">处理备注<textarea value={active.note} onChange={(event) => setActive({ ...active, note: event.target.value })} rows={3} /></label>
            <div className="admin-actions">
              <button type="button" className="btn ghost" onClick={() => setActive(null)}>关闭</button>
              <button type="button" className="btn" onClick={() => patchRecord(active.id, { status: 'ignored', note: active.note }, '已忽略告警')}>忽略</button>
              <button type="button" className="btn" onClick={() => patchRecord(active.id, { status: 'done', note: active.note }, '已处理告警')}>标记处理</button>
            </div>
          </div>
        </div>
      )}
      {editing && (
        <RuleForm
          rule={editing}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            const exists = rules.some((item) => item.id === next.id)
            refresh(exists ? rules.map((item) => (item.id === next.id ? next : item)) : [next, ...rules])
            recordAudit({ object: next.name, action: exists ? '更新告警规则' : '新建告警规则', result: '已保存' })
            setMessage(exists ? '规则已更新' : '规则已保存，只从当前数据水位之后判断')
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function draftRule(kind: AlertKind, mediaId: string | null): AlertRule {
  return {
    id: `rule-${Date.now().toString(36)}`,
    name: mediaId ? `${mediaName(mediaId)}新报道` : '',
    kind,
    enabled: true,
    mediaId,
    topicId: null,
    eventId: null,
    rankEnter: kind === 'hot_rank' ? 10 : null,
    rankRise: null,
    sourceId: null,
    baselineAt: DATA_WATERMARK,
    createdAt: new Date().toISOString(),
  }
}

function RuleForm({ rule, onClose, onSave }: { rule: AlertRule; onClose: () => void; onSave: (next: AlertRule) => void }) {
  const [draft, setDraft] = useState(rule)
  const [error, setError] = useState('')
  const sources = loadSources()
  return (
    <div className="admin-dialog" role="dialog" aria-modal="true">
      <form
        className="admin-sheet"
        onSubmit={(event) => {
          event.preventDefault()
          if (!draft.name.trim()) {
            setError('请填写规则名称')
            return
          }
          if (draft.kind === 'peer_news' && !draft.mediaId) {
            setError('请选择媒体')
            return
          }
          if (draft.kind === 'topic_news' && !draft.topicId && !draft.eventId) {
            setError('请选择主题')
            return
          }
          onSave({ ...draft, name: draft.name.trim() })
        }}
      >
        <h2>告警规则</h2>
        <p>只在站内提醒。短信、邮件和企业微信未接入。</p>
        <label className="field">名称<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="field">类型
          <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as AlertKind })}>
            <option value="topic_news">关注主题或事件出现新增报道</option>
            <option value="peer_news">指定同行出现新报道</option>
            <option value="hot_rank">热榜进入榜位或明显上升</option>
            <option value="source_fail">已接入数据源任务失败</option>
          </select>
        </label>
        {draft.kind === 'peer_news' && (
          <label className="field">媒体
            <select value={draft.mediaId ?? ''} onChange={(event) => setDraft({ ...draft, mediaId: event.target.value || null })}>
              <option value="">请选择</option>
              {MEDIA.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}
        {draft.kind === 'topic_news' && (
          <label className="field">主题
            <select value={draft.topicId ?? ''} onChange={(event) => setDraft({ ...draft, topicId: event.target.value || null })}>
              <option value="">请选择</option>
              {TOPICS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}
        {draft.kind === 'hot_rank' && (
          <>
            <label className="field">进入名次<input type="number" min={1} max={50} value={draft.rankEnter ?? ''} onChange={(event) => setDraft({ ...draft, rankEnter: Number(event.target.value) || null })} /></label>
            <label className="field">上升位数<input type="number" min={1} max={50} value={draft.rankRise ?? ''} onChange={(event) => setDraft({ ...draft, rankRise: Number(event.target.value) || null })} /></label>
          </>
        )}
        {draft.kind === 'source_fail' && (
          <label className="field">数据源
            <select value={draft.sourceId ?? ''} onChange={(event) => setDraft({ ...draft, sourceId: event.target.value || null })}>
              <option value="">全部已接入来源</option>
              {sources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}
        <p>从 {draft.baselineAt.slice(0, 16).replace('T', ' ')} 的数据水位开始，不把更早的记录当作新增。</p>
        {error && <p className="admin-note">{error}</p>}
        <div className="admin-actions">
          <button type="button" className="btn ghost" onClick={onClose}>取消</button>
          <button type="submit" className="btn">保存</button>
        </div>
      </form>
    </div>
  )
}

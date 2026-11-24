import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../admin/admin.css'
import { MEDIA } from '../data/demo/catalog.ts'
import {
  loadSources,
  mediaName,
  methodLabel,
  recordAudit,
  saveSources,
  sourceStatus,
  statusLabel,
  type DataSource,
  type SourceMethod,
} from '../lib/adminStore.ts'

const PAGE = 8

export function DataSourcePage() {
  const [rows, setRows] = useState<DataSource[]>(() => loadSources())
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<DataSource | null>(null)
  const [detail, setDetail] = useState<DataSource | null>(null)
  const [message, setMessage] = useState('')

  const filtered = useMemo(() => {
    return rows.filter((item) => {
      const text = `${item.name}${item.ownerName}${item.scope}`
      if (query.trim() && !text.includes(query.trim())) return false
      if (type !== 'all' && item.type !== type) return false
      if (status !== 'all' && sourceStatus(item) !== status) return false
      return true
    })
  }, [rows, query, type, status])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const view = filtered.slice(page * PAGE, page * PAGE + PAGE)
  const enabled = rows.filter((item) => item.enabled).length
  const abnormal = 0

  function persist(next: DataSource[], note: string) {
    setRows(next)
    saveSources(next)
    recordAudit({ object: '数据源', action: note, result: '已保存' })
    setMessage(note)
  }

  function toggle(id: string) {
    const next = rows.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item))
    const target = next.find((item) => item.id === id)
    persist(next, target?.enabled ? '已启用数据源' : '已停用数据源，历史报道仍保留')
  }

  function check(id: string) {
    const next = rows.map((item) => {
      if (item.id !== id) return item
      const task = {
        id: `task-${Date.now().toString(36)}`,
        at: new Date().toISOString(),
        action: '检查',
        result: item.enabled ? '待接入，未执行采集' : '已停用，未执行',
        demo: true,
        added: 0,
      }
      return { ...item, tasks: [task, ...item.tasks].slice(0, 20) }
    })
    persist(next, '已记录一次演示检查，没有新增报道')
    const updated = next.find((item) => item.id === id) ?? null
    setDetail(updated)
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>数据源管理</h1>
          <p>查看报道和热榜来自哪些来源、是否启用，以及最近一次检查。</p>
        </div>
        <button type="button" className="btn" onClick={() => setEditing(blankSource())}>新增数据源</button>
      </header>
      {message && <p className="admin-note">{message}</p>}
      <section className="metric-grid">
        <article className="metric-card"><h2>已配置</h2><strong>{rows.length}</strong></article>
        <article className="metric-card"><h2>已启用</h2><strong>{enabled}</strong></article>
        <article className="metric-card"><h2>异常</h2><strong>{abnormal}</strong><p>没有已接入的失败任务</p></article>
      </section>
      <section className="filter-bar">
        <div className="filter-controls">
          <label className="field grow">搜索<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} placeholder="来源或媒体名称" /></label>
          <label className="field">类型
            <select value={type} onChange={(event) => { setType(event.target.value); setPage(0) }}>
              <option value="all">全部</option>
              <option>报纸</option><option>网站</option><option>客户端</option><option>热榜</option>
            </select>
          </label>
          <label className="field">状态
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0) }}>
              <option value="all">全部</option>
              <option value="pending">待接入</option>
              <option value="disabled">已停用</option>
            </select>
          </label>
        </div>
      </section>
      <section className="card">
        <div className="table-wrap">
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>来源名称</th><th>类型</th><th>所属媒体或平台</th><th>接入方式</th><th>状态</th><th>最近成功更新</th><th>最近新增</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {view.length === 0 ? (
                <tr><td colSpan={8}>没有符合条件的数据源</td></tr>
              ) : view.map((item) => (
                <tr key={item.id}>
                  <td><span className="admin-ellipsis" title={item.name}>{item.name}</span></td>
                  <td>{item.type}</td>
                  <td>{item.ownerName}</td>
                  <td>{methodLabel(item.method)}</td>
                  <td>{statusLabel(sourceStatus(item))}</td>
                  <td>—</td>
                  <td>—</td>
                  <td>
                    <div className="news-actions">
                      <button type="button" className="btn tiny" onClick={() => setDetail(item)}>详情</button>
                      <button type="button" className="btn tiny" onClick={() => setEditing(item)}>编辑</button>
                      <button type="button" className="btn tiny" onClick={() => toggle(item.id)}>{item.enabled ? '停用' : '启用'}</button>
                      <button type="button" className="btn tiny" onClick={() => check(item.id)}>检查</button>
                    </div>
                  </td>
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
      {editing && (
        <SourceForm
          source={editing}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            const exists = rows.some((item) => item.id === next.id)
            persist(exists ? rows.map((item) => (item.id === next.id ? next : item)) : [next, ...rows], exists ? '已更新数据源配置' : '已保存数据源，状态为待接入')
            setEditing(null)
          }}
        />
      )}
      {detail && <SourceDetail source={rows.find((item) => item.id === detail.id) ?? detail} onClose={() => setDetail(null)} onCheck={() => check(detail.id)} />}
    </div>
  )
}

function blankSource(): DataSource {
  return {
    id: `src-${Date.now().toString(36)}`,
    name: '',
    type: '网站',
    ownerName: MEDIA[0].name,
    mediaId: MEDIA[0].id,
    scope: '',
    method: 'pending',
    enabled: true,
    tasks: [],
  }
}

function SourceForm({ source, onClose, onSave }: { source: DataSource; onClose: () => void; onSave: (next: DataSource) => void }) {
  const [draft, setDraft] = useState(source)
  const [error, setError] = useState('')
  return (
    <div className="admin-dialog" role="dialog" aria-modal="true">
      <form
        className="admin-sheet"
        onSubmit={(event) => {
          event.preventDefault()
          if (!draft.name.trim() || !draft.scope.trim()) {
            setError('请填写来源名称和采集范围')
            return
          }
          onSave({ ...draft, name: draft.name.trim(), scope: draft.scope.trim() })
        }}
      >
        <h2>{source.name ? '编辑数据源' : '新增数据源'}</h2>
        <p>同一媒体下的不同栏目分开配置。保存后不会自动采集。</p>
        <label className="field">来源名称<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="field">类型
          <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as DataSource['type'] })}>
            <option>报纸</option><option>网站</option><option>客户端</option><option>热榜</option>
          </select>
        </label>
        <label className="field">所属媒体
          <select
            value={draft.mediaId ?? ''}
            onChange={(event) => {
              const media = MEDIA.find((item) => item.id === event.target.value)
              setDraft({ ...draft, mediaId: media?.id ?? null, ownerName: media?.name ?? draft.ownerName })
            }}
          >
            <option value="">平台来源，不归属媒体</option>
            {MEDIA.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {!draft.mediaId && (
          <label className="field">平台名称<input value={draft.ownerName} onChange={(event) => setDraft({ ...draft, ownerName: event.target.value })} /></label>
        )}
        <label className="field">采集范围<input value={draft.scope} onChange={(event) => setDraft({ ...draft, scope: event.target.value })} placeholder="例如栏目或榜单" /></label>
        <label className="field">接入方式
          <select value={draft.method} onChange={(event) => setDraft({ ...draft, method: event.target.value as SourceMethod })}>
            <option value="pending">待接入</option>
            <option value="file">文件导入</option>
            <option value="api">接口</option>
          </select>
        </label>
        {draft.method === 'api' && <p>密钥只放在服务端，这个表单不保存密钥，也不会显示为已接通。</p>}
        {draft.method === 'file' && <p>当前没有可用的文件导入。保存后仍是待接入，不会把配置当成定时采集。</p>}
        {error && <p className="admin-note">{error}</p>}
        <div className="admin-actions">
          <button type="button" className="btn ghost" onClick={onClose}>取消</button>
          <button type="submit" className="btn">保存</button>
        </div>
      </form>
    </div>
  )
}

function SourceDetail({ source, onClose, onCheck }: { source: DataSource; onClose: () => void; onCheck: () => void }) {
  const failed = source.tasks.filter((item) => item.result.includes('失败') && !item.demo)
  return (
    <div className="admin-dialog" role="dialog" aria-modal="true">
      <div className="admin-sheet">
        <h2>{source.name}</h2>
        <p>{source.ownerName} · {statusLabel(sourceStatus(source))}</p>
        <h3>基础配置</h3>
        <p>类型 {source.type}，接入方式 {methodLabel(source.method)}。所属媒体 {mediaName(source.mediaId)}。</p>
        <h3>数据范围</h3>
        <p>{source.scope}</p>
        <h3>最近任务</h3>
        {source.tasks.length === 0 ? <p>还没有检查记录。</p> : (
          <ul>
            {source.tasks.slice(0, 6).map((task) => (
              <li key={task.id}>{task.at.slice(0, 16).replace('T', ' ')} {task.action}：{task.result}{task.demo ? '（演示任务）' : ''}</li>
            ))}
          </ul>
        )}
        <h3>错误摘要</h3>
        <p>{failed.length ? failed[0].result : '没有失败记录。'}</p>
        <h3>已关联报道</h3>
        {source.mediaId ? <Link to={`/compete?media=${source.mediaId}`}>查看{source.ownerName}已收录报道</Link> : <p>热榜来源请到热搜追踪查看。</p>}
        <div className="admin-actions">
          <button type="button" className="btn ghost" onClick={onClose}>关闭</button>
          <button type="button" className="btn" onClick={onCheck}>检查</button>
        </div>
      </div>
    </div>
  )
}

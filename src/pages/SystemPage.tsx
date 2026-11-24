import { useEffect, useMemo, useState } from 'react'
import '../admin/admin.css'
import { CATEGORIES, TOPICS } from '../data/demo/catalog.ts'
import { NEWS } from '../data/demo/news.ts'
import {
  loadAudit,
  loadCatalogOverlay,
  loadSettings,
  recordAudit,
  saveCatalogOverlay,
  saveSettings,
  type CatalogOverlay,
  type SystemSettings,
} from '../lib/adminStore.ts'
import { LOCAL_ACCOUNT } from '../lib/reportMeta.ts'

const SCREEN_KEY = 'clue-screen-proto-v1'
const EXPORT_VERSION = 1

export function SystemPage() {
  const [tab, setTab] = useState<'basic' | 'catalog' | 'account' | 'audit' | 'backup'>('basic')
  const [settings, setSettings] = useState<SystemSettings>(() => loadSettings())
  const [overlay, setOverlay] = useState<CatalogOverlay>(() => loadCatalogOverlay())
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [ai, setAi] = useState('正在查看连接状态')
  const [auditType, setAuditType] = useState('all')
  const [auditFrom, setAuditFrom] = useState('')
  const [preview, setPreview] = useState<{ settings?: SystemSettings; screen?: unknown } | null>(null)
  const audit = loadAudit()

  useEffect(() => {
    fetch('/api/ai/status')
      .then((response) => response.json())
      .then((body: { configured?: boolean }) => setAi(body.configured ? '已配置，密钥留在服务端' : '未配置'))
      .catch(() => setAi('暂时无法确认'))
  }, [])

  const rows = useMemo(() => {
    const categories = CATEGORIES.map((item) => ({
      kind: '分类' as const,
      id: item.id,
      name: overlay.categories[item.id]?.name || item.name,
      description: overlay.categories[item.id]?.description || '',
      disabled: Boolean(overlay.categories[item.id]?.disabled),
      linked: NEWS.filter((news) => news.categoryId === item.id).length,
    }))
    const topics = TOPICS.map((item) => ({
      kind: '主题' as const,
      id: item.id,
      name: overlay.topics[item.id]?.name || item.name,
      description: overlay.topics[item.id]?.description || '',
      disabled: Boolean(overlay.topics[item.id]?.disabled),
      linked: NEWS.filter((news) => news.topicId === item.id).length,
    }))
    return [...categories, ...topics].filter((item) => !query.trim() || item.name.includes(query.trim()))
  }, [overlay, query])

  function saveBasic() {
    saveSettings(settings)
    recordAudit({ object: '基本设置', action: '保存展示偏好', result: '已保存' })
    setMessage('已保存。时区只影响新页面的日期展示，不改原始时间。')
  }

  function editRow(kind: '分类' | '主题', id: string) {
    const current = rows.find((item) => item.kind === kind && item.id === id)
    if (!current) return
    const name = window.prompt('名称', current.name)
    if (!name || !name.trim()) return
    const description = window.prompt('描述', current.description) ?? current.description
    const next = structuredClone(overlay)
    const bucket = kind === '分类' ? next.categories : next.topics
    bucket[id] = { ...bucket[id], name: name.trim(), description }
    setOverlay(next)
    saveCatalogOverlay(next)
    recordAudit({ object: `${kind} ${name.trim()}`, action: '修改名称或描述', result: '已保存' })
    setMessage('已保存。总览等页面仍使用内置名称，停用不会删除已有报道。')
  }

  function disableRow(kind: '分类' | '主题', id: string) {
    const next = structuredClone(overlay)
    const bucket = kind === '分类' ? next.categories : next.topics
    bucket[id] = { ...bucket[id], disabled: !bucket[id]?.disabled }
    setOverlay(next)
    saveCatalogOverlay(next)
    recordAudit({ object: `${kind} ${id}`, action: bucket[id]?.disabled ? '停用' : '启用', result: '已保存' })
  }

  const visibleAudit = audit.filter((item) => {
    if (auditType !== 'all' && !item.object.includes(auditType) && !item.action.includes(auditType)) return false
    if (auditFrom && item.at.slice(0, 10) < auditFrom) return false
    return true
  })

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>系统管理</h1>
          <p>调整展示偏好、查看分类主题和本机操作记录。</p>
        </div>
      </header>
      {message && <p className="admin-note">{message}</p>}
      <div className="segmented">
        <button type="button" aria-pressed={tab === 'basic'} onClick={() => setTab('basic')}>基本设置</button>
        <button type="button" aria-pressed={tab === 'catalog'} onClick={() => setTab('catalog')}>分类与主题</button>
        <button type="button" aria-pressed={tab === 'account'} onClick={() => setTab('account')}>账号与权限</button>
        <button type="button" aria-pressed={tab === 'audit'} onClick={() => setTab('audit')}>操作记录</button>
        <button type="button" aria-pressed={tab === 'backup'} onClick={() => setTab('backup')}>配置导出</button>
      </div>
      {tab === 'basic' && (
        <section className="card">
          <form className="card-body stack" onSubmit={(event) => { event.preventDefault(); saveBasic() }}>
            <label className="field">系统名称<input value={settings.systemName} onChange={(event) => setSettings({ ...settings, systemName: event.target.value })} /></label>
            <label className="field">默认首页
              <select value={settings.home} onChange={(event) => setSettings({ ...settings, home: event.target.value as SystemSettings['home'] })}>
                <option value="overview">线索总览</option>
                <option value="hot">热搜追踪</option>
                <option value="compete">竞品监控</option>
                <option value="leads">线索管理</option>
              </select>
            </label>
            <label className="field">展示时区
              <select value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value as SystemSettings['timezone'] })}>
                <option value="Asia/Shanghai">北京时间</option>
                <option value="UTC">UTC</option>
              </select>
            </label>
            <label className="field">展示密度
              <select value={settings.density} onChange={(event) => setSettings({ ...settings, density: event.target.value as SystemSettings['density'] })}>
                <option value="comfortable">标准</option>
                <option value="compact">紧凑</option>
              </select>
            </label>
            <button type="submit" className="btn">保存</button>
          </form>
        </section>
      )}
      {tab === 'catalog' && (
        <section className="card">
          <div className="card-body"><label className="field grow">搜索<input value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>类型</th><th>名称</th><th>描述</th><th>关联报道</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={`${item.kind}-${item.id}`}>
                    <td>{item.kind}</td>
                    <td>{item.name}</td>
                    <td>{item.description || '—'}</td>
                    <td>{item.linked}</td>
                    <td>{item.disabled ? '已停用' : '使用中'}</td>
                    <td>
                      <div className="news-actions">
                        <button type="button" className="btn tiny" onClick={() => editRow(item.kind, item.id)}>编辑</button>
                        <button type="button" className="btn tiny" onClick={() => disableRow(item.kind, item.id)}>{item.disabled ? '启用' : '停用'}</button>
                        <button type="button" className="btn tiny" disabled={item.linked > 0} title={item.linked > 0 ? '有关联报道，不能删除' : '没有关联报道'}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === 'account' && (
        <section className="card">
          <div className="card-body stack">
            <p>当前账号 {LOCAL_ACCOUNT}</p>
            <p>角色：本地演示。服务端没有单独的登录和授权接口，此页不能切换身份。</p>
            <p>内容分析：{ai}</p>
          </div>
        </section>
      )}
      {tab === 'audit' && (
        <section className="card">
          <div className="card-body filter-controls">
            <label className="field">类型<input value={auditType} onChange={(event) => setAuditType(event.target.value)} placeholder="例如数据源" /></label>
            <label className="field">开始日期<input type="date" value={auditFrom} onChange={(event) => setAuditFrom(event.target.value)} /></label>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>时间</th><th>账号</th><th>对象</th><th>动作</th><th>结果</th></tr></thead>
              <tbody>
                {visibleAudit.length === 0 ? <tr><td colSpan={5}>还没有操作记录</td></tr> : visibleAudit.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.at).toLocaleString('zh-CN', { timeZone: settings.timezone === 'UTC' ? 'UTC' : 'Asia/Shanghai', hour12: false })}</td>
                    <td>{item.actor}</td>
                    <td>{item.object}</td>
                    <td>{item.action}</td>
                    <td>{item.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === 'backup' && (
        <section className="card">
          <div className="card-body stack">
            <p>这里只导出大屏布局和展示偏好，不是全系统备份。数据库备份尚未接入。</p>
            <div className="news-actions">
              <button type="button" className="btn" onClick={exportConfig}>导出配置</button>
              <label className="btn">选择文件<input type="file" accept="application/json" hidden onChange={(event) => readImport(event.target.files?.[0] ?? null, setPreview, setMessage)} /></label>
            </div>
            {preview && (
              <div>
                <p>将更新：{preview.settings ? '展示偏好' : ''}{preview.screen ? '、大屏布局' : ''}。确认后才会覆盖对应配置。</p>
                <button type="button" className="btn" onClick={() => applyImport(preview, setMessage, setSettings, setPreview)}>确认导入</button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function exportConfig() {
  const payload = {
    version: EXPORT_VERSION,
    kind: 'display-config',
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
    screen: JSON.parse(localStorage.getItem(SCREEN_KEY) || 'null'),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'display-config.json'
  link.click()
  URL.revokeObjectURL(link.href)
  recordAudit({ object: '展示配置', action: '导出', result: '已下载' })
}

function readImport(file: File | null, setPreview: (value: { settings?: SystemSettings; screen?: unknown } | null) => void, setMessage: (value: string) => void) {
  if (!file) return
  file.text().then((text) => {
    const parsed = JSON.parse(text) as { version?: number; kind?: string; settings?: SystemSettings; screen?: unknown }
    if (parsed.kind !== 'display-config' || parsed.version !== EXPORT_VERSION) {
      setPreview(null)
      setMessage('文件不符合展示配置格式，现有配置没有改动')
      return
    }
    setPreview({ settings: parsed.settings, screen: parsed.screen })
    setMessage('已读入文件，确认后才会写入')
  }).catch(() => {
    setPreview(null)
    setMessage('文件无法读取，现有配置没有改动')
  })
}

function applyImport(preview: { settings?: SystemSettings; screen?: unknown }, setMessage: (value: string) => void, setSettings: (value: SystemSettings) => void, setPreview: (value: null) => void) {
  if (preview.settings) {
    saveSettings(preview.settings)
    setSettings(preview.settings)
  }
  if (preview.screen) localStorage.setItem(SCREEN_KEY, JSON.stringify(preview.screen))
  recordAudit({ object: '展示配置', action: '导入', result: '已写入' })
  setPreview(null)
  setMessage('展示配置已更新')
}

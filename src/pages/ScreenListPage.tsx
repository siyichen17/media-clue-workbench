import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NewsDrawer } from '../components/news/NewsDrawer.tsx'
import { DashboardRenderer, DESIGN_H, DESIGN_W } from '../screen/DashboardRenderer.tsx'
import { EMPTY_TRANSIENT } from '../screen/query.ts'
import { getTemplate, lastScreenId, listTemplates, rememberScreen, SYSTEM_TEMPLATES } from '../screen/store.ts'
import type { DrawerModel } from '../types/domain.ts'
import '../screen/screen.css'

const emptyFollows = new Set<string>()

export function ScreenListPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [customs, setCustoms] = useState(() => listTemplates().mine)
  const [templateId, setTemplateId] = useState(() => {
    const requested = (location.state as { templateId?: string } | null)?.templateId
    const preferred = requested || lastScreenId()
    return preferred && getTemplate(preferred) ? preferred : 'national'
  })
  const [scale, setScale] = useState(0.42)
  const [drawer, setDrawer] = useState<DrawerModel | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const template = getTemplate(templateId) ?? SYSTEM_TEMPLATES[0]

  useEffect(() => {
    const node = frameRef.current
    if (!node) return
    const measure = () => setScale(Math.min(node.clientWidth / DESIGN_W, node.clientHeight / DESIGN_H))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [templateId])

  if (!template) return null

  return (
    <main className="screen-proto proto-root">
      <div className="bs-unified-header">
        <div className="header-info">
          <h3>可视化大屏</h3>
          <p>先打开编辑，勾选组件并设一个重点，再从排版方案里选用。模拟数据截止 2026-11-10 18:00。</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-ghost" onClick={() => { setCustoms(listTemplates().mine) }}>刷新列表</button>
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/screen/view/${template.templateId}?edit=1`, { state: { draft: structuredClone(template) } })}>编辑布局</button>
        </div>
      </div>
      <div className="bs-template-bar">
        {SYSTEM_TEMPLATES.map((item) => (
          <button type="button" key={item.templateId} className={templateId === item.templateId ? 'bs-template-chip active' : 'bs-template-chip'} onClick={() => { rememberScreen(item.templateId); setTemplateId(item.templateId) }}>{item.name}</button>
        ))}
        {customs.map((item) => (
          <button type="button" key={item.templateId} className={templateId === item.templateId ? 'bs-template-chip active' : 'bs-template-chip'} onClick={() => { rememberScreen(item.templateId); setTemplateId(item.templateId) }}>{item.name}</button>
        ))}
      </div>
      <div className="bs-live-frame list-stage" ref={frameRef}>
        <DashboardRenderer template={template} mode="display" scale={scale || 0.4} transient={EMPTY_TRANSIENT} onNews={(items, title) => setDrawer({ kind: 'news', tags: [{ id: 'screen', label: title }], items, note: '模拟数据，截止 2026-11-10 18:00。' })} onHot={(eventId) => navigate('/hot', { state: { eventId, from: '/screen' } })} />
      </div>
      <NewsDrawer model={drawer} followedIds={emptyFollows} onClose={() => setDrawer(null)} onToggleFollow={() => undefined} entry="overview" />
    </main>
  )
}

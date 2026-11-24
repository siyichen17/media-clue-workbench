import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { loadSettings } from '../../lib/adminStore.ts'
import { Icon } from '../icons.tsx'

const GROUPS: { label: string; items: { id: string; label: string; icon: 'overview' | 'hot' | 'compete' | 'leads' | 'reports' | 'screen' | 'source' | 'bell' | 'kpi' | 'settings' }[] }[] = [
  {
    label: '常用',
    items: [
      { id: 'hot', label: '热点', icon: 'hot' },
      { id: 'leads', label: '我的跟进', icon: 'leads' },
      { id: 'reports', label: '报告', icon: 'reports' },
    ],
  },
  {
    label: '工具',
    items: [
      { id: 'compete', label: '同行监控', icon: 'compete' },
      { id: 'overview', label: '统计总览', icon: 'overview' },
      { id: 'screen', label: '可视化大屏', icon: 'screen' },
    ],
  },
  {
    label: '管理',
    items: [
      { id: 'source', label: '数据源', icon: 'source' },
      { id: 'kpi', label: 'KPI', icon: 'kpi' },
      { id: 'settings', label: '系统设置', icon: 'settings' },
    ],
  },
]

function itemActive(id: string, pathname: string): boolean {
  if (id === 'overview') return pathname === '/'
  if (id === 'compete') return pathname === '/compete'
  if (id === 'hot') return pathname === '/hot'
  if (id === 'leads') return pathname === '/leads'
  if (id === 'reports') return pathname === '/reports' || pathname.startsWith('/reports/')
  if (id === 'screen') return pathname === '/screen' || pathname.startsWith('/screen/')
  if (id === 'source') return pathname === '/source'
  if (id === 'alerts') return pathname === '/alerts'
  if (id === 'kpi') return pathname === '/kpi'
  if (id === 'settings') return pathname === '/settings'
  return false
}

const PATHS: Record<string, string> = {
  overview: '/',
  compete: '/compete',
  hot: '/hot',
  leads: '/leads',
  reports: '/reports',
  screen: '/screen',
  source: '/source',
  alerts: '/alerts',
  kpi: '/kpi',
  settings: '/settings',
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const settings = loadSettings()
  useEffect(() => {
    document.documentElement.dataset.density = settings.density
    document.title = settings.systemName
    if (sessionStorage.getItem('clue-home-landed')) return
    sessionStorage.setItem('clue-home-landed', '1')
    const home = PATHS[settings.home] ?? '/'
    if (pathname === '/' && home !== '/') navigate(home, { replace: true })
  }, [navigate, pathname, settings.density, settings.home, settings.systemName])
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            线
          </span>
          <span>
            <strong>{settings.systemName}</strong>
            <small>工作台</small>
          </span>
        </div>
        <nav className="nav" aria-label="主导航">
          {GROUPS.map((group) => (
            <section key={group.label} className="nav-group">
              <h2>{group.label}</h2>
              {group.items.map((item) => {
                const to = PATHS[item.id] ?? '/'
                return (
                  <NavLink
                    key={item.id}
                    to={to}
                    className={itemActive(item.id, pathname) ? 'nav-item active' : 'nav-item'}
                    aria-current={itemActive(item.id, pathname) ? 'page' : undefined}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </section>
          ))}
        </nav>
        <NavLink to="/alerts" className={itemActive('alerts', pathname) ? 'nav-item active' : 'nav-item'}>
          <Icon name="bell" />
          <span>消息</span>
        </NavLink>
        <p className="sidebar-foot">数据截止 2026-11-10 18:00</p>
      </aside>
      <div className="workspace">{children}</div>
    </div>
  )
}

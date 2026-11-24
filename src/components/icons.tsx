type IconName =
  | 'overview'
  | 'hot'
  | 'compete'
  | 'leads'
  | 'reports'
  | 'screen'
  | 'source'
  | 'bell'
  | 'kpi'
  | 'settings'
  | 'search'
  | 'close'

const PATHS: Record<IconName, string> = {
  overview: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  hot: 'M4 16l5-5 3 3 8-8M14 6h6v6',
  compete: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  leads: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  reports: 'M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M9 17h6',
  screen: 'M3 5h18v11H3zM8 20h8M12 16v4',
  source: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5',
  bell: 'M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5zM10 19a2 2 0 0 0 4 0',
  kpi: 'M4 18V6M4 18h16M8 14l3-3 2 2 5-6',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4',
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-3.5-3.5',
  close: 'M6 6l12 12M18 6 6 18',
}

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

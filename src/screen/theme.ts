export type DashboardThemeId = 'deep-ocean' | 'obsidian-gold' | 'light-business'

export interface DashboardAppearance {
  themeId: DashboardThemeId
  motionEnabled: boolean
}

export interface DashPalette {
  id: DashboardThemeId
  name: string
  blurb: string
  bg: string
  panel: string
  panelFill: string
  ink: string
  muted: string
  accent: string
  accent2: string
  highlight: string
  border: string
  split: string
  atmosphere: string
  mapEmpty: string
  mapScale: [string, string, string, string]
  mapBorder: string
  mapLabel: string
  mapShadow: string
  mapGlow: number
  bubble: [string, string, string, string, string, string]
  bubbleInk: string
  tooltipBg: string
  tooltipInk: string
  up: string
  down: string
}

export const THEMES: Record<DashboardThemeId, DashPalette> = {
  'deep-ocean': {
    id: 'deep-ocean',
    name: '深海科技',
    blurb: '深蓝底、蓝青数据、橙金重点',
    bg: '#061120',
    panel: '#0B1B30',
    panelFill: 'linear-gradient(180deg, rgba(53, 197, 239, 0.07), transparent 36%), #0B1B30',
    ink: '#EAF4FF',
    muted: '#A4B8D0',
    accent: '#35C5EF',
    accent2: '#3DD8C5',
    highlight: '#FFC16E',
    border: 'rgba(156, 178, 204, 0.22)',
    split: 'rgba(156, 178, 204, 0.16)',
    atmosphere: 'radial-gradient(ellipse at 50% 42%, rgba(53, 197, 239, 0.08), transparent 58%), linear-gradient(rgba(156, 178, 204, 0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(156, 178, 204, 0.045) 1px, transparent 1px)',
    mapEmpty: '#0c2036',
    mapScale: ['#12324d', '#1d6f8a', '#35C5EF', '#3DD8C5'],
    mapBorder: 'rgba(157, 214, 232, 0.55)',
    mapLabel: '#EAF4FF',
    mapShadow: 'rgba(6, 17, 32, 0.45)',
    mapGlow: 8,
    bubble: ['#35C5EF', '#3DD8C5', '#7ee7f5', '#8fd9c8', '#5eb6d6', '#F0C27A'],
    bubbleInk: '#061120',
    tooltipBg: '#0B1B30',
    tooltipInk: '#EAF4FF',
    up: '#3DD8C5',
    down: '#E07A7A',
  },
  'obsidian-gold': {
    id: 'obsidian-gold',
    name: '曜黑金',
    blurb: '黑灰层次，金色重点，辅助色分开',
    bg: '#101114',
    panel: '#1B1D23',
    panelFill: '#1B1D23',
    ink: '#F4F1EA',
    muted: '#B8B3A9',
    accent: '#DAB675',
    accent2: '#8FAFC0',
    highlight: '#F2CD8C',
    border: 'rgba(218, 182, 117, 0.28)',
    split: 'rgba(184, 179, 169, 0.16)',
    atmosphere: 'none',
    mapEmpty: '#16181D',
    mapScale: ['#2A2C33', '#5C5344', '#A8884E', '#DAB675'],
    mapBorder: 'rgba(218, 182, 117, 0.35)',
    mapLabel: '#F4F1EA',
    mapShadow: 'rgba(0, 0, 0, 0.35)',
    mapGlow: 0,
    bubble: ['#DAB675', '#8FAFC0', '#C4A574', '#6E8B9A', '#C9897A', '#A8C4B0'],
    bubbleInk: '#1B1D23',
    tooltipBg: '#1B1D23',
    tooltipInk: '#F4F1EA',
    up: '#8FAFC0',
    down: '#E07A7A',
  },
  'light-business': {
    id: 'light-business',
    name: '明亮商务',
    blurb: '浅底深字，蓝色强调，细边框',
    bg: '#F2F5FA',
    panel: '#FFFFFF',
    panelFill: '#FFFFFF',
    ink: '#17263C',
    muted: '#53657D',
    accent: '#2563EB',
    accent2: '#0F8B8D',
    highlight: '#B86A12',
    border: 'rgba(23, 38, 60, 0.14)',
    split: 'rgba(23, 38, 60, 0.1)',
    atmosphere: 'none',
    mapEmpty: '#E7EEF8',
    mapScale: ['#E4EDF8', '#C5DAF6', '#8EB4EA', '#4C82D6'],
    mapBorder: '#B7C6DA',
    mapLabel: '#17263C',
    mapShadow: 'rgba(23, 38, 60, 0.08)',
    mapGlow: 0,
    bubble: ['#93C5FD', '#7DCEC8', '#F3D7B0', '#C7D2FE', '#FDE68A', '#A7F3D0'],
    bubbleInk: '#17263C',
    tooltipBg: '#FFFFFF',
    tooltipInk: '#17263C',
    up: '#0F8B8D',
    down: '#B42318',
  },
}

export const THEME_LIST = [THEMES['deep-ocean'], THEMES['obsidian-gold'], THEMES['light-business']]

export function isThemeId(value: unknown): value is DashboardThemeId {
  return value === 'deep-ocean' || value === 'obsidian-gold' || value === 'light-business'
}

export function paletteOf(id: DashboardThemeId) {
  return THEMES[id]
}

export function resolveAppearance(source: { appearance?: Partial<DashboardAppearance> | null; presentation?: { motionEnabled?: boolean } | null }): DashboardAppearance {
  const themeId = isThemeId(source.appearance?.themeId) ? source.appearance.themeId : 'deep-ocean'
  const motionEnabled = typeof source.appearance?.motionEnabled === 'boolean'
    ? source.appearance.motionEnabled
    : source.presentation?.motionEnabled !== false
  return { themeId, motionEnabled }
}

export function themeVars(theme: DashPalette): Record<string, string> {
  return {
    '--dash-bg': theme.bg,
    '--dash-panel': theme.panel,
    '--dash-panel-fill': theme.panelFill,
    '--dash-ink': theme.ink,
    '--dash-muted': theme.muted,
    '--dash-accent': theme.accent,
    '--dash-accent-2': theme.accent2,
    '--dash-highlight': theme.highlight,
    '--dash-border': theme.border,
    '--dash-split': theme.split,
    '--dash-atmosphere': theme.atmosphere,
    '--dash-tooltip-bg': theme.tooltipBg,
    '--dash-up': theme.up,
    '--dash-down': theme.down,
    '--dash-map-empty': theme.mapEmpty,
  }
}

export function alpha(hex: string, amount: number) {
  const raw = hex.replace('#', '')
  const value = raw.length === 3 ? raw.split('').map((item) => item + item).join('') : raw
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${amount})`
}

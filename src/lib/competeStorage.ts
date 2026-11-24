import { MEDIA } from '../data/demo/catalog.ts'
import { DATA_END, DEFAULT_START } from './dates.ts'
import type { DatePreset } from '../types/domain.ts'

export interface MediaProfile {
  id: string
  name: string
  site: string
  keywords: string[]
  note: string
  enabled: boolean
  builtin: boolean
}

export interface MediaState {
  ownMediaId: string
  profiles: MediaProfile[]
}

export interface AlertRule {
  id: string
  mediaId: string
  kind: 'daily_count' | 'keyword' | 'hot_event'
  enabled: boolean
  threshold: number
  keywords: string[]
}

export interface CompeteFilters {
  preset: DatePreset
  customStart: string
  customEnd: string
  ownMediaId: string
  peerIds: string[]
  categoryId: string
  nature: 'all' | 'real' | 'simulated'
}

const MEDIA_KEY = 'compete-media-state-v1'
const RULE_KEY = 'compete-alert-rules-v1'
const HANDLED_KEY = 'compete-alert-handled-v1'
const FILTER_KEY = 'compete-filters-v1'

export function builtinProfiles(): MediaProfile[] {
  return MEDIA.map((media) => ({
    id: media.id,
    name: media.name,
    site: '',
    keywords: media.id === 'cover' ? ['低空经济', '地铁'] : [],
    note: '',
    enabled: true,
    builtin: true,
  }))
}

export function defaultRules(ownMediaId = 'cover'): AlertRule[] {
  return [
    { id: `${ownMediaId}:daily_count`, mediaId: ownMediaId, kind: 'daily_count', enabled: true, threshold: 5, keywords: [] },
    {
      id: `${ownMediaId}:keyword`,
      mediaId: ownMediaId,
      kind: 'keyword',
      enabled: true,
      threshold: 1,
      keywords: ['低空经济', '地铁'],
    },
    { id: `${ownMediaId}:hot_event`, mediaId: ownMediaId, kind: 'hot_event', enabled: true, threshold: 1, keywords: [] },
  ]
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function loadMediaState(): MediaState {
  const saved = readJson<MediaState>(MEDIA_KEY)
  const builtins = builtinProfiles()
  const savedProfiles = Array.isArray(saved?.profiles) ? saved.profiles : []
  const profiles = builtins.map((builtin) => {
    const overlay = savedProfiles.find((item) => item.id === builtin.id)
    if (!overlay) return builtin
    return {
      ...builtin,
      name: overlay.name?.trim() || builtin.name,
      site: overlay.site ?? '',
      keywords: Array.isArray(overlay.keywords) ? overlay.keywords.filter((item) => typeof item === 'string' && item.trim()) : [],
      note: overlay.note ?? '',
      enabled: overlay.enabled !== false,
    }
  })
  for (const extra of savedProfiles) {
    if (extra.builtin || builtins.some((item) => item.id === extra.id)) continue
    if (!extra.id || !extra.name) continue
    profiles.push({
      id: extra.id,
      name: extra.name,
      site: extra.site ?? '',
      keywords: Array.isArray(extra.keywords) ? extra.keywords : [],
      note: extra.note ?? '',
      enabled: extra.enabled !== false,
      builtin: false,
    })
  }
  const ownMediaId = profiles.some((item) => item.id === saved?.ownMediaId) ? saved!.ownMediaId : 'cover'
  return { ownMediaId, profiles }
}

export function saveMediaState(state: MediaState) {
  localStorage.setItem(MEDIA_KEY, JSON.stringify(state))
}

export function loadAlertRules(): AlertRule[] {
  const saved = readJson<AlertRule[]>(RULE_KEY)
  if (!Array.isArray(saved) || !saved.length) return defaultRules()
  return saved.filter((rule) => rule && rule.id && rule.mediaId && rule.kind)
}

export function saveAlertRules(rules: AlertRule[]) {
  localStorage.setItem(RULE_KEY, JSON.stringify(rules))
}

export function loadHandledAlerts(): Set<string> {
  const saved = readJson<string[]>(HANDLED_KEY)
  return new Set(Array.isArray(saved) ? saved.filter((item) => typeof item === 'string') : [])
}

export function saveHandledAlerts(ids: Set<string>) {
  localStorage.setItem(HANDLED_KEY, JSON.stringify([...ids]))
}

export function defaultFilters(ownMediaId: string, profiles: MediaProfile[]): CompeteFilters {
  const peerIds = profiles.filter((item) => item.enabled && item.id !== ownMediaId).map((item) => item.id)
  return {
    preset: '7d',
    customStart: DEFAULT_START,
    customEnd: DATA_END,
    ownMediaId,
    peerIds,
    categoryId: 'all',
    nature: 'all',
  }
}

export function loadFilters(fallback: CompeteFilters): CompeteFilters {
  try {
    const rawText = sessionStorage.getItem(FILTER_KEY)
    if (!rawText) return fallback
    const raw = JSON.parse(rawText) as CompeteFilters
    if (!raw.ownMediaId) return fallback
    const peerIds = Array.isArray(raw.peerIds) ? raw.peerIds.filter((id) => id && id !== raw.ownMediaId) : fallback.peerIds
    return { ...fallback, ...raw, peerIds }
  } catch {
    return fallback
  }
}

export function saveFilters(filters: CompeteFilters) {
  sessionStorage.setItem(FILTER_KEY, JSON.stringify(filters))
}

export function profileName(profiles: MediaProfile[], id: string): string {
  return profiles.find((item) => item.id === id)?.name ?? id
}

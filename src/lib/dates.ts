import type { DatePreset, OverviewFilters } from '../types/domain.ts'

export const DATA_START = '2026-10-28'
export const DATA_END = '2026-11-10'
export const DEFAULT_START = '2026-11-04'
export const DATA_AS_OF = '2026-11-10T18:00:00+08:00'
export const DATA_AS_OF_LABEL = '2026-11-10 18:00'

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  const y = utc.getUTCFullYear()
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const d = String(utc.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function eachDate(start: string, end: string): string[] {
  const dates: string[] = []
  let cursor = start
  while (cursor <= end) {
    dates.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return dates
}

export function clampDate(isoDate: string): string {
  if (isoDate < DATA_START) return DATA_START
  if (isoDate > DATA_END) return DATA_END
  return isoDate
}

export function dateRangeOf(filters: Pick<OverviewFilters, 'preset' | 'customStart' | 'customEnd'>): {
  start: string
  end: string
} {
  if (filters.preset === '14d') return { start: DATA_START, end: DATA_END }
  if (filters.preset === '7d') return { start: DEFAULT_START, end: DATA_END }
  let start = clampDate(filters.customStart || DATA_START)
  let end = clampDate(filters.customEnd || DATA_END)
  if (start > end) {
    const swap = start
    start = end
    end = swap
  }
  return { start, end }
}

export function presetLabel(preset: DatePreset): string {
  if (preset === '7d') return '最近7天'
  if (preset === '14d') return '最近14天'
  return '自定义日期'
}

export function formatStamp(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`
}

export function formatAxisDay(isoDate: string): string {
  return `${isoDate.slice(5, 7)}-${isoDate.slice(8, 10)}`
}

export function formatChineseDay(isoDate: string): string {
  return `${isoDate.slice(0, 4)}年${Number(isoDate.slice(5, 7))}月${Number(isoDate.slice(8, 10))}日`
}

export function hourOf(iso: string): number {
  return Number(iso.slice(11, 13))
}

export function dayOf(iso: string): string {
  return iso.slice(0, 10)
}

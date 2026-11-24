import type { PitchCandidate, ProgressResult } from '../../shared/aiTypes.ts'
import { currentActor } from './leads.ts'

const DRAFT_KEY = 'clue-tree-drafts-v1'
const PITCH_KEY = 'clue-pitch-cache-v1'

export interface TreeBranch {
  id: string
  parentId: string | null
  kind: 'fact' | 'commentary' | 'note' | 'pitch'
  title: string
  summary: string
  origin: 'ai' | 'editor'
  edited: boolean
  articleIds: string[]
  evidence: { articleId: string; quote: string }[]
  timeLabel: string
  angle: string
  question: string
  reason: string
  gaps: string[]
  outline: string[]
}

export interface AnalysisDraft {
  key: string
  eventId: string
  userId: string
  rootTitle: string
  branches: TreeBranch[]
  materialIds: string[]
  savedAt: string
  deletedIds?: string[]
  previous?: { rootTitle: string; branches: TreeBranch[]; savedAt: string } | null
}

export interface PitchCache {
  key: string
  eventId: string
  pitches: PitchCandidate[]
  savedAt: string
}

let seq = 1

export function branchId() {
  seq += 1
  return `b-${Date.now().toString(36)}-${seq}`
}

export function analysisKey(eventId: string, start: string, end: string, mode: string) {
  return `${currentActor()}:${eventId}:${start}:${end}:${mode}`
}

export function branchesFromAi(progress: ProgressResult | null, pitches: PitchCandidate[] | null): TreeBranch[] {
  const facts = (progress?.nodes ?? []).map((node) => ({
    id: node.nodeId,
    parentId: null,
    kind: node.nodeType === 'commentary' ? 'commentary' as const : node.nodeType === 'unverified' ? 'note' as const : 'fact' as const,
    title: node.title,
    summary: node.summary,
    origin: 'ai' as const,
    edited: false,
    articleIds: node.articleIds,
    evidence: node.evidence,
    timeLabel: `${node.timeBasis === 'event' ? '事件时间' : '报道时间'} ${node.timeStart.slice(0, 16).replace('T', ' ')}`,
    angle: '',
    question: '',
    reason: '',
    gaps: [],
    outline: [],
  }))
  const ideas = (pitches ?? []).map((item) => ({
    id: item.id,
    parentId: 'pitch-root',
    kind: 'pitch' as const,
    title: item.title,
    summary: item.reason,
    origin: 'ai' as const,
    edited: false,
    articleIds: item.articleIds,
    evidence: [],
    timeLabel: '选题建议',
    angle: item.angle,
    question: item.question,
    reason: item.reason,
    gaps: item.gaps,
    outline: item.outline,
  }))
  return [...facts, ...ideas]
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function loadDraft(key: string): AnalysisDraft | null {
  return read<AnalysisDraft[]>(DRAFT_KEY, []).find((item) => item.key === key) ?? null
}

export function draftsForEvent(eventId: string): AnalysisDraft[] {
  return read<AnalysisDraft[]>(DRAFT_KEY, []).filter((item) => item.eventId === eventId)
}

export function saveDraft(draft: AnalysisDraft): { ok: true } | { ok: false; error: string } {
  try {
    const rows = read<AnalysisDraft[]>(DRAFT_KEY, []).filter((item) => item.key !== draft.key)
    rows.unshift(draft)
    localStorage.setItem(DRAFT_KEY, JSON.stringify(rows.slice(0, 40)))
    const back = read<AnalysisDraft[]>(DRAFT_KEY, []).find((item) => item.key === draft.key)
    if (!back || back.savedAt !== draft.savedAt) return { ok: false, error: '保存失败，修改还在页面上' }
    return { ok: true }
  } catch {
    return { ok: false, error: '保存失败，修改还在页面上' }
  }
}

export function loadPitchCache(key: string): PitchCache | null {
  return read<PitchCache[]>(PITCH_KEY, []).find((item) => item.key === key) ?? null
}

export function savePitchCache(record: PitchCache) {
  const rows = read<PitchCache[]>(PITCH_KEY, []).filter((item) => item.key !== record.key)
  rows.unshift(record)
  localStorage.setItem(PITCH_KEY, JSON.stringify(rows.slice(0, 40)))
}

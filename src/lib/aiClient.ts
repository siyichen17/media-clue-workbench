import { EXPLAIN_PROMPT_VERSION, HOT_PROMPT_VERSION, NARRATIVE_PROMPT_VERSION, PITCH_PROMPT_VERSION, PROMPT_VERSION, type AiMaterialInput, type CompareResult, type ExplainResult, type ExtractItem, type NarrativeResult, type PitchResult, type ProgressResult, type SectionKey } from '../../shared/aiTypes.ts'
import type { ReportSections, ReportStats } from '../types/report.ts'

export class AiRequestError extends Error {
  configured: boolean

  constructor(message: string, configured = true) {
    super(message)
    this.configured = configured
  }
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new AiRequestError('网络请求失败，没有生成结果')
  }
  const payload = (await response.json().catch(() => null)) as { error?: string; configured?: boolean } | null
  if (!response.ok) {
    const message = payload?.error || '报告生成失败'
    throw new AiRequestError(message, payload?.configured !== false && response.status !== 503)
  }
  return payload as T
}

export async function fetchAiStatus(): Promise<{ configured: boolean; model: string | null }> {
  try {
    const response = await fetch('/api/ai/status')
    if (!response.ok) return { configured: false, model: null }
    const payload = (await response.json()) as { configured?: boolean; model?: string | null }
    return { configured: payload.configured === true, model: payload.model ?? null }
  } catch {
    return { configured: false, model: null }
  }
}

export async function requestExtract(materials: AiMaterialInput[]): Promise<ExtractItem[]> {
  const payload = await postJson<{ items: ExtractItem[] }>('/api/ai/extract', { promptVersion: PROMPT_VERSION, materials })
  return payload.items
}

export async function requestCompare(input: {
  kind: 'date' | 'event'
  stats: ReportStats
  materials: AiMaterialInput[]
  extracts: ExtractItem[]
  mediaIds: string[]
  eventName: string | null
}): Promise<{ result: CompareResult; model: string | null }> {
  return postJson('/api/ai/compare', { promptVersion: PROMPT_VERSION, ...input })
}

export async function requestProgress(materials: AiMaterialInput[], signal?: AbortSignal): Promise<ProgressResult> {
  const payload = await postJson<{ result: ProgressResult }>('/api/ai/progress', { promptVersion: HOT_PROMPT_VERSION, materials }, signal)
  return payload.result
}

export async function requestPitches(materials: AiMaterialInput[], notes = '', signal?: AbortSignal): Promise<PitchResult> {
  const payload = await postJson<{ result: PitchResult }>('/api/ai/pitches', { promptVersion: PITCH_PROMPT_VERSION, materials, notes }, signal)
  return payload.result
}

export async function requestExplain(input: {
  mode: 'change' | 'composition'
  stats: unknown
  materials: AiMaterialInput[]
  eventIds: string[]
}, signal?: AbortSignal): Promise<ExplainResult> {
  const payload = await postJson<{ result: ExplainResult }>('/api/ai/explain', { promptVersion: EXPLAIN_PROMPT_VERSION, ...input }, signal)
  return payload.result
}

export async function requestNarrative(input: {
  kind: 'daily' | 'weekly' | 'topic' | 'media' | 'theme' | 'work'
  chapterIds: string[]
  stats: ReportStats
  materials: AiMaterialInput[]
  extracts: ExtractItem[]
  workRecords: { title: string; status: string; owner: string; notes: string }[]
  referenceNote: string
}): Promise<{ result: NarrativeResult; model: string | null }> {
  return postJson('/api/ai/narrative', { promptVersion: NARRATIVE_PROMPT_VERSION, ...input })
}

export async function requestSection(input: {
  section: SectionKey
  instruction: string
  kind: 'date' | 'event'
  stats: ReportStats
  materials: AiMaterialInput[]
  extracts: ExtractItem[]
  mediaIds: string[]
  sections: ReportSections
}): Promise<Partial<CompareResult>> {
  const payload = await postJson<{ result: Partial<CompareResult> }>('/api/ai/section', { promptVersion: PROMPT_VERSION, ...input })
  return payload.result
}

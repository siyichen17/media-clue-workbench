import { NARRATIVE_PROMPT_VERSION, PROMPT_VERSION, type AiMaterialInput, type ExtractItem } from '../../shared/aiTypes.ts'
import type { MaterialSnapshot, NarrativeChapter, ReportDocument, ReportScope, ReportSections, ReportStats } from '../types/report.ts'
import { requestCompare, requestExtract, requestNarrative } from './aiClient.ts'
import { LOCAL_ACCOUNT } from './reportMeta.ts'
import { loadCachedExtract, saveCachedExtract, saveReport } from './reportStore.ts'
import { sectionsFromCompare } from '../types/report.ts'

const EMPTY_SECTIONS: ReportSections = {
  comparisonDimensions: [],
  keyDifferences: [],
  summary: { text: '', articleIds: [] },
  nextActions: [],
  limitations: [],
}

export type GenerateStage = '准备材料' | '提取要点' | '分析内容' | '汇总分析' | '生成对比' | '生成正文' | '组织报告' | '生成报告' | '校验结果' | '校验引用'

export class IncompleteMaterialsError extends Error {
  done: number
  total: number
  failedIds: string[]

  constructor(done: number, total: number, failedIds: string[]) {
    super(`已处理 ${done}/${total} 篇。还有 ${failedIds.length} 篇没有完成，不能把这次结果当成全部完成。`)
    this.done = done
    this.total = total
    this.failedIds = failedIds
  }
}

const BATCH_ARTICLES = 4
const BATCH_CHARS = 8000
const SEGMENT_CHARS = 3500
const FINAL_FACT_LIMIT = 4

function clip(value: string, max: number) {
  return value.length <= max ? value : value.slice(0, max)
}

function packBatches(materials: MaterialSnapshot[]): MaterialSnapshot[][] {
  const ordered = [...materials].sort((a, b) => a.eventId.localeCompare(b.eventId) || a.publishedAt.localeCompare(b.publishedAt))
  const batches: MaterialSnapshot[][] = []
  let current: MaterialSnapshot[] = []
  let chars = 0
  for (const item of ordered) {
    const size = item.title.length + item.summary.length + Math.min(item.body.length, SEGMENT_CHARS)
    const sameEvent = current.length === 0 || current[current.length - 1]?.eventId === item.eventId
    if (current.length > 0 && (!sameEvent || current.length >= BATCH_ARTICLES || chars + size > BATCH_CHARS)) {
      batches.push(current)
      current = []
      chars = 0
    }
    current.push(item)
    chars += size
  }
  if (current.length) batches.push(current)
  return batches
}

function segmentsOf(item: MaterialSnapshot): MaterialSnapshot[] {
  if (item.body.length <= SEGMENT_CHARS) return [item]
  const parts: MaterialSnapshot[] = []
  for (let start = 0; start < item.body.length; start += SEGMENT_CHARS) {
    parts.push({ ...item, body: item.body.slice(start, start + SEGMENT_CHARS) })
  }
  return parts
}

function mergeExtracts(parts: ExtractItem[]): ExtractItem {
  const [first, ...rest] = parts
  if (!first) throw new Error('没有可合并的要点')
  const seen = new Set<string>()
  const take = <T extends { quote: string }>(rows: T[]) => rows.filter((row) => {
    const key = row.quote.trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  const facts = take(parts.flatMap((item) => item.facts))
  seen.clear()
  const attributed = take(parts.flatMap((item) => item.attributed))
  seen.clear()
  const developments = take(parts.flatMap((item) => item.developments))
  return {
    ...first,
    facts,
    attributed,
    developments,
    topic: first.topic || rest.find((item) => item.topic)?.topic || '',
    angle: first.angle || rest.find((item) => item.angle)?.angle || '',
  }
}

export function compactExtracts(items: ExtractItem[]): ExtractItem[] {
  return items.map((item) => ({
    ...item,
    topic: clip(item.topic, 80),
    angle: clip(item.angle, 80),
    facts: item.facts.slice(0, FINAL_FACT_LIMIT),
    attributed: item.attributed.slice(0, 2),
    developments: item.developments.slice(0, 2),
  }))
}

async function extractOne(item: MaterialSnapshot): Promise<ExtractItem> {
  const cached = await loadCachedExtract(cacheKey(item))
  if (cached) return cached
  const parts: ExtractItem[] = []
  for (const segment of segmentsOf(item)) {
    const items = await requestExtract([toAiMaterial(segment)])
    const found = items.find((row) => row.articleId === item.articleId)
    if (!found) throw new Error(`没有得到 ${item.articleId} 的要点`)
    parts.push(found)
  }
  const merged = mergeExtracts(parts)
  await saveCachedExtract(cacheKey(item), merged)
  return merged
}

export async function collectExtracts(
  materials: MaterialSnapshot[],
  onStage: (stage: string) => void,
): Promise<{ extracts: ExtractItem[]; failedIds: string[] }> {
  onStage('准备材料')
  const extracts: ExtractItem[] = []
  const failedIds: string[] = []
  const batches = packBatches(materials)
  let done = 0
  for (const batch of batches) {
    const pending: MaterialSnapshot[] = []
    for (const item of batch) {
      const cached = await loadCachedExtract(cacheKey(item))
      if (cached) {
        extracts.push(cached)
        done += 1
        onStage(`已处理 ${done}/${materials.length} 篇`)
      } else pending.push(item)
    }
    if (!pending.length) continue
    try {
      if (pending.every((item) => item.body.length <= SEGMENT_CHARS) && pending.length > 1) {
        const items = await requestExtract(pending.map(toAiMaterial))
        for (const item of pending) {
          const found = items.find((row) => row.articleId === item.articleId)
          if (!found) throw new Error(`没有得到 ${item.articleId} 的要点`)
          await saveCachedExtract(cacheKey(item), found)
          extracts.push(found)
          done += 1
          onStage(`已处理 ${done}/${materials.length} 篇`)
        }
      } else {
        for (const item of pending) {
          extracts.push(await extractOne(item))
          done += 1
          onStage(`已处理 ${done}/${materials.length} 篇`)
        }
      }
    } catch {
      for (const item of pending) {
        if (extracts.some((row) => row.articleId === item.articleId)) continue
        const cached = await loadCachedExtract(cacheKey(item))
        if (cached) {
          extracts.push(cached)
          done += 1
        } else failedIds.push(item.articleId)
      }
      onStage(`已处理 ${done}/${materials.length} 篇`)
    }
  }
  return { extracts, failedIds }
}

function contentHash(text: string): string {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

export function toAiMaterial(item: MaterialSnapshot): AiMaterialInput {
  return {
    articleId: item.articleId,
    eventId: item.eventId,
    mediaId: item.mediaId,
    mediaName: item.mediaName,
    publishedAt: item.publishedAt,
    completeness: item.completeness,
    nature: item.nature,
    title: item.title,
    summary: item.summary,
    body: item.body,
  }
}

export function cacheKey(item: MaterialSnapshot): string {
  return `${PROMPT_VERSION}:${item.articleId}:${contentHash(`${item.title}\n${item.summary}\n${item.body}`)}`
}

export async function generateReportDocument(input: {
  title: string
  scope: ReportScope
  stats: ReportStats
  materials: MaterialSnapshot[]
  onStage: (stage: string) => void
  allowPartial?: boolean
}): Promise<ReportDocument> {
  if (input.scope.kind !== 'date' && input.scope.kind !== 'event') throw new Error('这个流程只生成对比报告')
  const { extracts, failedIds } = await collectExtracts(input.materials, input.onStage)
  const ready = input.materials.filter((item) => extracts.some((row) => row.articleId === item.articleId))
  if (failedIds.length && !input.allowPartial) throw new IncompleteMaterialsError(ready.length, input.materials.length, failedIds)
  if (!ready.length) throw new Error('没有完成任何材料，没有生成报告')
  const ordered = ready.map((item) => extracts.find((row) => row.articleId === item.articleId)) as ExtractItem[]
  const note = failedIds.length
    ? `选中 ${input.materials.length} 篇，实际成功分析 ${ready.length} 篇，未完成 ${failedIds.length} 篇。这不是全部完成。`
    : input.scope.samplingNote
  input.onStage('汇总分析')
  input.onStage('生成报告')
  const compared = await requestCompare({
    kind: input.scope.kind,
    stats: input.stats,
    materials: ready.map((item) => ({ ...toAiMaterial(item), body: '', summary: clip(item.summary, 240) })),
    extracts: compactExtracts(ordered),
    mediaIds: input.scope.mediaIds,
    eventName: input.scope.eventName,
  })
  input.onStage('校验引用')
  const sections = sectionsFromCompare(compared.result)
  const now = new Date().toISOString()
  const report: ReportDocument = {
    id: `rpt-${Date.now().toString(36)}`,
    type: input.scope.kind,
    title: input.title,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    promptVersion: PROMPT_VERSION,
    model: compared.model,
    scope: { ...input.scope, samplingNote: note ?? null },
    stats: input.stats,
    materials: input.materials,
    extraction: ordered as ExtractItem[],
    aiOriginal: structuredClone(sections),
    sections,
    history: {},
    notes: '',
    groupId: '',
    createdBy: LOCAL_ACCOUNT,
    leadIds: [],
    archived: false,
    finalizedAt: null,
  }
  report.groupId = report.id
  report.versionId = report.id
  report.editedAt = now
  await saveReport(report)
  return report
}

export async function generateNarrativeDocument(input: {
  title: string
  scope: ReportScope
  stats: ReportStats
  materials: MaterialSnapshot[]
  chapterIds: string[]
  workRecords: { title: string; status: string; owner: string; notes: string }[]
  referenceNote: string
  leadIds: string[]
  onStage: (stage: string) => void
  allowPartial?: boolean
}): Promise<ReportDocument> {
  const narrativeKinds = ['daily', 'weekly', 'topic', 'media', 'theme', 'work']
  if (!narrativeKinds.includes(input.scope.kind)) {
    throw new Error('这个流程只生成叙述类报告')
  }
  const { extracts, failedIds } = await collectExtracts(input.materials, input.onStage)
  const ready = input.materials.filter((item) => extracts.some((row) => row.articleId === item.articleId))
  if (failedIds.length && !input.allowPartial) throw new IncompleteMaterialsError(ready.length, input.materials.length, failedIds)
  if (!ready.length && input.materials.length) throw new Error('没有完成任何材料，没有生成报告')
  const ordered = ready.map((item) => extracts.find((row) => row.articleId === item.articleId)) as ExtractItem[]
  const partialNote = failedIds.length
    ? `选中 ${input.materials.length} 篇，实际成功分析 ${ready.length} 篇，未完成 ${failedIds.length} 篇。这不是全部完成。`
    : ''
  input.onStage('汇总分析')
  input.onStage('生成报告')
  const narrative = await requestNarrative({
    kind: input.scope.kind as 'daily' | 'weekly' | 'topic' | 'media' | 'theme' | 'work',
    chapterIds: input.chapterIds,
    stats: input.stats,
    materials: ready.map((item) => ({ ...toAiMaterial(item), body: '', summary: clip(item.summary, 240) })),
    extracts: compactExtracts(ordered),
    workRecords: input.workRecords,
    referenceNote: [input.referenceNote, partialNote].filter(Boolean).join(' '),
  })
  input.onStage('校验引用')
  const chapters = narrative.result.chapters as NarrativeChapter[]
  const now = new Date().toISOString()
  const id = `rpt-${Date.now().toString(36)}`
  const report: ReportDocument = {
    id,
    type: input.scope.kind,
    title: input.title,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    editedAt: now,
    promptVersion: NARRATIVE_PROMPT_VERSION,
    model: narrative.model,
    scope: { ...input.scope, samplingNote: [input.scope.samplingNote, partialNote].filter(Boolean).join(' ') || null },
    stats: input.stats,
    materials: input.materials,
    extraction: ordered as ExtractItem[],
    aiOriginal: structuredClone(EMPTY_SECTIONS),
    sections: structuredClone(EMPTY_SECTIONS),
    history: {},
    notes: '',
    narrative: chapters,
    groupId: id,
    versionId: id,
    parentVersionId: null,
    copiedFrom: null,
    finalizedAt: null,
    archived: false,
    createdBy: LOCAL_ACCOUNT,
    leadIds: input.leadIds,
  }
  await saveReport(report)
  return report
}

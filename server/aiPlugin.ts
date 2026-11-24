import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import type { AiMaterialInput, SectionKey } from '../shared/aiTypes.ts'
import { validateCompare, validateExplain, validateExtract, validateNarrative, validatePitches, validateProgress, validateSectionPiece } from '../shared/aiValidate.ts'
import { chatJson, readModelEnv, type ModelEnv } from './llm.ts'
import { COMPARE_SYSTEM, EXPLAIN_SYSTEM, EXTRACT_SYSTEM, NARRATIVE_SYSTEM, PITCH_SYSTEM, PROGRESS_SYSTEM, SECTION_SYSTEM } from './prompts.ts'

const NOT_CONFIGURED = 'AI服务未配置'

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 1_500_000) throw new Error('请求过大')
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

function materialsOf(value: unknown): AiMaterialInput[] | null {
  if (!value || typeof value !== 'object') return null
  const materials = (value as { materials?: unknown }).materials
  if (!Array.isArray(materials) || materials.length < 1 || materials.length > 8) return null
  return materials as AiMaterialInput[]
}

async function runChecked<T>(
  env: ModelEnv,
  system: string,
  user: string,
  validate: (payload: unknown) => { ok: boolean; value?: T; errors: string[] },
): Promise<T> {
  const first = await chatJson(env, system, user, null)
  const checked = validate(first)
  if (checked.ok && checked.value) return checked.value
  const second = await chatJson(env, system, user, checked.errors)
  const again = validate(second)
  if (!again.ok || !again.value) throw new Error(`结果未通过校验：${again.errors.join('；')}`)
  return again.value
}

async function handle(req: IncomingMessage, res: ServerResponse, env: ModelEnv) {
  const url = req.url?.split('?')[0] ?? ''
  if (req.method === 'GET' && url === '/api/ai/status') {
    send(res, 200, { configured: env.configured, model: env.configured ? env.model : null })
    return
  }
  if (req.method !== 'POST') {
    send(res, 404, { error: '没有这个接口' })
    return
  }
  if (!env.configured) {
    send(res, 503, { configured: false, error: NOT_CONFIGURED })
    return
  }
  try {
    const body = await readBody(req)
    if (url === '/api/ai/extract') {
      const materials = materialsOf(body)
      if (!materials) {
        send(res, 400, { error: '材料数量无效' })
        return
      }
      const items = await runChecked(env, EXTRACT_SYSTEM, JSON.stringify({ materials }), (payload) => validateExtract(payload, materials))
      send(res, 200, { items })
      return
    }
    if (url === '/api/ai/compare' || url === '/api/ai/section') {
      const record = body as {
        kind?: 'date' | 'event'
        stats?: unknown
        materials?: AiMaterialInput[]
        extracts?: unknown
        mediaIds?: string[]
        eventName?: string | null
        section?: SectionKey
        instruction?: string
        sections?: unknown
      }
      const materials = record.materials ?? []
      const mediaIds = new Set(record.mediaIds ?? [])
      const articleIds = new Set(materials.map((item) => item.articleId))
      if (materials.length < 2 || mediaIds.size < 2) {
        send(res, 400, { error: '至少需要两家媒体的材料' })
        return
      }
      const user = JSON.stringify({
        reportKind: record.kind,
        eventName: record.eventName ?? null,
        mediaIds: [...mediaIds],
        stats: record.stats,
        materials: materials.map((item) => ({
          articleId: item.articleId,
          mediaId: item.mediaId,
          eventId: item.eventId,
          publishedAt: item.publishedAt,
          completeness: item.completeness,
          nature: item.nature,
          title: item.title,
        })),
        extracts: record.extracts,
        section: record.section ?? null,
        instruction: record.instruction ?? '',
        currentSections: record.sections ?? null,
      })
      if (url === '/api/ai/section') {
        const section = record.section
        if (section !== 'comparison' && section !== 'differences' && section !== 'summary' && section !== 'actions') {
          send(res, 400, { error: '章节无效' })
          return
        }
        const piece = await runChecked(env, SECTION_SYSTEM, user, (payload) => validateSectionPiece(section, payload, articleIds, mediaIds))
        send(res, 200, { result: piece })
        return
      }
      const result = await runChecked(env, COMPARE_SYSTEM, user, (payload) => validateCompare(payload, articleIds, mediaIds))
      send(res, 200, { result, model: env.model })
      return
    }
    if (url === '/api/ai/narrative') {
      const record = body as {
        kind?: string
        chapterIds?: string[]
        stats?: unknown
        materials?: AiMaterialInput[]
        extracts?: unknown
        workRecords?: unknown
        referenceNote?: string
      }
      const materials = record.materials ?? []
      const chapterIds = (record.chapterIds ?? []).filter((id) => typeof id === 'string')
      const workCount = Array.isArray(record.workRecords) ? record.workRecords.length : 0
      const workOnly = record.kind === 'work' && workCount > 0 && materials.length === 0
      if ((!workOnly && materials.length < 1) || chapterIds.length < 1) {
        send(res, 400, { error: '材料或章节无效。' })
        return
      }
      const packed = JSON.stringify({ extracts: record.extracts, stats: record.stats })
      if (packed.length > 500_000) {
        send(res, 400, { error: '汇总内容超过单次上下文。请按事件或时间分段生成。未进入本段的材料不会算作已分析。' })
        return
      }
      const articleIds = new Set(materials.map((item) => item.articleId))
      const result = await runChecked(
        env,
        NARRATIVE_SYSTEM,
        JSON.stringify({
          reportKind: record.kind,
          chapterIds,
          stats: record.stats,
          workRecords: record.workRecords ?? [],
          referenceNote: record.referenceNote ?? '',
          materials: materials.map((item) => ({
            articleId: item.articleId,
            eventId: item.eventId,
            mediaName: item.mediaName,
            publishedAt: item.publishedAt,
            completeness: item.completeness,
            nature: item.nature,
            title: item.title,
          })),
          extracts: record.extracts,
        }),
        (payload) => validateNarrative(payload, articleIds, chapterIds),
      )
      send(res, 200, { result, model: env.model })
      return
    }
    if (url === '/api/ai/progress') {
      const materials = (body as { materials?: AiMaterialInput[] }).materials ?? []
      if (materials.length < 1 || materials.length > 48) {
        send(res, 400, { error: '进展材料数量无效' })
        return
      }
      const result = await runChecked(
        env,
        PROGRESS_SYSTEM,
        JSON.stringify({ materials, analyzedCount: materials.length }),
        (payload) => validateProgress(payload, materials, materials.length),
      )
      send(res, 200, { result, model: env.model })
      return
    }
    if (url === '/api/ai/pitches') {
      const record = body as { materials?: AiMaterialInput[]; notes?: string }
      const materials = record.materials ?? []
      if (materials.length < 1 || materials.length > 48) {
        send(res, 400, { error: '拟题材料数量无效' })
        return
      }
      const result = await runChecked(
        env,
        PITCH_SYSTEM,
        JSON.stringify({ materials, editorNotes: record.notes || '' }),
        (payload) => validatePitches(payload, materials),
      )
      send(res, 200, { result, model: env.model })
      return
    }
    if (url === '/api/ai/explain') {
      const record = body as {
        mode?: 'change' | 'composition'
        stats?: unknown
        materials?: AiMaterialInput[]
        eventIds?: string[]
      }
      const materials = record.materials ?? []
      const mode = record.mode === 'composition' ? 'composition' : 'change'
      const eventIds = new Set(record.eventIds ?? [])
      const articleIds = new Set(materials.map((item) => item.articleId))
      const statsRecord = record.stats && typeof record.stats === 'object' ? record.stats as { events?: { eventId?: string; name?: string }[] } : null
      const eventNames = new Map<string, string>()
      for (const item of statsRecord?.events ?? []) {
        if (item.eventId && item.eventId !== 'pending' && item.name && eventIds.has(item.eventId)) eventNames.set(item.name, item.eventId)
      }
      if (!eventIds.size) {
        send(res, 400, { error: '没有可解释的事件' })
        return
      }
      const result = await runChecked(
        env,
        EXPLAIN_SYSTEM,
        JSON.stringify({ mode, stats: record.stats, materials, eventIds: [...eventIds] }),
        (payload) => validateExplain(payload, eventIds, articleIds, mode, eventNames),
      )
      send(res, 200, { result, model: env.model })
      return
    }
    send(res, 404, { error: '没有这个接口' })
  } catch (error) {
    const message = error instanceof Error ? error.message : '报告生成失败'
    send(res, 502, { configured: true, error: message })
  }
}

export function aiApiPlugin(): Plugin {
  const attach = (middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void }, mode: string) => {
    const env = readModelEnv(loadEnv(mode, process.cwd(), ''))
    middlewares.use((req, res, next) => {
      const url = req.url?.split('?')[0] ?? ''
      if (!url.startsWith('/api/ai')) {
        next()
        return
      }
      void handle(req, res, env).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '报告生成失败'
        send(res, 500, { error: message })
      })
    })
  }
  return {
    name: 'ai-report-api',
    configureServer(server) {
      attach(server.middlewares, server.config.mode)
    },
    configurePreviewServer(server) {
      attach(server.middlewares, server.config.mode)
    },
  }
}

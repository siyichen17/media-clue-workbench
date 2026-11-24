import { loadEnv } from 'vite';
import { validateCompare, validateExplain, validateExtract, validateProgress, validateSectionPiece } from '../shared/aiValidate.ts';
import { chatJson, readModelEnv } from './llm.ts';
import { COMPARE_SYSTEM, EXPLAIN_SYSTEM, EXTRACT_SYSTEM, PROGRESS_SYSTEM, SECTION_SYSTEM } from './prompts.ts';
const NOT_CONFIGURED = 'AI服务未配置';
function send(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
}
async function readBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > 1_500_000)
            throw new Error('请求过大');
        chunks.push(buffer);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return text ? JSON.parse(text) : {};
}
function materialsOf(value) {
    if (!value || typeof value !== 'object')
        return null;
    const materials = value.materials;
    if (!Array.isArray(materials) || materials.length < 1 || materials.length > 8)
        return null;
    return materials;
}
async function runChecked(env, system, user, validate) {
    const first = await chatJson(env, system, user, null);
    const checked = validate(first);
    if (checked.ok && checked.value)
        return checked.value;
    const second = await chatJson(env, system, user, checked.errors);
    const again = validate(second);
    if (!again.ok || !again.value)
        throw new Error(`结果未通过校验：${again.errors.join('；')}`);
    return again.value;
}
async function handle(req, res, env) {
    const url = req.url?.split('?')[0] ?? '';
    if (req.method === 'GET' && url === '/api/ai/status') {
        send(res, 200, { configured: env.configured, model: env.configured ? env.model : null });
        return;
    }
    if (req.method !== 'POST') {
        send(res, 404, { error: '没有这个接口' });
        return;
    }
    if (!env.configured) {
        send(res, 503, { configured: false, error: NOT_CONFIGURED });
        return;
    }
    try {
        const body = await readBody(req);
        if (url === '/api/ai/extract') {
            const materials = materialsOf(body);
            if (!materials) {
                send(res, 400, { error: '材料数量无效' });
                return;
            }
            const items = await runChecked(env, EXTRACT_SYSTEM, JSON.stringify({ materials }), (payload) => validateExtract(payload, materials));
            send(res, 200, { items });
            return;
        }
        if (url === '/api/ai/compare' || url === '/api/ai/section') {
            const record = body;
            const materials = record.materials ?? [];
            const mediaIds = new Set(record.mediaIds ?? []);
            const articleIds = new Set(materials.map((item) => item.articleId));
            if (materials.length < 2 || mediaIds.size < 2) {
                send(res, 400, { error: '至少需要两家媒体的材料' });
                return;
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
            });
            if (url === '/api/ai/section') {
                const section = record.section;
                if (section !== 'comparison' && section !== 'differences' && section !== 'summary' && section !== 'actions') {
                    send(res, 400, { error: '章节无效' });
                    return;
                }
                const piece = await runChecked(env, SECTION_SYSTEM, user, (payload) => validateSectionPiece(section, payload, articleIds, mediaIds));
                send(res, 200, { result: piece });
                return;
            }
            const result = await runChecked(env, COMPARE_SYSTEM, user, (payload) => validateCompare(payload, articleIds, mediaIds));
            send(res, 200, { result, model: env.model });
            return;
        }
        if (url === '/api/ai/progress') {
            const materials = body.materials ?? [];
            if (materials.length < 1 || materials.length > 48) {
                send(res, 400, { error: '进展材料数量无效' });
                return;
            }
            const result = await runChecked(env, PROGRESS_SYSTEM, JSON.stringify({ materials, analyzedCount: materials.length }), (payload) => validateProgress(payload, materials, materials.length));
            send(res, 200, { result, model: env.model });
            return;
        }
        if (url === '/api/ai/explain') {
            const record = body;
            const materials = record.materials ?? [];
            const mode = record.mode === 'composition' ? 'composition' : 'change';
            const eventIds = new Set(record.eventIds ?? []);
            const articleIds = new Set(materials.map((item) => item.articleId));
            const statsRecord = record.stats && typeof record.stats === 'object' ? record.stats : null;
            const eventNames = new Map();
            for (const item of statsRecord?.events ?? []) {
                if (item.eventId && item.eventId !== 'pending' && item.name && eventIds.has(item.eventId))
                    eventNames.set(item.name, item.eventId);
            }
            if (!eventIds.size) {
                send(res, 400, { error: '没有可解释的事件' });
                return;
            }
            const result = await runChecked(env, EXPLAIN_SYSTEM, JSON.stringify({ mode, stats: record.stats, materials, eventIds: [...eventIds] }), (payload) => validateExplain(payload, eventIds, articleIds, mode, eventNames));
            send(res, 200, { result, model: env.model });
            return;
        }
        send(res, 404, { error: '没有这个接口' });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : '报告生成失败';
        send(res, 502, { configured: true, error: message });
    }
}
export function aiApiPlugin() {
    const attach = (middlewares, mode) => {
        const env = readModelEnv(loadEnv(mode, process.cwd(), ''));
        middlewares.use((req, res, next) => {
            const url = req.url?.split('?')[0] ?? '';
            if (!url.startsWith('/api/ai')) {
                next();
                return;
            }
            void handle(req, res, env).catch((error) => {
                const message = error instanceof Error ? error.message : '报告生成失败';
                send(res, 500, { error: message });
            });
        });
    };
    return {
        name: 'ai-report-api',
        configureServer(server) {
            attach(server.middlewares, server.config.mode);
        },
        configurePreviewServer(server) {
            attach(server.middlewares, server.config.mode);
        },
    };
}

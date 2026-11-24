import { EXPLAIN_PROMPT_VERSION, HOT_PROMPT_VERSION, PROMPT_VERSION } from '../../shared/aiTypes.ts';
export class AiRequestError extends Error {
    configured;
    constructor(message, configured = true) {
        super(message);
        this.configured = configured;
    }
}
async function postJson(path, body, signal) {
    let response;
    try {
        response = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal,
        });
    }
    catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError')
            throw error;
        throw new AiRequestError('网络请求失败，没有生成结果');
    }
    const payload = (await response.json().catch(() => null));
    if (!response.ok) {
        const message = payload?.error || '报告生成失败';
        throw new AiRequestError(message, payload?.configured !== false && response.status !== 503);
    }
    return payload;
}
export async function fetchAiStatus() {
    try {
        const response = await fetch('/api/ai/status');
        if (!response.ok)
            return { configured: false, model: null };
        const payload = (await response.json());
        return { configured: payload.configured === true, model: payload.model ?? null };
    }
    catch {
        return { configured: false, model: null };
    }
}
export async function requestExtract(materials) {
    const payload = await postJson('/api/ai/extract', { promptVersion: PROMPT_VERSION, materials });
    return payload.items;
}
export async function requestCompare(input) {
    return postJson('/api/ai/compare', { promptVersion: PROMPT_VERSION, ...input });
}
export async function requestProgress(materials, signal) {
    const payload = await postJson('/api/ai/progress', { promptVersion: HOT_PROMPT_VERSION, materials }, signal);
    return payload.result;
}
export async function requestExplain(input, signal) {
    const payload = await postJson('/api/ai/explain', { promptVersion: EXPLAIN_PROMPT_VERSION, ...input }, signal);
    return payload.result;
}
export async function requestSection(input) {
    const payload = await postJson('/api/ai/section', { promptVersion: PROMPT_VERSION, ...input });
    return payload.result;
}

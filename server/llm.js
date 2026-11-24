import { parseModelJson } from '../shared/aiValidate.ts';
export function readModelEnv(fileEnv) {
    const key = (process.env.AI_API_KEY || fileEnv.AI_API_KEY || '').trim();
    const base = (process.env.AI_BASE_URL || fileEnv.AI_BASE_URL || 'https://api.openai.com/v1').trim().replace(/\/$/, '');
    const model = (process.env.AI_MODEL || fileEnv.AI_MODEL || 'gpt-4o-mini').trim();
    return { configured: key.length > 0, key, base, model };
}
export async function chatJson(env, system, user, repair) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    const messages = [
        { role: 'system', content: system },
        {
            role: 'user',
            content: repair
                ? `${user}\n\n上一次输出未通过校验：${repair.join('；')}。请只输出修正后的 JSON。`
                : user,
        },
    ];
    try {
        const response = await fetch(`${env.base}/chat/completions`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${env.key}`,
            },
            body: JSON.stringify({
                model: env.model,
                temperature: 0.2,
                response_format: { type: 'json_object' },
                messages,
            }),
        });
        const raw = await response.text();
        if (!response.ok)
            throw new Error(`模型请求失败（${response.status}）`);
        const payload = parseModelJson(raw);
        const content = payload.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim())
            throw new Error('模型没有返回内容');
        return parseModelJson(content);
    }
    catch (error) {
        if (error instanceof Error && error.name === 'AbortError')
            throw new Error('模型请求超时');
        throw error;
    }
    finally {
        clearTimeout(timer);
    }
}

import { PROMPT_VERSION } from '../../shared/aiTypes.ts';
import { requestCompare, requestExtract } from './aiClient.ts';
import { loadCachedExtract, saveCachedExtract, saveReport } from './reportStore.ts';
import { sectionsFromCompare } from '../types/report.ts';
function contentHash(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
}
export function toAiMaterial(item) {
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
    };
}
export function cacheKey(item) {
    return `${PROMPT_VERSION}:${item.articleId}:${contentHash(`${item.title}\n${item.summary}\n${item.body}`)}`;
}
export async function generateReportDocument(input) {
    input.onStage('准备材料');
    const extracts = [];
    const missing = [];
    for (const material of input.materials) {
        const cached = await loadCachedExtract(cacheKey(material));
        if (cached)
            extracts.push(cached);
        else
            missing.push(material);
    }
    input.onStage('提取要点');
    for (let index = 0; index < missing.length; index += 4) {
        const batch = missing.slice(index, index + 4);
        const items = await requestExtract(batch.map(toAiMaterial));
        for (const item of items) {
            const source = batch.find((material) => material.articleId === item.articleId);
            if (source)
                await saveCachedExtract(cacheKey(source), item);
            extracts.push(item);
        }
    }
    const ordered = input.materials.map((material) => extracts.find((item) => item.articleId === material.articleId));
    if (ordered.some((item) => !item))
        throw new Error('有材料没有得到要点，已停止生成');
    input.onStage('生成对比');
    const compared = await requestCompare({
        kind: input.scope.kind,
        stats: input.stats,
        materials: input.materials.map(toAiMaterial),
        extracts: ordered,
        mediaIds: input.scope.mediaIds,
        eventName: input.scope.eventName,
    });
    input.onStage('校验结果');
    const sections = sectionsFromCompare(compared.result);
    const now = new Date().toISOString();
    const report = {
        id: `rpt-${Date.now().toString(36)}`,
        type: input.scope.kind,
        title: input.title,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        promptVersion: PROMPT_VERSION,
        model: compared.model,
        scope: input.scope,
        stats: input.stats,
        materials: input.materials,
        extraction: ordered,
        aiOriginal: structuredClone(sections),
        sections,
        history: {},
        notes: '',
    };
    await saveReport(report);
    return report;
}

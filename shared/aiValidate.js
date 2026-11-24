function asRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    return value;
}
function text(value, min, max) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    if (trimmed.length < min || trimmed.length > max)
        return null;
    return trimmed;
}
function idList(value, allowed) {
    if (!Array.isArray(value) || value.length > 24)
        return null;
    const ids = [];
    for (const item of value) {
        if (typeof item !== 'string' || !allowed.has(item) || ids.includes(item))
            return null;
        ids.push(item);
    }
    return ids;
}
export function materialCorpus(material) {
    return [material.title, material.summary, material.body].filter(Boolean).join('\n');
}
function quoteInCorpus(quote, corpus) {
    const trimmed = quote.trim();
    return trimmed.length >= 2 && corpus.includes(trimmed);
}
function levelOf(value) {
    if (value === 'full' || value === 'summary' || value === 'title')
        return value;
    return null;
}
function speakerOf(value) {
    if (value === 'media' || value === 'quoted' || value === 'author')
        return value;
    return null;
}
export function validateExtract(payload, materials) {
    const errors = [];
    const root = asRecord(payload);
    const rows = root?.items;
    if (!Array.isArray(rows))
        return { ok: false, errors: ['缺少 items 数组'] };
    const byId = new Map(materials.map((item) => [item.articleId, item]));
    if (rows.length !== materials.length)
        errors.push('要点数量与输入材料数量不一致');
    const seen = new Set();
    const items = [];
    rows.forEach((row, index) => {
        const record = asRecord(row);
        if (!record) {
            errors.push(`第 ${index + 1} 条要点不是对象`);
            return;
        }
        const articleId = typeof record.articleId === 'string' ? record.articleId : '';
        const source = byId.get(articleId);
        if (!source) {
            errors.push(`未知报道 ${articleId || index}`);
            return;
        }
        if (seen.has(articleId))
            errors.push(`报道 ${articleId} 重复`);
        seen.add(articleId);
        const completeness = levelOf(record.completeness);
        if (completeness !== source.completeness)
            errors.push(`${articleId} 的材料完整程度与输入不一致`);
        if (record.eventId !== source.eventId)
            errors.push(`${articleId} 的 eventId 与输入不一致`);
        const topic = text(record.topic, 1, 80);
        const angle = text(record.angle, 1, 80);
        if (!topic || !angle)
            errors.push(`${articleId} 缺少主题或角度`);
        const corpus = materialCorpus(source);
        const facts = readQuoted(record.facts, corpus, articleId, errors, source.completeness === 'title');
        const attributed = readAttributed(record.attributed, corpus, articleId, errors);
        const developments = readQuoted(record.developments, corpus, articleId, errors, false);
        if (source.completeness === 'title' && (facts.length > 1 || developments.length > 0 || attributed.length > 0)) {
            errors.push(`${articleId} 仅有标题，不能提取正文事实或采访对象`);
        }
        items.push({
            articleId,
            eventId: source.eventId,
            completeness: source.completeness,
            topic: topic ?? '',
            angle: angle ?? '',
            facts: facts.map((fact) => ({ ...fact, speaker: fact.speaker ?? 'media' })),
            attributed,
            developments: developments.map((item) => ({ text: item.text, quote: item.quote })),
            unrelated: record.unrelated === true,
        });
    });
    for (const material of materials) {
        if (!seen.has(material.articleId))
            errors.push(`缺少报道 ${material.articleId} 的要点`);
    }
    return errors.length ? { ok: false, errors } : { ok: true, value: items, errors: [] };
}
function readQuoted(value, corpus, articleId, errors, titleOnly) {
    if (!Array.isArray(value)) {
        errors.push(`${articleId} 的列表字段无效`);
        return [];
    }
    if (value.length > 6)
        errors.push(`${articleId} 的要点过多`);
    return value.flatMap((item) => {
        const record = asRecord(item);
        const content = text(record?.text, 1, 180);
        const quote = text(record?.quote, 2, 180);
        if (!content || !quote || !quoteInCorpus(quote, corpus)) {
            errors.push(`${articleId} 有摘录不在输入材料中`);
            return [];
        }
        if (titleOnly && quote.trim() !== corpus.trim() && !corpus.includes(quote.trim())) {
            errors.push(`${articleId} 的标题摘录无效`);
        }
        return [{ text: content, quote: quote.trim(), speaker: speakerOf(record?.speaker) }];
    });
}
function readAttributed(value, corpus, articleId, errors) {
    if (!Array.isArray(value)) {
        errors.push(`${articleId} 的引用对象无效`);
        return [];
    }
    return value.flatMap((item) => {
        const record = asRecord(item);
        const who = text(record?.who, 1, 40);
        const content = text(record?.text, 1, 180);
        const quote = text(record?.quote, 2, 180);
        if (!who || !content || !quote || !quoteInCorpus(quote, corpus)) {
            errors.push(`${articleId} 的引用摘录不在输入材料中`);
            return [];
        }
        return [{ who, text: content, quote: quote.trim() }];
    });
}
export function validateCompare(payload, articleIds, mediaIds) {
    const errors = [];
    const root = asRecord(payload);
    if (!root)
        return { ok: false, errors: ['对比结果不是 JSON 对象'] };
    const dimensions = Array.isArray(root.comparisonDimensions) ? root.comparisonDimensions : null;
    const differences = Array.isArray(root.keyDifferences) ? root.keyDifferences : null;
    const actions = Array.isArray(root.nextActions) ? root.nextActions : null;
    const limitations = Array.isArray(root.limitations) ? root.limitations : null;
    if (!dimensions || !differences || !actions || !limitations) {
        return { ok: false, errors: ['缺少对比维度、差异、建议或限制'] };
    }
    if (dimensions.length < 1 || dimensions.length > 6)
        errors.push('核心对比维度数量无效');
    if (differences.length > 4)
        errors.push('主要差异超过 4 项');
    if (actions.length < 1 || actions.length > 2)
        errors.push('下一步建议需要 1 到 2 项');
    const comparisonDimensions = dimensions.flatMap((item) => {
        const record = asRecord(item);
        const dimension = text(record?.dimension, 2, 40);
        const findings = Array.isArray(record?.mediaFindings) ? record.mediaFindings : null;
        if (!dimension || !findings) {
            errors.push('对比维度结构无效');
            return [];
        }
        const mediaFindings = findings.flatMap((finding) => {
            const row = asRecord(finding);
            const mediaId = typeof row?.mediaId === 'string' ? row.mediaId : '';
            const body = text(row?.text, 4, 400);
            const ids = idList(row?.articleIds, articleIds);
            if (!mediaIds.has(mediaId) || !body || !ids) {
                errors.push(`维度「${dimension}」有无效媒体或引用`);
                return [];
            }
            if (!ids.length && !body.includes('所选材料'))
                errors.push(`「${dimension}」的结论缺少报道引用`);
            return [{ mediaId, text: body, articleIds: ids }];
        });
        if (mediaFindings.length !== mediaIds.size)
            errors.push(`「${dimension}」没有为每家媒体给出一列`);
        return [{ dimension, mediaFindings }];
    });
    const keyDifferences = differences.flatMap((item) => {
        const record = asRecord(item);
        const body = text(record?.text, 4, 300);
        const ids = idList(record?.articleIds, articleIds);
        if (!body || !ids || !ids.length) {
            errors.push('主要差异缺少文本或有效引用');
            return [];
        }
        return [{ text: body, articleIds: ids }];
    });
    const summaryRecord = asRecord(root.summary);
    const summaryText = text(summaryRecord?.text, 40, 300);
    const summaryIds = idList(summaryRecord?.articleIds, articleIds);
    if (!summaryText || !summaryIds)
        errors.push('对比总结无效或长度不合适');
    const nextActions = actions.flatMap((item) => {
        const record = asRecord(item);
        const body = text(record?.text, 12, 180);
        const ids = idList(record?.basedOnArticleIds, articleIds);
        if (!body || !ids) {
            errors.push('下一步建议无效');
            return [];
        }
        return [{ text: body, basedOnArticleIds: ids }];
    });
    const limitationText = limitations.flatMap((item) => {
        const body = text(item, 2, 160);
        if (!body) {
            errors.push('材料限制无效');
            return [];
        }
        return [body];
    });
    if (limitationText.length > 6)
        errors.push('材料限制过多');
    if (errors.length || !summaryText || !summaryIds)
        return { ok: false, errors };
    return {
        ok: true,
        errors: [],
        value: {
            comparisonDimensions,
            keyDifferences,
            summary: { text: summaryText, articleIds: summaryIds },
            nextActions,
            limitations: limitationText,
        },
    };
}
export function validateSectionPiece(section, payload, articleIds, mediaIds) {
    const root = asRecord(payload);
    if (!root)
        return { ok: false, errors: ['章节结果不是 JSON 对象'] };
    const shell = {
        comparisonDimensions: [{ dimension: '保持不变', mediaFindings: [...mediaIds].map((mediaId) => ({ mediaId, text: '所选材料未在本次章节中重写。', articleIds: [] })) }],
        keyDifferences: [],
        summary: { text: '本次只重写指定章节。这段文字只用于通过结构校验，不会覆盖已经保存的其他章节内容。', articleIds: [] },
        nextActions: [{ text: '本次只重写指定章节，建议保持其他章节不变。', basedOnArticleIds: [] }],
        limitations: ['只替换指定章节'],
    };
    if (section === 'comparison')
        shell.comparisonDimensions = root.comparisonDimensions;
    if (section === 'differences')
        shell.keyDifferences = root.keyDifferences;
    if (section === 'summary')
        shell.summary = root.summary;
    if (section === 'actions')
        shell.nextActions = root.nextActions;
    const checked = validateCompare(shell, articleIds, mediaIds);
    if (!checked.ok || !checked.value)
        return { ok: false, errors: checked.errors };
    if (section === 'comparison')
        return { ok: true, errors: [], value: { comparisonDimensions: checked.value.comparisonDimensions } };
    if (section === 'differences')
        return { ok: true, errors: [], value: { keyDifferences: checked.value.keyDifferences } };
    if (section === 'summary')
        return { ok: true, errors: [], value: { summary: checked.value.summary } };
    return { ok: true, errors: [], value: { nextActions: checked.value.nextActions } };
}
function extractJsonValue(text) {
    const stack = [];
    let inString = false;
    let escaped = false;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (inString) {
            if (escaped)
                escaped = false;
            else if (char === '\\')
                escaped = true;
            else if (char === '"')
                inString = false;
            continue;
        }
        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === '{' || char === '[')
            stack.push(char === '{' ? '}' : ']');
        else if (char === '}' || char === ']') {
            if (stack.pop() !== char)
                throw new Error('模型返回的 JSON 不完整');
            if (stack.length === 0)
                return text.slice(0, index + 1);
        }
    }
    throw new Error('模型返回的 JSON 不完整');
}
export function parseModelJson(content) {
    const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '');
    const start = trimmed.search(/[{[]/);
    if (start < 0)
        throw new Error('模型没有返回 JSON');
    return JSON.parse(extractJsonValue(trimmed.slice(start)));
}
export function validateProgress(payload, materials, analyzedCount) {
    const errors = [];
    const root = asRecord(payload);
    const rows = root?.nodes;
    if (!Array.isArray(rows) || rows.length < 1)
        return { ok: false, errors: ['缺少进展节点'] };
    const allowed = new Set(materials.map((item) => item.articleId));
    const byId = new Map(materials.map((item) => [item.articleId, item]));
    const nodes = [];
    rows.forEach((row, index) => {
        const record = asRecord(row);
        if (!record) {
            errors.push(`节点 ${index + 1} 不是对象`);
            return;
        }
        const title = text(record.title, 8, 16);
        const summary = text(record.summary, 40, 80);
        const nodeType = record.nodeType === 'fact' || record.nodeType === 'commentary' || record.nodeType === 'unverified' ? record.nodeType : null;
        const timeBasis = record.timeBasis === 'event' || record.timeBasis === 'report' ? record.timeBasis : null;
        const timeStart = text(record.timeStart, 8, 40);
        const timeEnd = text(record.timeEnd, 8, 40);
        const articleIds = idList(record.articleIds, allowed);
        if (!title || !summary || !nodeType || !timeBasis || !timeStart || !timeEnd || !articleIds?.length) {
            errors.push(`节点 ${index + 1} 字段无效`);
            return;
        }
        const evidenceRows = Array.isArray(record.evidence) ? record.evidence : [];
        const evidence = [];
        for (const item of evidenceRows) {
            const evidenceRecord = asRecord(item);
            const articleId = typeof evidenceRecord?.articleId === 'string' ? evidenceRecord.articleId : '';
            const quote = text(evidenceRecord?.quote, 2, 120);
            const source = byId.get(articleId);
            if (!source || !quote || !articleIds.includes(articleId) || !quoteInCorpus(quote, materialCorpus(source))) {
                errors.push(`节点 ${index + 1} 的证据不在材料中`);
                continue;
            }
            evidence.push({ articleId, quote });
        }
        if (!evidence.length)
            errors.push(`节点 ${index + 1} 缺少可核对摘录`);
        nodes.push({
            nodeId: typeof record.nodeId === 'string' && record.nodeId ? record.nodeId : `n${index + 1}`,
            title,
            summary,
            nodeType,
            timeBasis,
            timeStart,
            timeEnd,
            articleIds,
            evidence,
        });
    });
    if (errors.length || !nodes.length)
        return { ok: false, errors: errors.length ? errors : ['没有有效节点'] };
    return { ok: true, errors: [], value: { nodes, analyzedCount } };
}
export function validateExplain(payload, allowedEvents, allowedArticles, expectedMode, eventNames = new Map()) {
    const errors = [];
    const root = asRecord(payload);
    if (!root)
        return { ok: false, errors: ['结果不是对象'] };
    const mode = root.mode === 'change' || root.mode === 'composition' ? root.mode : null;
    if (mode !== expectedMode)
        errors.push('解释模式与系统统计不一致');
    const overview = text(root.overview, 20, 280);
    if (!overview)
        errors.push('概述长度无效');
    const findingsRaw = Array.isArray(root.eventFindings) ? root.eventFindings : null;
    if (!findingsRaw)
        errors.push('缺少事件说明');
    const eventFindings = [];
    findingsRaw?.slice(0, 4).forEach((row, index) => {
        const record = asRecord(row);
        const rawEventId = typeof record?.eventId === 'string' ? record.eventId.trim() : '';
        const eventId = allowedEvents.has(rawEventId) ? rawEventId : eventNames.get(rawEventId) ?? '';
        const finding = text(record?.text, 8, 240);
        const rawIds = Array.isArray(record?.articleIds) ? record.articleIds.filter((id) => typeof id === 'string' && allowedArticles.has(id)) : [];
        const articleIds = [...new Set(rawIds)];
        if (!allowedEvents.has(eventId))
            errors.push(`事件说明 ${index + 1} 的 eventId 不在本次输入中（收到 ${rawEventId || '空值'}）`);
        else if (!finding)
            errors.push(`事件说明 ${index + 1} 的文字长度无效`);
        else if (!articleIds.length)
            errors.push(`事件说明 ${index + 1} 没有有效报道引用`);
        else
            eventFindings.push({ eventId, text: finding, articleIds });
    });
    const limitations = Array.isArray(root.limitations) ? root.limitations.filter((item) => typeof item === 'string' && item.trim().length > 0).slice(0, 4) : [];
    if (errors.length || !overview)
        return { ok: false, errors };
    return { ok: true, errors: [], value: { mode: expectedMode, overview, eventFindings, limitations } };
}

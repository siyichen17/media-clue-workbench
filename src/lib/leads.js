import { HOT_DEMO_BATCH } from '../data/demo/hotBatch.ts';
import { NEWS } from '../data/demo/index.ts';
import { categoryById, topicById } from '../data/demo/catalog.ts';
import { DATA_AS_OF_LABEL } from './dates.ts';
const LEADS_KEY = 'clue-event-follows-v1';
const SEEN_KEY = 'clue-lead-seen-v1';
const ACTOR_KEY = 'clue-demo-actor-v1';
const SEQ_KEY = 'clue-lead-seq-v1';
const CLOCK_KEY = 'clue-lead-clock-v1';
const SEED_KEY = 'clue-leads-seed-v1';
export const DEMO_ACTORS = [
    { id: 'editor-a', name: '编辑A' },
    { id: 'reporter-b', name: '记者B' },
    { id: 'chief-c', name: '栏目负责人C' },
];
const OUTCOME_LABEL = {
    topic: '已形成选题',
    handoff: '已交接',
    pause: '暂不跟进',
    other: '其他',
};
export function outcomeLabel(outcome) {
    return OUTCOME_LABEL[outcome];
}
export function entryLabel(entry) {
    if (entry === 'overview')
        return '线索总览';
    if (entry === 'hot')
        return '热搜追踪';
    if (entry === 'compete')
        return '竞品监控';
    if (entry === 'manual')
        return '手工新建';
    return '早期跟进';
}
export function statusLabel(status) {
    if (status === 'pending')
        return '待处理';
    if (status === 'active')
        return '跟进中';
    return '已归档';
}
export function actorName(id) {
    if (!id)
        return '未分配';
    return DEMO_ACTORS.find((item) => item.id === id)?.name ?? '未分配';
}
export function currentActor() {
    const stored = localStorage.getItem(ACTOR_KEY);
    return DEMO_ACTORS.some((item) => item.id === stored) ? stored : DEMO_ACTORS[0].id;
}
export function setCurrentActor(id) {
    if (DEMO_ACTORS.some((item) => item.id === id))
        localStorage.setItem(ACTOR_KEY, id);
}
function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    }
    catch {
        return fallback;
    }
}
function writeLeads(rows) {
    try {
        localStorage.setItem(LEADS_KEY, JSON.stringify(rows));
    }
    catch {
        throw new Error('保存失败，这次修改没有写入。');
    }
}
function nextId(prefix) {
    const seq = Number(localStorage.getItem(SEQ_KEY) || '0') + 1;
    localStorage.setItem(SEQ_KEY, String(seq));
    return `${prefix}-${seq}`;
}
/** 演示操作时间从数据截止时刻往后排，不使用本机时钟。 */
export function demoNow() {
    const step = Number(localStorage.getItem(CLOCK_KEY) || '0') + 1;
    localStorage.setItem(CLOCK_KEY, String(step));
    const total = 18 * 60 + step;
    const hour = Math.floor(total / 60) % 24;
    const minute = total % 60;
    return `2026-11-10 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
function log(_lead, action, detail, by = currentActor(), at = demoNow()) {
    return { id: nextId('log'), at, by, action, detail };
}
function isLead(value) {
    return Boolean(value && typeof value === 'object' && 'status' in value && 'id' in value && 'articles' in value);
}
function migrateOne(raw) {
    if (isLead(raw))
        return raw;
    const at = raw.updatedAt || DATA_AS_OF_LABEL;
    const ids = [...new Set(raw.materialIds ?? [])];
    const analysisRefs = [];
    if (raw.analysisRef) {
        analysisRefs.push({
            kind: raw.analysisRef.includes('explain') ? 'explain' : 'progress',
            key: raw.analysisRef,
            linkedAt: at,
        });
    }
    return {
        id: `lead-${raw.eventId}`,
        eventId: raw.eventId,
        title: raw.eventName || raw.eventId,
        status: 'pending',
        ownerId: null,
        notes: raw.note ?? '',
        articles: ids.map((articleId) => ({ articleId, addedAt: at, source: 'event' })),
        baselineIds: ids,
        reportRefs: [],
        analysisRefs,
        createdAt: at,
        updatedAt: at,
        lastActionAt: at,
        entryPoints: ['legacy'],
        archiveHistory: [],
        currentOutcome: null,
        logs: [{ id: `log-migrate-${raw.eventId}`, at, by: '系统', action: '迁移', detail: '保留原跟进记录的事件、材料和备注' }],
        mergedInto: null,
        createdBy: 'editor-a',
    };
}
function corpus() {
    return localStorage.getItem('hot-demo-batch-v1') === '1' ? [...NEWS, ...HOT_DEMO_BATCH] : [...NEWS];
}
function seedIfEmpty() {
    if (localStorage.getItem(LEADS_KEY) || localStorage.getItem(SEED_KEY) === '1')
        return;
    const news = corpus();
    const samples = [
        { eventId: 'e01', status: 'pending', ownerId: null, at: '2026-11-10 17:10' },
        { eventId: 'e06', status: 'active', ownerId: 'reporter-b', at: '2026-11-10 16:20' },
        {
            eventId: 'e10',
            status: 'archived',
            ownerId: 'chief-c',
            at: '2026-11-09 11:00',
            outcome: { outcome: 'pause', note: '演示：本轮先不跟进', at: '2026-11-09 11:00', by: 'chief-c' },
        },
    ];
    const rows = samples.map((sample) => {
        const related = news.filter((item) => item.eventId === sample.eventId);
        const ids = related.map((item) => item.id);
        const lead = {
            id: `lead-${sample.eventId}`,
            eventId: sample.eventId,
            title: related[0]?.eventName || sample.eventId,
            status: sample.status,
            ownerId: sample.ownerId,
            notes: sample.status === 'active' ? '演示：已开始核对末班时刻。' : '',
            articles: ids.map((articleId) => ({ articleId, addedAt: sample.at, source: 'event' })),
            baselineIds: ids,
            reportRefs: [],
            analysisRefs: [],
            createdAt: sample.at,
            updatedAt: sample.at,
            lastActionAt: sample.at,
            entryPoints: ['manual'],
            archiveHistory: sample.outcome ? [sample.outcome] : [],
            currentOutcome: sample.outcome ?? null,
            logs: [{ id: `log-seed-${sample.eventId}`, at: sample.at, by: '系统', action: '创建', detail: '首次初始化的模拟跟进' }],
            mergedInto: null,
            createdBy: 'editor-a',
        };
        return lead;
    });
    writeLeads(rows);
    localStorage.setItem(SEED_KEY, '1');
}
let migrated = false;
export function loadLeads() {
    seedIfEmpty();
    const raw = readJson(LEADS_KEY, []);
    const rows = raw.map((item) => migrateOne(item));
    if (!migrated && raw.some((item) => !isLead(item))) {
        writeLeads(rows);
        migrated = true;
    }
    return rows;
}
export function visibleLeads() {
    return loadLeads().filter((item) => !item.mergedInto);
}
function saveAll(rows) {
    writeLeads(rows);
    migrated = true;
    return rows;
}
function patch(id, recipe) {
    const rows = loadLeads();
    const index = rows.findIndex((item) => item.id === id);
    if (index < 0)
        return null;
    rows[index] = recipe(rows[index]);
    saveAll(rows);
    return rows[index];
}
export function findLeadByEvent(eventId) {
    return visibleLeads().find((item) => item.eventId === eventId) ?? null;
}
export function findLead(id) {
    return loadLeads().find((item) => item.id === id) ?? null;
}
function addIds(lead, ids, source, at) {
    const known = new Set(lead.articles.map((item) => item.articleId));
    const fresh = ids.filter((id) => id && !known.has(id));
    if (!fresh.length)
        return { lead, added: [] };
    return {
        lead: { ...lead, articles: [...lead.articles, ...fresh.map((articleId) => ({ articleId, addedAt: at, source }))] },
        added: fresh,
    };
}
export function followEvent(input) {
    const existing = findLeadByEvent(input.eventId);
    if (existing?.status === 'archived')
        return { kind: 'archived', lead: existing };
    const at = demoNow();
    if (!existing) {
        const ids = [...new Set(input.articleIds)];
        const analysisRefs = input.analysisKey
            ? [{ kind: input.analysisKey.includes('explain') ? 'explain' : 'progress', key: input.analysisKey, linkedAt: at }]
            : [];
        const lead = {
            id: `lead-${input.eventId}`,
            eventId: input.eventId,
            title: input.eventName,
            status: 'pending',
            ownerId: null,
            notes: input.note?.trim() ?? '',
            articles: ids.map((articleId) => ({ articleId, addedAt: at, source: 'event' })),
            baselineIds: ids,
            reportRefs: [],
            analysisRefs,
            createdAt: at,
            updatedAt: at,
            lastActionAt: at,
            entryPoints: [input.entry],
            archiveHistory: [],
            currentOutcome: null,
            logs: [log({}, '创建', `从${entryLabel(input.entry)}加入跟进`, currentActor(), at)],
            mergedInto: null,
            createdBy: currentActor(),
        };
        const rows = loadLeads().filter((item) => item.id !== lead.id);
        rows.unshift(lead);
        saveAll(rows);
        return { kind: 'created', lead };
    }
    const merged = addIds(existing, input.articleIds, 'event', at);
    const entries = existing.entryPoints.includes(input.entry) ? existing.entryPoints : [...existing.entryPoints, input.entry];
    const notes = existing.notes || input.note?.trim() || '';
    const analysisRefs = [...existing.analysisRefs];
    if (input.analysisKey && !analysisRefs.some((item) => item.key === input.analysisKey)) {
        analysisRefs.push({ kind: input.analysisKey.includes('explain') ? 'explain' : 'progress', key: input.analysisKey, linkedAt: at });
    }
    const next = {
        ...merged.lead,
        notes,
        entryPoints: entries,
        analysisRefs,
        updatedAt: at,
        lastActionAt: merged.added.length ? at : existing.lastActionAt,
        logs: merged.added.length
            ? [log(existing, '材料', `并入 ${merged.added.length} 篇报道`, currentActor(), at), ...existing.logs].slice(0, 80)
            : existing.logs,
    };
    patch(existing.id, () => next);
    return { kind: 'updated', lead: next };
}
export function createManualLead(input) {
    const title = input.title.trim();
    if (!title)
        throw new Error('请填写线索标题');
    if (input.eventId) {
        const existing = findLeadByEvent(input.eventId);
        if (existing)
            return { kind: 'exists', lead: existing };
    }
    const at = demoNow();
    const ids = [...new Set(input.articleIds)];
    const lead = {
        id: nextId('lead-m'),
        eventId: input.eventId,
        title,
        status: 'pending',
        ownerId: input.ownerId,
        notes: input.notes.trim(),
        articles: ids.map((articleId) => ({ articleId, addedAt: at, source: input.eventId ? 'event' : 'manual' })),
        baselineIds: ids,
        reportRefs: [],
        analysisRefs: [],
        createdAt: at,
        updatedAt: at,
        lastActionAt: at,
        entryPoints: ['manual'],
        archiveHistory: [],
        currentOutcome: null,
        logs: [log({}, '创建', '手工新建线索', currentActor(), at)],
        mergedInto: null,
        createdBy: currentActor(),
    };
    const rows = loadLeads();
    rows.unshift(lead);
    saveAll(rows);
    return { kind: 'created', lead };
}
export function sameTitleLeads(title, exceptId) {
    const name = title.trim();
    if (!name)
        return [];
    return visibleLeads().filter((item) => item.id !== exceptId && item.title === name);
}
export function mergeLeads(sourceId, targetId) {
    if (sourceId === targetId)
        return findLead(targetId);
    const rows = loadLeads();
    const source = rows.find((item) => item.id === sourceId);
    const target = rows.find((item) => item.id === targetId);
    if (!source || !target || target.mergedInto)
        return null;
    if (source.mergedInto === targetId)
        return target;
    const at = demoNow();
    const combined = addIds(target, source.articles.map((item) => item.articleId), 'manual', at);
    const reportRefs = [...target.reportRefs];
    for (const ref of source.reportRefs) {
        if (!reportRefs.some((item) => item.reportId === ref.reportId))
            reportRefs.push(ref);
    }
    const notes = [target.notes, source.notes && source.notes !== target.notes ? `来自「${source.title}」的备注：${source.notes}` : '']
        .filter(Boolean)
        .join('\n');
    const nextTarget = {
        ...combined.lead,
        notes,
        reportRefs,
        analysisRefs: [...target.analysisRefs, ...source.analysisRefs.filter((item) => !target.analysisRefs.some((row) => row.key === item.key))],
        updatedAt: at,
        lastActionAt: at,
        logs: [log(target, '合并', `并入「${source.title}」，保留原标题、负责人和备注`, currentActor(), at), ...target.logs].slice(0, 80),
    };
    const nextSource = {
        ...source,
        mergedInto: targetId,
        updatedAt: at,
        logs: [log(source, '合并', `已并入 ${targetId}`, currentActor(), at), ...source.logs].slice(0, 80),
    };
    saveAll(rows.map((item) => (item.id === targetId ? nextTarget : item.id === sourceId ? nextSource : item)));
    return nextTarget;
}
export function absorbDraft(targetId, draft) {
    const at = demoNow();
    return patch(targetId, (lead) => {
        const merged = addIds(lead, draft.articleIds, 'manual', at);
        const extra = draft.notes.trim() && !lead.notes.includes(draft.notes.trim()) ? `来自「${draft.title}」的备注：${draft.notes.trim()}` : '';
        if (!merged.added.length && !extra)
            return lead;
        return {
            ...merged.lead,
            notes: [lead.notes, extra].filter(Boolean).join('\n'),
            updatedAt: at,
            lastActionAt: at,
            logs: [log(lead, '合并', `并入草稿「${draft.title}」，保留原标题和负责人`, currentActor(), at), ...lead.logs].slice(0, 80),
        };
    });
}
export function renameLead(id, title) {
    const name = title.trim();
    if (!name)
        return null;
    const at = demoNow();
    return patch(id, (lead) => ({
        ...lead,
        title: name,
        updatedAt: at,
        lastActionAt: at,
        logs: [log(lead, '标题', `改为「${name}」`, currentActor(), at), ...lead.logs].slice(0, 80),
    }));
}
export function saveNotes(id, notes) {
    const at = demoNow();
    return patch(id, (lead) => ({
        ...lead,
        notes,
        updatedAt: at,
        lastActionAt: at,
        logs: [log(lead, '备注', '保存工作备注', currentActor(), at), ...lead.logs].slice(0, 80),
    }));
}
export function assignOwner(id, ownerId) {
    const at = demoNow();
    return patch(id, (lead) => ({
        ...lead,
        ownerId,
        updatedAt: at,
        lastActionAt: at,
        logs: [log(lead, '负责人', `改为${actorName(ownerId)}`, currentActor(), at), ...lead.logs].slice(0, 80),
    }));
}
export function startLead(id) {
    const at = demoNow();
    return patch(id, (lead) => {
        if (lead.status !== 'pending')
            return lead;
        return {
            ...lead,
            status: 'active',
            updatedAt: at,
            lastActionAt: at,
            logs: [log(lead, '状态', '开始跟进', currentActor(), at), ...lead.logs].slice(0, 80),
        };
    });
}
export function returnPending(id) {
    const at = demoNow();
    return patch(id, (lead) => {
        if (lead.status !== 'active')
            return lead;
        return {
            ...lead,
            status: 'pending',
            updatedAt: at,
            lastActionAt: at,
            logs: [log(lead, '状态', '退回待处理', currentActor(), at), ...lead.logs].slice(0, 80),
        };
    });
}
export function archiveLead(id, outcome, note) {
    if (outcome === 'other' && !note.trim())
        throw new Error('选择“其他”时需要填写说明');
    const at = demoNow();
    const record = { outcome, note: note.trim(), at, by: currentActor() };
    return patch(id, (lead) => {
        if (lead.status === 'archived' || lead.mergedInto)
            return lead;
        return {
            ...lead,
            status: 'archived',
            currentOutcome: record,
            archiveHistory: [record, ...lead.archiveHistory],
            updatedAt: at,
            lastActionAt: at,
            logs: [log(lead, '归档', `${outcomeLabel(outcome)}${record.note ? `：${record.note}` : ''}`, currentActor(), at), ...lead.logs].slice(0, 80),
        };
    });
}
export function restoreLead(id) {
    const at = demoNow();
    return patch(id, (lead) => {
        if (lead.status !== 'archived')
            return lead;
        return {
            ...lead,
            status: 'pending',
            currentOutcome: null,
            updatedAt: at,
            lastActionAt: at,
            logs: [log(lead, '恢复', '恢复为待处理，上次归档结果仍留在历史中', currentActor(), at), ...lead.logs].slice(0, 80),
        };
    });
}
export function addManualArticles(id, articleIds) {
    const at = demoNow();
    return patch(id, (lead) => {
        const merged = addIds(lead, articleIds, 'manual', at);
        if (!merged.added.length)
            return lead;
        return {
            ...merged.lead,
            updatedAt: at,
            lastActionAt: at,
            logs: [log(lead, '材料', `手动补充 ${merged.added.length} 篇`, currentActor(), at), ...lead.logs].slice(0, 80),
        };
    });
}
export function removeManualArticle(id, articleId) {
    const at = demoNow();
    return patch(id, (lead) => {
        const target = lead.articles.find((item) => item.articleId === articleId);
        if (!target || target.source !== 'manual')
            return lead;
        return {
            ...lead,
            articles: lead.articles.filter((item) => item.articleId !== articleId),
            updatedAt: at,
            lastActionAt: at,
            logs: [log(lead, '材料', '解除一条手动补充的材料', currentActor(), at), ...lead.logs].slice(0, 80),
        };
    });
}
export function attachReport(id, reportId, materialCount) {
    const at = demoNow();
    return patch(id, (lead) => {
        if (lead.reportRefs.some((item) => item.reportId === reportId))
            return lead;
        return {
            ...lead,
            reportRefs: [{ reportId, linkedAt: at, materialCount }, ...lead.reportRefs],
            updatedAt: at,
            lastActionAt: at,
            logs: [log(lead, '报告', '关联对比报告', currentActor(), at), ...lead.logs].slice(0, 80),
        };
    });
}
export function detachReport(id, reportId) {
    const at = demoNow();
    return patch(id, (lead) => ({
        ...lead,
        reportRefs: lead.reportRefs.filter((item) => item.reportId !== reportId),
        updatedAt: at,
        lastActionAt: at,
        logs: [log(lead, '报告', '解除报告引用，报告本身仍保留', currentActor(), at), ...lead.logs].slice(0, 80),
    }));
}
export function syncEventArticles(news = corpus()) {
    let changed = false;
    let at = '';
    const rows = loadLeads().map((lead) => {
        if (!lead.eventId || lead.mergedInto)
            return lead;
        const ids = news.filter((item) => item.eventId === lead.eventId).map((item) => item.id);
        const known = new Set(lead.articles.map((item) => item.articleId));
        const fresh = ids.filter((id) => id && !known.has(id));
        if (!fresh.length)
            return lead;
        changed = true;
        if (!at)
            at = demoNow();
        return {
            ...lead,
            articles: [...lead.articles, ...fresh.map((articleId) => ({ articleId, addedAt: at, source: 'event' }))],
            updatedAt: at,
            logs: [{ id: nextId('log'), at, by: '系统', action: '材料入库', detail: `事件新增 ${fresh.length} 篇，不改变最近人工操作时间` }, ...lead.logs].slice(0, 80),
        };
    });
    if (changed)
        saveAll(rows);
    return changed;
}
export function loadSeen() {
    return readJson(SEEN_KEY, []);
}
export function seenIds(userId, leadId) {
    return new Set(loadSeen().find((item) => item.userId === userId && item.leadId === leadId)?.seenIds ?? []);
}
export function freshArticles(lead, userId = currentActor()) {
    const seen = seenIds(userId, lead.id);
    const base = new Set(lead.baselineIds);
    return lead.articles.filter((item) => !base.has(item.articleId) && !seen.has(item.articleId));
}
export function markSeen(leadId, articleIds, userId = currentActor()) {
    const rows = loadSeen();
    const index = rows.findIndex((item) => item.userId === userId && item.leadId === leadId);
    const current = new Set(index >= 0 ? rows[index].seenIds : []);
    articleIds.forEach((id) => current.add(id));
    const next = { userId, leadId, seenIds: [...current] };
    if (index >= 0)
        rows[index] = next;
    else
        rows.push(next);
    localStorage.setItem(SEEN_KEY, JSON.stringify(rows));
    return next;
}
export function leadTopic(lead, news) {
    if (!lead.eventId)
        return null;
    const item = news.find((row) => row.eventId === lead.eventId);
    if (!item)
        return null;
    const topic = topicById[item.topicId];
    if (!topic)
        return null;
    const category = categoryById[topic.categoryId];
    if (!category)
        return null;
    return { topic, category };
}
export function materialNatureMix(ids, newsById) {
    let simulated = 0;
    let real = 0;
    ids.forEach((id) => {
        const item = newsById.get(id);
        if (!item)
            return;
        if (item.nature === 'real')
            real += 1;
        else
            simulated += 1;
    });
    if (real && simulated)
        return '混合';
    if (real)
        return '真实';
    if (simulated)
        return '模拟';
    return '';
}
function csvCell(value) {
    const text = value.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
}
export function leadsToCsv(rows, news = corpus()) {
    const newsById = new Map(news.map((item) => [item.id, item]));
    const header = ['线索ID', '标题', '关联事件', '主题', '分类', '加入途径', '负责人', '状态', '材料数', '材料性质', '创建时间', '最近操作时间', '当前处理结论', '最近归档结果', '备注'];
    const lines = rows.map((lead) => {
        const topic = leadTopic(lead, news);
        const eventName = lead.eventId ? news.find((item) => item.eventId === lead.eventId)?.eventName ?? '' : '';
        const latestArchive = lead.archiveHistory[0];
        return [
            lead.id,
            lead.title,
            lead.eventId ? eventName || '关联对象暂不可用' : '',
            topic?.topic.name ?? '',
            topic?.category.name ?? '',
            lead.entryPoints.map(entryLabel).join('、'),
            actorName(lead.ownerId),
            statusLabel(lead.status),
            String(lead.articles.length),
            materialNatureMix(lead.articles.map((item) => item.articleId), newsById),
            lead.createdAt,
            lead.lastActionAt,
            lead.currentOutcome ? `${outcomeLabel(lead.currentOutcome.outcome)} ${lead.currentOutcome.note}`.trim() : '',
            latestArchive ? `${outcomeLabel(latestArchive.outcome)} ${latestArchive.note}`.trim() : '',
            lead.notes,
        ].map(csvCell).join(',');
    });
    return `\uFEFF${header.map(csvCell).join(',')}\n${lines.join('\n')}`;
}
export function downloadCsv(filename, csv) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

import { WATCH_KEYWORDS } from '../data/demo/index.ts';
import { findLeadByEvent, followEvent, saveNotes, visibleLeads } from './leads.ts';
const LINKS_KEY = 'hot-manual-links-v1';
const TOPICS_KEY = 'hot-topic-follows-v1';
const KEYWORDS_KEY = 'hot-keywords-v1';
const BATCH_KEY = 'hot-demo-batch-v1';
const VIEW_KEY = 'hot-view-v1';
const PROGRESS_KEY = 'hot-progress-cache-v1';
const EXPLAIN_KEY = 'hot-explain-cache-v1';
function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    }
    catch {
        return fallback;
    }
}
function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}
export function loadManualLinks() {
    return readJson(LINKS_KEY, {});
}
export function saveManualLink(itemKey, eventId) {
    const links = loadManualLinks();
    links[itemKey] = eventId;
    writeJson(LINKS_KEY, links);
}
export function loadTopicFollows() {
    return readJson(TOPICS_KEY, []);
}
export function saveTopicFollows(rows) {
    writeJson(TOPICS_KEY, rows);
}
export function loadEventFollows() {
    return visibleLeads()
        .filter((lead) => lead.eventId)
        .map((lead) => ({
        eventId: lead.eventId ?? '',
        eventName: lead.title,
        materialIds: lead.articles.map((item) => item.articleId),
        note: lead.notes,
        analysisRef: lead.analysisRefs[0]?.key ?? null,
        updatedAt: lead.updatedAt,
    }));
}
export function saveEventFollow(row) {
    followEvent({
        eventId: row.eventId,
        eventName: row.eventName,
        articleIds: row.materialIds,
        entry: 'legacy',
        note: row.note,
        analysisKey: row.analysisRef,
    });
    return loadEventFollows();
}
export function updateEventNote(eventId, note) {
    const lead = findLeadByEvent(eventId);
    if (lead)
        saveNotes(lead.id, note);
    return loadEventFollows();
}
export function loadKeywords() {
    const stored = readJson(KEYWORDS_KEY, null);
    return stored ?? [...WATCH_KEYWORDS];
}
export function saveKeywords(words) {
    writeJson(KEYWORDS_KEY, words);
}
export function demoBatchLoaded() {
    return localStorage.getItem(BATCH_KEY) === '1';
}
export function markDemoBatchLoaded() {
    localStorage.setItem(BATCH_KEY, '1');
}
export function loadViewState() {
    try {
        const raw = sessionStorage.getItem(VIEW_KEY);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
export function saveViewState(state) {
    sessionStorage.setItem(VIEW_KEY, JSON.stringify(state));
}
export function loadProgressCache() {
    return readJson(PROGRESS_KEY, []);
}
export function upsertProgressCache(record) {
    const scope = record.scope ?? 'later';
    const rows = loadProgressCache().filter((item) => !(item.eventId === record.eventId && (item.scope ?? 'later') === scope));
    rows.unshift({ ...record, scope });
    writeJson(PROGRESS_KEY, rows.slice(0, 24));
}
export function loadExplainCache() {
    return readJson(EXPLAIN_KEY, []);
}
export function upsertExplainCache(record) {
    const rows = loadExplainCache().filter((item) => item.key !== record.key);
    rows.unshift(record);
    writeJson(EXPLAIN_KEY, rows.slice(0, 20));
}

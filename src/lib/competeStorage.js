import { MEDIA } from '../data/demo/catalog.ts';
import { DATA_END, DEFAULT_START } from './dates.ts';
const MEDIA_KEY = 'compete-media-state-v1';
const RULE_KEY = 'compete-alert-rules-v1';
const HANDLED_KEY = 'compete-alert-handled-v1';
const FILTER_KEY = 'compete-filters-v1';
export function builtinProfiles() {
    return MEDIA.map((media) => ({
        id: media.id,
        name: media.name,
        site: '',
        keywords: media.id === 'cover' ? ['低空经济', '地铁'] : [],
        note: '',
        enabled: true,
        builtin: true,
    }));
}
export function defaultRules(ownMediaId = 'cover') {
    return [
        { id: `${ownMediaId}:daily_count`, mediaId: ownMediaId, kind: 'daily_count', enabled: true, threshold: 5, keywords: [] },
        {
            id: `${ownMediaId}:keyword`,
            mediaId: ownMediaId,
            kind: 'keyword',
            enabled: true,
            threshold: 1,
            keywords: ['低空经济', '地铁'],
        },
        { id: `${ownMediaId}:hot_event`, mediaId: ownMediaId, kind: 'hot_event', enabled: true, threshold: 1, keywords: [] },
    ];
}
function readJson(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function loadMediaState() {
    const saved = readJson(MEDIA_KEY);
    const builtins = builtinProfiles();
    const savedProfiles = Array.isArray(saved?.profiles) ? saved.profiles : [];
    const profiles = builtins.map((builtin) => {
        const overlay = savedProfiles.find((item) => item.id === builtin.id);
        if (!overlay)
            return builtin;
        return {
            ...builtin,
            name: overlay.name?.trim() || builtin.name,
            site: overlay.site ?? '',
            keywords: Array.isArray(overlay.keywords) ? overlay.keywords.filter((item) => typeof item === 'string' && item.trim()) : [],
            note: overlay.note ?? '',
            enabled: overlay.enabled !== false,
        };
    });
    for (const extra of savedProfiles) {
        if (extra.builtin || builtins.some((item) => item.id === extra.id))
            continue;
        if (!extra.id || !extra.name)
            continue;
        profiles.push({
            id: extra.id,
            name: extra.name,
            site: extra.site ?? '',
            keywords: Array.isArray(extra.keywords) ? extra.keywords : [],
            note: extra.note ?? '',
            enabled: extra.enabled !== false,
            builtin: false,
        });
    }
    const ownMediaId = profiles.some((item) => item.id === saved?.ownMediaId) ? saved.ownMediaId : 'cover';
    return { ownMediaId, profiles };
}
export function saveMediaState(state) {
    localStorage.setItem(MEDIA_KEY, JSON.stringify(state));
}
export function loadAlertRules() {
    const saved = readJson(RULE_KEY);
    if (!Array.isArray(saved) || !saved.length)
        return defaultRules();
    return saved.filter((rule) => rule && rule.id && rule.mediaId && rule.kind);
}
export function saveAlertRules(rules) {
    localStorage.setItem(RULE_KEY, JSON.stringify(rules));
}
export function loadHandledAlerts() {
    const saved = readJson(HANDLED_KEY);
    return new Set(Array.isArray(saved) ? saved.filter((item) => typeof item === 'string') : []);
}
export function saveHandledAlerts(ids) {
    localStorage.setItem(HANDLED_KEY, JSON.stringify([...ids]));
}
export function defaultFilters(ownMediaId, profiles) {
    const peerIds = profiles.filter((item) => item.enabled && item.id !== ownMediaId).map((item) => item.id);
    return {
        preset: '7d',
        customStart: DEFAULT_START,
        customEnd: DATA_END,
        ownMediaId,
        peerIds,
        categoryId: 'all',
        nature: 'all',
    };
}
export function loadFilters(fallback) {
    try {
        const rawText = sessionStorage.getItem(FILTER_KEY);
        if (!rawText)
            return fallback;
        const raw = JSON.parse(rawText);
        if (!raw.ownMediaId)
            return fallback;
        const peerIds = Array.isArray(raw.peerIds) ? raw.peerIds.filter((id) => id && id !== raw.ownMediaId) : fallback.peerIds;
        return { ...fallback, ...raw, peerIds };
    }
    catch {
        return fallback;
    }
}
export function saveFilters(filters) {
    sessionStorage.setItem(FILTER_KEY, JSON.stringify(filters));
}
export function profileName(profiles, id) {
    return profiles.find((item) => item.id === id)?.name ?? id;
}

const FOLLOW_KEY = 'clue-overview-follows';
const READ_KEY = 'clue-overview-read-alerts';
function loadIds(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw)
            return new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return new Set();
        return new Set(parsed.filter((item) => typeof item === 'string'));
    }
    catch {
        return new Set();
    }
}
function saveIds(key, ids) {
    localStorage.setItem(key, JSON.stringify([...ids]));
}
export function loadFollows() {
    return loadIds(FOLLOW_KEY);
}
export function saveFollows(ids) {
    saveIds(FOLLOW_KEY, ids);
}
export function loadReadAlerts() {
    return loadIds(READ_KEY);
}
export function saveReadAlerts(ids) {
    saveIds(READ_KEY, ids);
}

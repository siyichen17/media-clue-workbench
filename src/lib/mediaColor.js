const ASSIGNED = {
    cover: '#2563eb',
    scdaily: '#0f766e',
    thepaper: '#7c3aed',
    jiemian: '#4f46e5',
    redstar: '#e11d48',
    nddaily: '#d97706',
    bjnews: '#0284c7',
    guancha: '#059669',
};
const FALLBACK = ['#2563eb', '#0f766e', '#d97706', '#7c3aed', '#4f46e5', '#e11d48', '#0284c7', '#059669'];
export function mediaColor(mediaId) {
    if (ASSIGNED[mediaId])
        return ASSIGNED[mediaId];
    let hash = 0;
    for (const char of mediaId)
        hash = (hash + char.charCodeAt(0)) % FALLBACK.length;
    return FALLBACK[hash];
}

const DB_NAME = 'clue-workbench';
const DB_VERSION = 1;
function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('reports'))
                db.createObjectStore('reports', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('extracts'))
                db.createObjectStore('extracts', { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
export async function saveReport(report) {
    const db = await openDb();
    const tx = db.transaction('reports', 'readwrite');
    tx.objectStore('reports').put(report);
    await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}
export async function loadReport(id) {
    const db = await openDb();
    const tx = db.transaction('reports', 'readonly');
    const report = await requestToPromise(tx.objectStore('reports').get(id));
    db.close();
    return report ?? null;
}
export async function listReports() {
    const db = await openDb();
    const tx = db.transaction('reports', 'readonly');
    const rows = await requestToPromise(tx.objectStore('reports').getAll());
    db.close();
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function loadCachedExtract(key) {
    const db = await openDb();
    const tx = db.transaction('extracts', 'readonly');
    const row = await requestToPromise(tx.objectStore('extracts').get(key));
    db.close();
    const saved = row;
    return saved?.item ?? null;
}
export async function saveCachedExtract(key, item) {
    const db = await openDb();
    const tx = db.transaction('extracts', 'readwrite');
    tx.objectStore('extracts').put({ key, item });
    await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

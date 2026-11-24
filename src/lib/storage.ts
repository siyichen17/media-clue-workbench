const FOLLOW_KEY = 'clue-overview-follows'
const READ_KEY = 'clue-overview-read-alerts'

function loadIds(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item) => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

function saveIds(key: string, ids: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...ids]))
}

export function loadFollows(): Set<string> {
  return loadIds(FOLLOW_KEY)
}

export function saveFollows(ids: Set<string>) {
  saveIds(FOLLOW_KEY, ids)
}

export function loadReadAlerts(): Set<string> {
  return loadIds(READ_KEY)
}

export function saveReadAlerts(ids: Set<string>) {
  saveIds(READ_KEY, ids)
}

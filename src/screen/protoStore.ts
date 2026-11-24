import type { CanvasWidget, ProtoSettings } from './protoCatalog.ts'

/** 与旧版大屏 `clue-screen-templates-v1` 分开，避免旧坐标套到原型布局上。 */
const KEY = 'clue-screen-proto-v1'

export interface ProtoRect {
  x: number
  y: number
  w: number
  h: number
}

export interface CustomTemplate {
  id: string
  name: string
  widgets: CanvasWidget[]
  settings: ProtoSettings
  createdAt: string
}

interface LayoutRecord {
  rects: Record<string, ProtoRect> | null
  widgets?: CanvasWidget[] | null
  updatedAt: string
}

interface ProtoFile {
  schemaVersion: 1
  templates: CustomTemplate[]
  layouts: Record<string, LayoutRecord>
}

function emptyFile(): ProtoFile {
  return { schemaVersion: 1, templates: [], layouts: {} }
}

function readFile(): ProtoFile {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyFile()
    const parsed = JSON.parse(raw) as ProtoFile
    if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.templates) || !parsed.layouts) return emptyFile()
    return parsed
  } catch {
    return emptyFile()
  }
}

function writeFile(file: ProtoFile): { ok: true } | { ok: false; error: string } {
  try {
    localStorage.setItem(KEY, JSON.stringify(file))
    const check = localStorage.getItem(KEY)
    if (check !== JSON.stringify(file)) return { ok: false, error: '保存失败，修改还在' }
    return { ok: true }
  } catch {
    return { ok: false, error: '保存失败，修改还在' }
  }
}

export function listCustomTemplates(): CustomTemplate[] {
  return readFile().templates
}

export function getCustomTemplate(id: string): CustomTemplate | null {
  return readFile().templates.find((item) => item.id === id) ?? null
}

export function saveCustomTemplate(template: CustomTemplate): { ok: true } | { ok: false; error: string } {
  const file = readFile()
  file.templates = [template, ...file.templates.filter((item) => item.id !== template.id)]
  return writeFile(file)
}

export function deleteCustomTemplate(id: string): { ok: true } | { ok: false; error: string } {
  const file = readFile()
  file.templates = file.templates.filter((item) => item.id !== id)
  delete file.layouts[id]
  return writeFile(file)
}

export interface SavedBoard {
  widgets: CanvasWidget[] | null
  rects: Record<string, ProtoRect> | null
}

export function loadBoard(templateId: string): SavedBoard {
  const saved = readFile().layouts[templateId]
  if (!saved) return { widgets: null, rects: null }
  return { widgets: saved.widgets ?? null, rects: saved.rects ?? null }
}

export function loadLayout(templateId: string): Record<string, ProtoRect> | null {
  return loadBoard(templateId).rects
}

export function saveBoard(templateId: string, widgets: CanvasWidget[], rects: Record<string, ProtoRect> | null): { ok: true } | { ok: false; error: string } {
  const file = readFile()
  file.layouts[templateId] = { widgets, rects, updatedAt: new Date().toISOString() }
  const custom = file.templates.find((item) => item.id === templateId)
  if (custom) custom.widgets = widgets
  return writeFile(file)
}

export function saveLayout(templateId: string, rects: Record<string, ProtoRect> | null): { ok: true } | { ok: false; error: string } {
  const file = readFile()
  const current = file.layouts[templateId]
  if (!rects && !current?.widgets) delete file.layouts[templateId]
  else file.layouts[templateId] = { widgets: current?.widgets ?? null, rects, updatedAt: new Date().toISOString() }
  return writeFile(file)
}

export function overlaps(a: ProtoRect, b: ProtoRect): boolean {
  return a.x < b.x + b.w - 0.2 && a.x + a.w > b.x + 0.2 && a.y < b.y + b.h - 0.2 && a.y + a.h > b.y + 0.2
}

export function inside(rect: ProtoRect): boolean {
  return rect.x >= -0.2 && rect.y >= -0.2 && rect.x + rect.w <= 100.2 && rect.y + rect.h <= 100.2
}

export function findFree(used: ProtoRect[], w = 24, h = 28): ProtoRect | null {
  for (let y = 0; y <= 100 - h; y += 2) {
    for (let x = 0; x <= 100 - w; x += 2) {
      const rect = { x, y, w, h }
      if (!used.some((item) => overlaps(item, rect))) return rect
    }
  }
  return null
}

export function minSize(typeIndex: number): { w: number; h: number } {
  if (typeIndex === 5) return { w: 14, h: 12 }
  if (typeIndex === 0 || typeIndex === 1 || typeIndex === 2 || typeIndex === 3 || typeIndex === 4) return { w: 24, h: 22 }
  if (typeIndex === 6 || typeIndex === 7 || typeIndex === 8 || typeIndex === 11) return { w: 22, h: 20 }
  return { w: 20, h: 18 }
}

export function defaultSize(typeIndex: number): { w: number; h: number } {
  const min = minSize(typeIndex)
  if (typeIndex === 5) return { w: 22, h: 16 }
  return { w: Math.max(min.w, 34), h: Math.max(min.h, 30) }
}

let instanceSeq = 0

export function newWidgetId(): string {
  instanceSeq += 1
  return `inst-${Date.now().toString(36)}-${instanceSeq}`
}

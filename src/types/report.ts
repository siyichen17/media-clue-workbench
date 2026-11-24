import type { CompareResult, ExtractItem, MaterialLevel, ReportKind } from '../../shared/aiTypes.ts'
import type { CompeteFilters } from '../lib/competeStorage.ts'

export type ReportType = ReportKind | 'daily' | 'weekly' | 'topic' | 'media' | 'theme' | 'work'

export interface NarrativeParagraph {
  text: string
  articleIds: string[]
}

export interface NarrativeChapter {
  id: string
  title: string
  paragraphs: NarrativeParagraph[]
  limitation: string
}

export interface MaterialSnapshot {
  articleId: string
  eventId: string
  eventName: string
  mediaId: string
  mediaName: string
  columnName: string
  platform: string
  publishedAt: string
  categoryId: string
  title: string
  summary: string
  body: string
  completeness: MaterialLevel
  nature: 'real' | 'simulated'
}

export interface ReportScope {
  kind: ReportType
  filters: CompeteFilters
  eventId: string | null
  eventName: string | null
  mediaIds: string[]
  samplingNote: string | null
  hotBoard?: { platform: string; title: string; bestRank: number; hits: number; first: string; last: string }[]
}

export interface StatRow {
  mediaId: string
  name: string
  newsCount: number
  eventCount: number
  hotNewsCount: number
  selectedCount: number
  earliest: string | null
  latest: string | null
}

export interface ReportStats {
  rangeLabel: string
  newsCount: number
  eventCount: number
  hotNewsCount: number
  analyzedCount: number
  fullCount: number
  summaryCount: number
  titleCount: number
  simulatedCount: number
  realCount: number
  byMedia: StatRow[]
  byDay: { date: string; counts: Record<string, number> }[]
  byCategory: { name: string; counts: Record<string, number> }[]
  byEvent: { eventId: string; name: string; counts: Record<string, number> }[]
}

export interface ReportSections {
  comparisonDimensions: CompareResult['comparisonDimensions']
  keyDifferences: CompareResult['keyDifferences']
  summary: CompareResult['summary']
  nextActions: CompareResult['nextActions']
  limitations: string[]
}

export interface ReportDocument {
  id: string
  type: ReportType
  title: string
  /** draft 为草稿；saved 是旧数据里的“已保存”，不表示定稿；final 为已定稿。 */
  status: 'draft' | 'saved' | 'final'
  createdAt: string
  updatedAt: string
  promptVersion: string
  model: string | null
  scope: ReportScope
  stats: ReportStats
  materials: MaterialSnapshot[]
  extraction: ExtractItem[]
  aiOriginal: ReportSections
  sections: ReportSections
  history: {
    comparison?: ReportSections['comparisonDimensions'][]
    differences?: ReportSections['keyDifferences'][]
    summary?: ReportSections['summary'][]
    actions?: ReportSections['nextActions'][]
  }
  notes: string
  narrative?: NarrativeChapter[] | null
  groupId?: string
  versionId?: string
  parentVersionId?: string | null
  copiedFrom?: string | null
  finalizedAt?: string | null
  editedAt?: string
  archived?: boolean
  createdBy?: string
  leadIds?: string[]
  narrativeHistory?: Record<string, NarrativeChapter[]>
}

export function sectionsFromCompare(result: CompareResult): ReportSections {
  return {
    comparisonDimensions: result.comparisonDimensions,
    keyDifferences: result.keyDifferences,
    summary: result.summary,
    nextActions: result.nextActions,
    limitations: result.limitations,
  }
}

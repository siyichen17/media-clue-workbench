export const PROMPT_VERSION = 'compete-report-v1'
export const NARRATIVE_PROMPT_VERSION = 'report-narrative-v1'
export const HOT_PROMPT_VERSION = 'hot-progress-v1'
export const PITCH_PROMPT_VERSION = 'hot-pitch-v1'
export const EXPLAIN_PROMPT_VERSION = 'hot-explain-v1'

export type MaterialLevel = 'full' | 'summary' | 'title'
export type ReportKind = 'date' | 'event'
export type Speaker = 'media' | 'quoted' | 'author'

export interface ExtractFact {
  text: string
  quote: string
  speaker: Speaker
}

export interface ExtractQuote {
  who: string
  text: string
  quote: string
}

export interface ExtractDevelopment {
  text: string
  quote: string
}

export interface ExtractItem {
  articleId: string
  eventId: string
  completeness: MaterialLevel
  topic: string
  angle: string
  facts: ExtractFact[]
  attributed: ExtractQuote[]
  developments: ExtractDevelopment[]
  unrelated: boolean
}

export interface MediaFinding {
  mediaId: string
  text: string
  articleIds: string[]
}

export interface DimensionBlock {
  dimension: string
  mediaFindings: MediaFinding[]
}

export interface CitedText {
  text: string
  articleIds: string[]
}

export interface ActionText {
  text: string
  basedOnArticleIds: string[]
}

export interface CompareResult {
  comparisonDimensions: DimensionBlock[]
  keyDifferences: CitedText[]
  summary: CitedText
  nextActions: ActionText[]
  limitations: string[]
}

export type SectionKey = 'comparison' | 'differences' | 'summary' | 'actions'

export type ProgressNodeType = 'fact' | 'commentary' | 'unverified'
export type TimeBasis = 'event' | 'report'

export interface ProgressEvidence {
  articleId: string
  quote: string
}

export interface ProgressNode {
  nodeId: string
  title: string
  summary: string
  nodeType: ProgressNodeType
  timeBasis: TimeBasis
  timeStart: string
  timeEnd: string
  articleIds: string[]
  evidence: ProgressEvidence[]
}

export interface ProgressResult {
  nodes: ProgressNode[]
  analyzedCount: number
}

export interface PitchCandidate {
  id: string
  title: string
  angle: string
  question: string
  reason: string
  articleIds: string[]
  gaps: string[]
  outline: string[]
}

export interface PitchResult {
  pitches: PitchCandidate[]
}

export interface ExplainFinding {
  eventId: string
  text: string
  articleIds: string[]
}

export interface ExplainResult {
  mode: 'change' | 'composition'
  overview: string
  eventFindings: ExplainFinding[]
  limitations: string[]
}

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

export interface NarrativeResult {
  chapters: NarrativeChapter[]
}

export interface AiMaterialInput {
  articleId: string
  eventId: string
  mediaId: string
  mediaName: string
  publishedAt: string
  completeness: MaterialLevel
  nature: 'real' | 'simulated'
  title: string
  summary: string
  body: string
}

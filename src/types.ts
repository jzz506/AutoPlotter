export type CellValue = string | number | boolean | null

export type ColumnType = 'number' | 'string' | 'datetime' | 'boolean' | 'unknown'

export interface Dataset {
  name: string
  columns: string[]
  rows: CellValue[][]
}

export interface ColumnProfile {
  name: string
  index: number
  type: ColumnType
  nonNull: number
  missing: number
  missingRatio: number
  unique: number
  min?: number
  max?: number
  mean?: number
  median?: number
  std?: number
  topValues?: { value: string; count: number }[]
  dateMin?: string
  dateMax?: string
}

export type IssueLevel = 'info' | 'warning' | 'error'

export interface QualityIssue {
  id: string
  level: IssueLevel
  column?: string
  message: string
  suggestion?: string
}

export interface QualityReport {
  rowCount: number
  columnCount: number
  duplicateRows: number
  issues: QualityIssue[]
}

export type Operation =
  | { kind: 'dropMissingRows'; columns?: string[] }
  | { kind: 'fillMissing'; column: string; method: 'mean' | 'median' | 'mode' }
  | { kind: 'dropDuplicates' }
  | { kind: 'textToNumber'; column: string }
  | { kind: 'toDate'; column: string }
  | { kind: 'keepColumns'; columns: string[] }
  | { kind: 'sort'; column: string; order: 'asc' | 'desc' }
  | { kind: 'filterCategory'; column: string; values: string[] }
  | { kind: 'filterRange'; column: string; min?: number; max?: number }

export type ChartType =
  | 'line'
  | 'scatter'
  | 'bar'
  | 'barh'
  | 'histogram'
  | 'box'
  | 'violin'
  | 'pie'
  | 'heatmap'

export type Aggregation = 'none' | 'sum' | 'mean' | 'count' | 'median' | 'min' | 'max'

export type SortMode = 'none' | 'x-asc' | 'x-desc' | 'y-asc' | 'y-desc'

export type ChartTheme = 'light' | 'dark' | 'minimal'

export type ChartPreset = 'web' | 'publication' | 'presentation'

export type ErrorMode = 'none' | 'symmetric' | 'asymmetric' | 'std' | 'sem'

export interface RefLine {
  axis: 'x' | 'y'
  value: number
  label: string
}

export interface ChartAnnotation {
  x: number
  y: number
  text: string
}

export interface ChartConfig {
  type: ChartType
  x?: string
  y?: string
  color?: string
  aggregation: Aggregation
  sortBy: SortMode
  title: string
  xLabel: string
  yLabel: string
  showLegend: boolean
  showGrid: boolean
  width: number
  height: number
  fontSize: number
  theme: ChartTheme
  preset: ChartPreset
  xLog: boolean
  yLog: boolean
  errorMode: ErrorMode
  errorCol?: string
  errorPlusCol?: string
  errorMinusCol?: string
  refLines: RefLine[]
  annotations: ChartAnnotation[]
}

export interface Recommendation {
  id: string
  title: string
  reason: string
  config: ChartConfig
}

export interface ParseResult {
  dataset?: Dataset
  sheets?: string[]
  error?: string
  warnings: string[]
  rowCount: number
  columnCount: number
}

export interface ChartBuildResult {
  data: Record<string, unknown>[]
  layout: Record<string, unknown>
  error?: string
  notes?: string[]
}

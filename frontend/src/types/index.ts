export interface DatasetInfo {
  id: string
  name: string
  rows: number
  cols: number
  missing_count: number
  duplicate_count: number
  outlier_count: number
  memory_mb: number
  dtypes_summary: { numeric: number; categorical: number; datetime: number }
  created_at: string
  updated_at: string
  columns: string[]
}

export interface ColumnStat {
  column: string
  dtype: string
  nulls: number
  null_pct: number
  unique: number
  min?: number | string | null
  max?: number | string | null
  mean?: number | null
  std?: number | null
  top_values?: { value: string; count: number }[]
}

export interface PreviewData {
  data: Record<string, unknown>[]
  total_rows: number
  page: number
  page_size: number
  columns: string[]
}

export interface AIInsight {
  summary: string
  insights: string[]
  warnings: string[]
  recommendations: string[]
  quality_score: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface CleanSuggestion {
  type: string
  column: string | null
  message: string
  action: Record<string, unknown>
  severity: 'info' | 'warning' | 'error'
}

export interface HistoryEntry {
  id: string
  operation: string
  ts: string
}

export interface MergeParams {
  left_id: string
  right_id: string
  left_key: string
  right_key: string
  how: 'inner' | 'left' | 'right' | 'outer'
  new_name: string
}

export type WorkspaceTab = 'preview' | 'clean' | 'merge' | 'visualize' | 'analyze'

export type ChartType =
  | 'bar'
  | 'line'
  | 'scatter'
  | 'histogram'
  | 'pie'
  | 'heatmap'
  | 'box'
  | 'correlation'
  | 'timeseries'

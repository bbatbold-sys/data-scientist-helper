import axios from 'axios'
import type { AIInsight, ChatMessage, CleanSuggestion, ColumnStat, DatasetInfo, HistoryEntry, MergeParams, PreviewData } from '../types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const api = axios.create({ baseURL: BASE_URL })

// ── Datasets ──────────────────────────────────────────────────────────────────

export async function uploadDataset(file: File): Promise<DatasetInfo> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/api/datasets/upload', form)
  return data
}

export async function listDatasets(): Promise<DatasetInfo[]> {
  const { data } = await api.get('/api/datasets/')
  return data
}

export async function getDataset(id: string): Promise<DatasetInfo> {
  const { data } = await api.get(`/api/datasets/${id}`)
  return data
}

export async function deleteDataset(id: string): Promise<void> {
  await api.delete(`/api/datasets/${id}`)
}

export async function renameDataset(id: string, name: string): Promise<DatasetInfo> {
  const { data } = await api.put(`/api/datasets/${id}/rename`, { name })
  return data
}

export async function previewDataset(
  id: string,
  page = 1,
  pageSize = 50,
  search = '',
  sortCol = '',
  sortDir: 'asc' | 'desc' = 'asc',
): Promise<PreviewData> {
  const { data } = await api.get(`/api/datasets/${id}/preview`, {
    params: { page, page_size: pageSize, search, sort_col: sortCol, sort_dir: sortDir },
  })
  return data
}

export async function getColumnStats(id: string): Promise<ColumnStat[]> {
  const { data } = await api.get(`/api/datasets/${id}/column-stats`)
  return data
}

// ── Cleaning ──────────────────────────────────────────────────────────────────

export async function cleanFillMissing(id: string, column: string, method: string, customValue?: unknown) {
  const { data } = await api.post(`/api/clean/${id}/fill-missing`, { column, method, custom_value: customValue })
  return data
}

export async function cleanRemoveDuplicates(id: string) {
  const { data } = await api.post(`/api/clean/${id}/remove-duplicates`)
  return data
}

export async function cleanHandleOutliers(id: string, columns: string[], method: string, action: string) {
  const { data } = await api.post(`/api/clean/${id}/handle-outliers`, { columns, method, action })
  return data
}

export async function cleanChangeDtype(id: string, column: string, dtype: string) {
  const { data } = await api.post(`/api/clean/${id}/change-dtype`, { column, dtype })
  return data
}

export async function cleanNormalize(id: string, columns: string[], method: string) {
  const { data } = await api.post(`/api/clean/${id}/normalize`, { columns, method })
  return data
}

export async function cleanEncodeCategorical(id: string, column: string, method: string) {
  const { data } = await api.post(`/api/clean/${id}/encode-categorical`, { column, method })
  return data
}

export async function cleanDropColumns(id: string, columns: string[]) {
  const { data } = await api.post(`/api/clean/${id}/drop-columns`, { columns })
  return data
}

export async function cleanRenameColumns(id: string, mapping: Record<string, string>) {
  const { data } = await api.post(`/api/clean/${id}/rename-columns`, { mapping })
  return data
}

export async function cleanTrimText(id: string) {
  const { data } = await api.post(`/api/clean/${id}/trim-text`)
  return data
}

export async function cleanSplitColumn(id: string, column: string, delimiter: string, newNames: string[]) {
  const { data } = await api.post(`/api/clean/${id}/split-column`, { column, delimiter, new_names: newNames })
  return data
}

export async function cleanMergeColumns(id: string, columns: string[], separator: string, newName: string) {
  const { data } = await api.post(`/api/clean/${id}/merge-columns`, { columns, separator, new_name: newName })
  return data
}

export async function cleanFormatDates(id: string, column: string, format: string) {
  const { data } = await api.post(`/api/clean/${id}/format-dates`, { column, format })
  return data
}

export async function getCleanHistory(id: string): Promise<HistoryEntry[]> {
  const { data } = await api.get(`/api/clean/${id}/history`)
  return data
}

export async function cleanUndo(id: string) {
  const { data } = await api.post(`/api/clean/${id}/undo`)
  return data
}

export async function getCleanSuggestions(id: string): Promise<{ suggestions: CleanSuggestion[] }> {
  const { data } = await api.get(`/api/clean/${id}/suggestions`)
  return data
}

// ── Merge ─────────────────────────────────────────────────────────────────────

export async function mergeDatasets(params: MergeParams): Promise<DatasetInfo> {
  const { data } = await api.post('/api/merge/', params)
  return data
}

export async function previewMerge(params: MergeParams) {
  const { data } = await api.post('/api/merge/preview', params)
  return data
}

export interface ConcatParams {
  left_id: string
  right_id: string
  axis: 'rows' | 'columns'
  new_name: string
}

export async function concatDatasets(params: ConcatParams): Promise<DatasetInfo> {
  const { data } = await api.post('/api/merge/concat', params)
  return data
}

export async function previewConcat(params: ConcatParams) {
  const { data } = await api.post('/api/merge/concat/preview', params)
  return data
}

// ── AI ────────────────────────────────────────────────────────────────────────

export async function analyzeDataset(id: string): Promise<AIInsight> {
  const { data } = await api.post(`/api/ai/${id}/analyze`)
  return data
}

export async function chatWithAI(id: string, message: string, history: ChatMessage[]): Promise<{ response: string }> {
  const { data } = await api.post(`/api/ai/${id}/chat`, { message, history })
  return data
}

export async function getAICleaningSuggestions(id: string) {
  const { data } = await api.post(`/api/ai/${id}/cleaning-suggestions`)
  return data
}

// ── Export ────────────────────────────────────────────────────────────────────

function downloadUrl(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function exportCsv(id: string, name: string) {
  downloadUrl(`${BASE_URL}/api/export/${id}/csv`, `${name}.csv`)
}

export function exportExcel(id: string, name: string) {
  downloadUrl(`${BASE_URL}/api/export/${id}/excel`, `${name}.xlsx`)
}

export function exportJson(id: string, name: string) {
  downloadUrl(`${BASE_URL}/api/export/${id}/json`, `${name}.json`)
}

export function exportPdfReport(id: string, name: string) {
  downloadUrl(`${BASE_URL}/api/export/${id}/pdf-report`, `${name}_report.pdf`)
}

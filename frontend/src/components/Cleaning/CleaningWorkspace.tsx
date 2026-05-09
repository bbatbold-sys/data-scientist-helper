import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, ChevronDown, ChevronRight, Zap, Trash2,
  AlertTriangle, Hash, Type, ArrowRightLeft, Minimize2, Calendar,
  Loader2, CheckCircle, RotateCcw, type LucideIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getColumnStats, getCleanSuggestions, cleanFillMissing, cleanRemoveDuplicates,
  cleanHandleOutliers, cleanChangeDtype, cleanNormalize, cleanEncodeCategorical,
  cleanDropColumns, cleanTrimText, cleanUndo, getCleanHistory,
} from '../../api/client'
import { useStore } from '../../store/useStore'
import type { CleanSuggestion } from '../../types'

interface Props { datasetId: string }

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <Icon size={14} className="text-primary-500 flex-shrink-0" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1">{title}</span>
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function CleaningWorkspace({ datasetId }: Props) {
  const qc = useQueryClient()
  const { datasets, updateDataset } = useStore()
  const ds = datasets.find((d) => d.id === datasetId)

  const { data: colStats } = useQuery({ queryKey: ['col-stats', datasetId], queryFn: () => getColumnStats(datasetId), staleTime: 30_000 })
  const { data: suggestions } = useQuery({ queryKey: ['suggestions', datasetId], queryFn: () => getCleanSuggestions(datasetId) })
  const { data: history } = useQuery({ queryKey: ['history', datasetId], queryFn: () => getCleanHistory(datasetId), refetchOnWindowFocus: false })

  const cols = colStats?.map((s) => s.column) ?? []
  const numericCols = colStats?.filter((s) => s.dtype.includes('int') || s.dtype.includes('float')).map((s) => s.column) ?? []
  const catCols = colStats?.filter((s) => s.dtype.includes('object') || s.dtype.includes('category')).map((s) => s.column) ?? []

  const [fillCol, setFillCol] = useState('all')
  const [fillMethod, setFillMethod] = useState('mean')
  const [fillCustom, setFillCustom] = useState('')
  const [outlierCols, setOutlierCols] = useState<string[]>([])
  const [outlierMethod, setOutlierMethod] = useState('iqr')
  const [outlierAction, setOutlierAction] = useState('cap')
  const [dtypeCol, setDtypeCol] = useState('')
  const [dtype, setDtype] = useState('float')
  const [normCols, setNormCols] = useState<string[]>([])
  const [normMethod, setNormMethod] = useState('minmax')
  const [encodeCol, setEncodeCol] = useState('')
  const [encodeMethod, setEncodeMethod] = useState('label')
  const [dropCols, setDropCols] = useState<string[]>([])
  const [loading, setLoading] = useState<string | null>(null)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['preview', datasetId] })
    qc.invalidateQueries({ queryKey: ['col-stats', datasetId] })
    qc.invalidateQueries({ queryKey: ['datasets'] })
    qc.invalidateQueries({ queryKey: ['history', datasetId] })
    qc.invalidateQueries({ queryKey: ['suggestions', datasetId] })
  }

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setLoading(key)
    try {
      const result = await fn() as { dataset: typeof ds }
      if (result?.dataset) updateDataset(result.dataset)
      invalidate()
      toast.success('Operation completed')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err?.response?.data?.detail || 'Operation failed')
    } finally {
      setLoading(null)
    }
  }

  const handleUndo = async () => {
    try {
      const result = await cleanUndo(datasetId) as { dataset: typeof ds }
      if (result?.dataset) updateDataset(result.dataset)
      invalidate()
      toast.success('Undo successful')
    } catch {
      toast.error('Nothing to undo')
    }
  }

  const severityColor = (s: CleanSuggestion['severity']) =>
    s === 'error' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10' :
    s === 'warning' ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10' :
    'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/10'

  const L = (key: string) => loading === key ? <Loader2 size={12} className="animate-spin" /> : null

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: operations */}
      <div className="w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 overflow-y-auto scrollbar-thin scrollbar-thumb-slate p-4 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Cleaning Operations</h2>
          <button onClick={handleUndo} className="btn-ghost text-xs">
            <RotateCcw size={12} /> Undo
          </button>
        </div>

        {/* Missing values */}
        <Section title="Fill Missing Values" icon={Zap}>
          <label className="label">Column</label>
          <select className="select mb-2" value={fillCol} onChange={(e) => setFillCol(e.target.value)}>
            <option value="all">All columns</option>
            {cols.map((c) => <option key={c}>{c}</option>)}
          </select>
          <label className="label">Method</label>
          <select className="select mb-2" value={fillMethod} onChange={(e) => setFillMethod(e.target.value)}>
            {['mean', 'median', 'mode', 'ffill', 'bfill', 'custom', 'drop'].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          {fillMethod === 'custom' && (
            <input className="input mb-2 text-xs" placeholder="Custom value" value={fillCustom} onChange={(e) => setFillCustom(e.target.value)} />
          )}
          <button
            className="btn-primary w-full justify-center"
            onClick={() => run('fill', () => cleanFillMissing(datasetId, fillCol, fillMethod, fillMethod === 'custom' ? fillCustom : undefined))}
          >
            {L('fill')} Apply
          </button>
        </Section>

        {/* Duplicates */}
        <Section title="Remove Duplicates" icon={Trash2}>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            {ds?.duplicate_count ?? 0} duplicate rows found
          </p>
          <button
            className="btn-primary w-full justify-center"
            onClick={() => run('dups', () => cleanRemoveDuplicates(datasetId))}
            disabled={!ds?.duplicate_count}
          >
            {L('dups')} Remove Duplicates
          </button>
        </Section>

        {/* Outliers */}
        <Section title="Handle Outliers" icon={AlertTriangle}>
          <label className="label">Columns</label>
          <div className="max-h-28 overflow-y-auto mb-2 space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
            {numericCols.map((c) => (
              <label key={c} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={outlierCols.includes(c)} onChange={(e) => {
                  setOutlierCols(e.target.checked ? [...outlierCols, c] : outlierCols.filter((x) => x !== c))
                }} className="accent-primary-600" />
                <span className="text-xs text-slate-700 dark:text-slate-300">{c}</span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="label">Method</label>
              <select className="select" value={outlierMethod} onChange={(e) => setOutlierMethod(e.target.value)}>
                <option value="iqr">IQR</option>
                <option value="zscore">Z-score</option>
              </select>
            </div>
            <div>
              <label className="label">Action</label>
              <select className="select" value={outlierAction} onChange={(e) => setOutlierAction(e.target.value)}>
                <option value="cap">Cap</option>
                <option value="remove">Remove</option>
              </select>
            </div>
          </div>
          <button
            className="btn-primary w-full justify-center"
            disabled={outlierCols.length === 0}
            onClick={() => run('outliers', () => cleanHandleOutliers(datasetId, outlierCols, outlierMethod, outlierAction))}
          >
            {L('outliers')} Apply
          </button>
        </Section>

        {/* Data types */}
        <Section title="Change Data Type" icon={ArrowRightLeft}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="label">Column</label>
              <select className="select" value={dtypeCol} onChange={(e) => setDtypeCol(e.target.value)}>
                <option value="">Select…</option>
                {cols.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">New Type</label>
              <select className="select" value={dtype} onChange={(e) => setDtype(e.target.value)}>
                {['int', 'float', 'str', 'datetime', 'bool', 'category'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <button
            className="btn-primary w-full justify-center"
            disabled={!dtypeCol}
            onClick={() => run('dtype', () => cleanChangeDtype(datasetId, dtypeCol, dtype))}
          >
            {L('dtype')} Convert
          </button>
        </Section>

        {/* Normalize */}
        <Section title="Normalize / Standardize" icon={Minimize2}>
          <label className="label">Columns</label>
          <div className="max-h-28 overflow-y-auto mb-2 space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
            {numericCols.map((c) => (
              <label key={c} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={normCols.includes(c)} onChange={(e) => {
                  setNormCols(e.target.checked ? [...normCols, c] : normCols.filter((x) => x !== c))
                }} className="accent-primary-600" />
                <span className="text-xs text-slate-700 dark:text-slate-300">{c}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setNormMethod('minmax')} className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${normMethod === 'minmax' ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400'}`}>Min-Max</button>
            <button onClick={() => setNormMethod('zscore')} className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${normMethod === 'zscore' ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400'}`}>Z-score</button>
          </div>
          <button
            className="btn-primary w-full justify-center"
            disabled={normCols.length === 0}
            onClick={() => run('norm', () => cleanNormalize(datasetId, normCols, normMethod))}
          >
            {L('norm')} Normalize
          </button>
        </Section>

        {/* Encode */}
        <Section title="Encode Categorical" icon={Hash}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="label">Column</label>
              <select className="select" value={encodeCol} onChange={(e) => setEncodeCol(e.target.value)}>
                <option value="">Select…</option>
                {catCols.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Method</label>
              <select className="select" value={encodeMethod} onChange={(e) => setEncodeMethod(e.target.value)}>
                <option value="label">Label</option>
                <option value="onehot">One-Hot</option>
              </select>
            </div>
          </div>
          <button
            className="btn-primary w-full justify-center"
            disabled={!encodeCol}
            onClick={() => run('encode', () => cleanEncodeCategorical(datasetId, encodeCol, encodeMethod))}
          >
            {L('encode')} Encode
          </button>
        </Section>

        {/* Drop columns */}
        <Section title="Drop Columns" icon={Trash2}>
          <div className="max-h-32 overflow-y-auto mb-2 space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
            {cols.map((c) => (
              <label key={c} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dropCols.includes(c)} onChange={(e) => {
                  setDropCols(e.target.checked ? [...dropCols, c] : dropCols.filter((x) => x !== c))
                }} className="accent-red-500" />
                <span className="text-xs text-slate-700 dark:text-slate-300">{c}</span>
              </label>
            ))}
          </div>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors w-full justify-center disabled:opacity-50"
            disabled={dropCols.length === 0}
            onClick={() => run('drop', () => cleanDropColumns(datasetId, dropCols))}
          >
            {L('drop')} Drop {dropCols.length > 0 ? `${dropCols.length} column(s)` : 'Selected'}
          </button>
        </Section>

        {/* Text */}
        <Section title="Text Cleaning" icon={Type}>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Trim leading/trailing whitespace from all text columns.</p>
          <button
            className="btn-primary w-full justify-center"
            onClick={() => run('trim', () => cleanTrimText(datasetId))}
          >
            {L('trim')} Trim Whitespace
          </button>
        </Section>
      </div>

      {/* Right: log + suggestions */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* AI Suggestions */}
        {suggestions?.suggestions && suggestions.suggestions.length > 0 && (
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-primary-50 to-violet-50 dark:from-primary-900/10 dark:to-violet-900/10">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-primary-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Smart Suggestions</h3>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
              {suggestions.suggestions.map((s, i) => (
                <div key={i} className={`rounded-lg border p-3 ${severityColor(s.severity)}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-slate-700 dark:text-slate-300">{s.message}</p>
                    {s.severity === 'error' && <AlertTriangle size={12} className="text-red-500 flex-shrink-0 mt-0.5" />}
                    {s.severity === 'warning' && <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cleaning history */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate p-4">
          <h3 className="section-header">Cleaning History</h3>
          {!history || history.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">No cleaning operations applied yet</p>
          ) : (
            <div className="space-y-2">
              {[...history].reverse().map((h, i) => (
                <div key={h.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 font-mono">{h.operation}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(h.ts).toLocaleTimeString()}</p>
                  </div>
                  {i === 0 && <span className="badge-blue text-xs">Latest</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

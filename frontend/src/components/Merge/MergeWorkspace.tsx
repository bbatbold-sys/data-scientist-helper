import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { GitMerge, Eye, Plus, ArrowRight, Rows, Columns } from 'lucide-react'
import toast from 'react-hot-toast'
import { mergeDatasets, previewMerge, concatDatasets, previewConcat } from '../../api/client'
import type { ConcatParams } from '../../api/client'
import { useStore } from '../../store/useStore'
import type { MergeParams } from '../../types'

const JOIN_TYPES = [
  { id: 'inner', label: 'Inner Join', desc: 'Only matching rows', color: 'bg-blue-500' },
  { id: 'left', label: 'Left Join', desc: 'All left + matching right', color: 'bg-green-500' },
  { id: 'right', label: 'Right Join', desc: 'Matching left + all right', color: 'bg-purple-500' },
  { id: 'outer', label: 'Outer Join', desc: 'All rows from both', color: 'bg-amber-500' },
] as const

function JoinDiagram({ how }: { how: string }) {
  const colors: Record<string, { l: string; r: string; o: string }> = {
    inner: { l: 'fill-blue-200', r: 'fill-blue-200', o: 'fill-blue-500' },
    left: { l: 'fill-green-400', r: 'fill-green-200', o: 'fill-green-500' },
    right: { l: 'fill-purple-200', r: 'fill-purple-400', o: 'fill-purple-500' },
    outer: { l: 'fill-amber-400', r: 'fill-amber-400', o: 'fill-amber-500' },
  }
  const c = colors[how] || colors.inner
  return (
    <svg width={80} height={48} viewBox="0 0 80 48" className="mx-auto">
      <circle cx={28} cy={24} r={20} className={`${c.l} opacity-70`} />
      <circle cx={52} cy={24} r={20} className={`${c.r} opacity-70`} />
      <text x={40} y={28} textAnchor="middle" fontSize={8} className="fill-white font-bold">{how.toUpperCase()}</text>
    </svg>
  )
}

export default function MergeWorkspace() {
  const { datasets, addDataset } = useStore()
  const qc = useQueryClient()

  const [mode, setMode] = useState<'sql' | 'concat'>('sql')

  // SQL join state
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const [leftKey, setLeftKey] = useState('')
  const [rightKey, setRightKey] = useState('')
  const [how, setHow] = useState<'inner' | 'left' | 'right' | 'outer'>('inner')
  const [newName, setNewName] = useState('merged_dataset')

  // Concat state
  const [cLeftId, setCLeftId] = useState('')
  const [cRightId, setCRightId] = useState('')
  const [axis, setAxis] = useState<'rows' | 'columns'>('rows')
  const [cNewName, setCNewName] = useState('concatenated_dataset')

  const [preview, setPreview] = useState<{ data: Record<string, unknown>[]; columns: string[]; total_rows: number } | null>(null)
  const [loading, setLoading] = useState<'preview' | 'merge' | null>(null)

  const leftDs = datasets.find((d) => d.id === leftId)
  const rightDs = datasets.find((d) => d.id === rightId)
  const cLeftDs = datasets.find((d) => d.id === cLeftId)
  const cRightDs = datasets.find((d) => d.id === cRightId)

  const sqlParams: MergeParams = { left_id: leftId, right_id: rightId, left_key: leftKey, right_key: rightKey, how, new_name: newName }
  const concatParams: ConcatParams = { left_id: cLeftId, right_id: cRightId, axis, new_name: cNewName }

  const handlePreview = async () => {
    if (mode === 'sql') {
      if (!leftId || !rightId || !leftKey || !rightKey) { toast.error('Please select both datasets and join keys'); return }
      setLoading('preview')
      try { setPreview(await previewMerge(sqlParams)) }
      catch (e: unknown) { const err = e as { response?: { data?: { detail?: string } } }; toast.error(err?.response?.data?.detail || 'Preview failed') }
      finally { setLoading(null) }
    } else {
      if (!cLeftId || !cRightId) { toast.error('Please select both datasets'); return }
      setLoading('preview')
      try { setPreview(await previewConcat(concatParams)) }
      catch (e: unknown) { const err = e as { response?: { data?: { detail?: string } } }; toast.error(err?.response?.data?.detail || 'Preview failed') }
      finally { setLoading(null) }
    }
  }

  const handleMerge = async () => {
    if (mode === 'sql') {
      if (!leftId || !rightId || !leftKey || !rightKey) { toast.error('Please fill all required fields'); return }
      setLoading('merge')
      try {
        const result = await mergeDatasets(sqlParams)
        addDataset(result)
        qc.invalidateQueries({ queryKey: ['datasets'] })
        toast.success(`Merged dataset created: ${result.name}`)
        setPreview(null)
      } catch (e: unknown) { const err = e as { response?: { data?: { detail?: string } } }; toast.error(err?.response?.data?.detail || 'Merge failed') }
      finally { setLoading(null) }
    } else {
      if (!cLeftId || !cRightId) { toast.error('Please select both datasets'); return }
      setLoading('merge')
      try {
        const result = await concatDatasets(concatParams)
        addDataset(result)
        qc.invalidateQueries({ queryKey: ['datasets'] })
        toast.success(`Concatenated dataset created: ${result.name}`)
        setPreview(null)
      } catch (e: unknown) { const err = e as { response?: { data?: { detail?: string } } }; toast.error(err?.response?.data?.detail || 'Concatenation failed') }
      finally { setLoading(null) }
    }
  }

  const switchMode = (m: 'sql' | 'concat') => { setMode(m); setPreview(null) }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Config panel */}
      <div className="w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 overflow-y-auto scrollbar-thin p-4 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2 mb-4">
          <GitMerge size={16} className="text-primary-500" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Combine Datasets</h2>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden mb-5">
          <button
            onClick={() => switchMode('sql')}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${mode === 'sql' ? 'bg-primary-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            SQL Join
          </button>
          <button
            onClick={() => switchMode('concat')}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${mode === 'concat' ? 'bg-primary-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Concatenate
          </button>
        </div>

        {datasets.length < 2 && (
          <div className="text-center py-8 px-4">
            <Plus size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400 dark:text-slate-500">Upload at least 2 datasets to combine</p>
          </div>
        )}

        {datasets.length >= 2 && mode === 'sql' && (
          <div className="space-y-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl">
              <label className="label text-green-700 dark:text-green-400">Left Dataset</label>
              <select className="select mb-2" value={leftId} onChange={(e) => { setLeftId(e.target.value); setLeftKey('') }}>
                <option value="">Select dataset…</option>
                {datasets.filter((d) => d.id !== rightId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {leftDs && (
                <div>
                  <label className="label text-green-700 dark:text-green-400">Join Key</label>
                  <select className="select" value={leftKey} onChange={(e) => setLeftKey(e.target.value)}>
                    <option value="">Select column…</option>
                    {leftDs.columns.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="label">Join Type</label>
              <div className="grid grid-cols-2 gap-2">
                {JOIN_TYPES.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => setHow(j.id)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      how === j.id
                        ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${j.color} mb-1`} />
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{j.label}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight">{j.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl">
              <label className="label text-purple-700 dark:text-purple-400">Right Dataset</label>
              <select className="select mb-2" value={rightId} onChange={(e) => { setRightId(e.target.value); setRightKey('') }}>
                <option value="">Select dataset…</option>
                {datasets.filter((d) => d.id !== leftId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {rightDs && (
                <div>
                  <label className="label text-purple-700 dark:text-purple-400">Join Key</label>
                  <select className="select" value={rightKey} onChange={(e) => setRightKey(e.target.value)}>
                    <option value="">Select column…</option>
                    {rightDs.columns.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="label">New Dataset Name</label>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="merged_dataset" />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePreview}
                disabled={!leftId || !rightId || !leftKey || !rightKey || !!loading}
                className="btn-secondary flex-1 justify-center"
              >
                {loading === 'preview' ? <span className="inline-block w-3 h-3 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" /> : <Eye size={14} />}
                Preview
              </button>
              <button
                onClick={handleMerge}
                disabled={!leftId || !rightId || !leftKey || !rightKey || !!loading}
                className="btn-primary flex-1 justify-center"
              >
                {loading === 'merge' ? <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={14} />}
                Merge
              </button>
            </div>
          </div>
        )}

        {datasets.length >= 2 && mode === 'concat' && (
          <div className="space-y-4">
            {/* Axis selector */}
            <div>
              <label className="label">Concatenate By</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAxis('rows')}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    axis === 'rows'
                      ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Rows size={18} className="mx-auto mb-1 text-slate-500" />
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">By Rows</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight">Stack datasets vertically</p>
                </button>
                <button
                  onClick={() => setAxis('columns')}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    axis === 'columns'
                      ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Columns size={18} className="mx-auto mb-1 text-slate-500" />
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">By Columns</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight">Append columns side by side</p>
                </button>
              </div>
            </div>

            <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl">
              <label className="label text-green-700 dark:text-green-400">First Dataset</label>
              <select className="select" value={cLeftId} onChange={(e) => setCLeftId(e.target.value)}>
                <option value="">Select dataset…</option>
                {datasets.filter((d) => d.id !== cRightId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {cLeftDs && <p className="text-xs text-green-600 dark:text-green-400 mt-1">{cLeftDs.rows} rows · {cLeftDs.columns.length} cols</p>}
            </div>

            <div className="p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl">
              <label className="label text-purple-700 dark:text-purple-400">Second Dataset</label>
              <select className="select" value={cRightId} onChange={(e) => setCRightId(e.target.value)}>
                <option value="">Select dataset…</option>
                {datasets.filter((d) => d.id !== cLeftId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {cRightDs && <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">{cRightDs.rows} rows · {cRightDs.columns.length} cols</p>}
            </div>

            <div>
              <label className="label">New Dataset Name</label>
              <input className="input" value={cNewName} onChange={(e) => setCNewName(e.target.value)} placeholder="concatenated_dataset" />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePreview}
                disabled={!cLeftId || !cRightId || !!loading}
                className="btn-secondary flex-1 justify-center"
              >
                {loading === 'preview' ? <span className="inline-block w-3 h-3 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" /> : <Eye size={14} />}
                Preview
              </button>
              <button
                onClick={handleMerge}
                disabled={!cLeftId || !cRightId || !!loading}
                className="btn-primary flex-1 justify-center"
              >
                {loading === 'merge' ? <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={14} />}
                Concat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Diagram */}
        <div className="flex items-center justify-center gap-6 p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {mode === 'sql' ? (
            <>
              <div className="text-center">
                <div className="w-16 h-10 bg-green-100 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700 rounded-lg flex items-center justify-center mb-1">
                  <span className="text-xs font-medium text-green-700 dark:text-green-400 truncate px-1">{leftDs?.name || 'Left'}</span>
                </div>
                {leftKey && <span className="badge-green text-xs">{leftKey}</span>}
              </div>
              <div className="flex flex-col items-center gap-1">
                <JoinDiagram how={how} />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{how} join</span>
              </div>
              <div className="text-center">
                <div className="w-16 h-10 bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-300 dark:border-purple-700 rounded-lg flex items-center justify-center mb-1">
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-400 truncate px-1">{rightDs?.name || 'Right'}</span>
                </div>
                {rightKey && <span className="badge-purple text-xs">{rightKey}</span>}
              </div>
              <ArrowRight size={16} className="text-slate-400" />
              <div className="text-center">
                <div className="w-16 h-10 bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-300 dark:border-primary-700 rounded-lg flex items-center justify-center mb-1">
                  <span className="text-xs font-medium text-primary-700 dark:text-primary-400 truncate px-1">{newName || 'Result'}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="w-16 h-10 bg-green-100 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700 rounded-lg flex items-center justify-center mb-1">
                  <span className="text-xs font-medium text-green-700 dark:text-green-400 truncate px-1">{cLeftDs?.name || 'First'}</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                {axis === 'rows'
                  ? <Rows size={24} className="text-primary-400" />
                  : <Columns size={24} className="text-primary-400" />}
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">by {axis}</span>
              </div>
              <div className="text-center">
                <div className="w-16 h-10 bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-300 dark:border-purple-700 rounded-lg flex items-center justify-center mb-1">
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-400 truncate px-1">{cRightDs?.name || 'Second'}</span>
                </div>
              </div>
              <ArrowRight size={16} className="text-slate-400" />
              <div className="text-center">
                <div className="w-16 h-10 bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-300 dark:border-primary-700 rounded-lg flex items-center justify-center mb-1">
                  <span className="text-xs font-medium text-primary-700 dark:text-primary-400 truncate px-1">{cNewName || 'Result'}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Preview table */}
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate p-4">
          {!preview ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <GitMerge size={36} className="text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-400 dark:text-slate-500 text-sm">
                {mode === 'sql' ? 'Configure merge settings and click Preview' : 'Select datasets and click Preview'}
              </p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Preview ({preview.total_rows.toLocaleString()} total rows)
                </h3>
                <span className="badge-blue">{preview.columns.length} columns</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="data-table">
                  <thead>
                    <tr>
                      {preview.columns.map((c) => <th key={c}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.data.map((row, i) => (
                      <tr key={i}>
                        {preview.columns.map((c) => (
                          <td key={c} className={row[c] === null ? 'null-cell' : ''}>
                            {row[c] === null ? <span className="italic text-red-400">null</span> : String(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

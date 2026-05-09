import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, TrendingUp, AlertTriangle, Lightbulb, Star, Loader2,
  Hash, Type, Calendar, BarChart2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { analyzeDataset, getColumnStats } from '../../api/client'
import type { AIInsight, ColumnStat } from '../../types'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'

interface Props { datasetId: string }

function QualityGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'
  const label = pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : pct >= 40 ? 'Fair' : 'Poor'
  const r = 56, cx = 68, cy = 68
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <div className="flex flex-col items-center">
      <svg width={136} height={136} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} stroke="#e2e8f0" strokeWidth={12} fill="none" />
        <circle
          cx={cx} cy={cy} r={r}
          stroke={color}
          strokeWidth={12}
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="mt-[-100px] text-center">
        <div className="text-3xl font-bold" style={{ color }}>{pct}</div>
        <div className="text-sm font-medium" style={{ color }}>{label}</div>
        <div className="text-xs text-slate-400 mt-0.5">Quality Score</div>
      </div>
    </div>
  )
}

function ColStatCard({ s }: { s: ColumnStat }) {
  const isNum = s.dtype.includes('int') || s.dtype.includes('float')
  const isDate = s.dtype.includes('datetime')
  return (
    <div className="card p-3">
      <div className="flex items-start gap-2 mb-2">
        <div className="w-6 h-6 rounded bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
          {isNum ? <Hash size={12} className="text-primary-600" /> : isDate ? <Calendar size={12} className="text-purple-600" /> : <Type size={12} className="text-green-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{s.column}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{s.dtype}</p>
        </div>
        {s.null_pct > 0 && (
          <span className={`badge text-xs ${s.null_pct > 20 ? 'badge-red' : 'badge-yellow'}`}>
            {s.null_pct}% null
          </span>
        )}
      </div>
      {isNum ? (
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="bg-slate-50 dark:bg-slate-800 rounded p-1.5">
            <p className="text-slate-400 text-xs">Min</p>
            <p className="font-mono font-medium text-slate-700 dark:text-slate-300">{typeof s.min === 'number' ? s.min.toFixed(3) : '—'}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded p-1.5">
            <p className="text-slate-400 text-xs">Max</p>
            <p className="font-mono font-medium text-slate-700 dark:text-slate-300">{typeof s.max === 'number' ? s.max.toFixed(3) : '—'}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded p-1.5">
            <p className="text-slate-400 text-xs">Mean</p>
            <p className="font-mono font-medium text-slate-700 dark:text-slate-300">{s.mean?.toFixed(3) ?? '—'}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded p-1.5">
            <p className="text-slate-400 text-xs">Std</p>
            <p className="font-mono font-medium text-slate-700 dark:text-slate-300">{s.std?.toFixed(3) ?? '—'}</p>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-slate-400 mb-1">{s.unique} unique values</p>
          {s.top_values && (
            <div className="space-y-0.5">
              {s.top_values.slice(0, 3).map((tv) => (
                <div key={tv.value} className="flex items-center gap-1">
                  <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-primary-400 h-full rounded-full" style={{ width: `${(tv.count / (s.top_values![0]?.count || 1)) * 100}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-20 truncate">{tv.value}</span>
                  <span className="text-xs text-slate-400">{tv.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AnalysisWorkspace({ datasetId }: Props) {
  const [insight, setInsight] = useState<AIInsight | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  const { data: colStats } = useQuery({
    queryKey: ['col-stats', datasetId],
    queryFn: () => getColumnStats(datasetId),
    staleTime: 60_000,
  })

  const missingData = colStats?.filter((s) => s.null_pct > 0).map((s) => ({ name: s.column, pct: s.null_pct })) ?? []

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const result = await analyzeDataset(datasetId)
      setInsight(result)
    } catch {
      toast.error('Analysis failed. Make sure ANTHROPIC_API_KEY is set in the backend.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-slate p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-primary-500" />
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">AI Analysis</h2>
        </div>
        <button onClick={handleAnalyze} disabled={analyzing} className="btn-primary">
          {analyzing ? <><Loader2 size={14} className="animate-spin" /> Analyzing…</> : <><Star size={14} /> Run Full Analysis</>}
        </button>
      </div>

      <AnimatePresence>
        {insight && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Quality + Summary */}
            <div className="card p-6 flex gap-6 items-start">
              <QualityGauge score={insight.quality_score} />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Dataset Summary</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{insight.summary}</p>
              </div>
            </div>

            {/* Insights + Warnings + Recommendations */}
            <div className="grid grid-cols-3 gap-4">
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={14} className="text-green-500" />
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Insights</h3>
                </div>
                <ul className="space-y-2">
                  {insight.insights.map((ins, i) => (
                    <li key={i} className="flex gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>
                      <span>{ins}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} className="text-amber-500" />
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Warnings</h3>
                </div>
                <ul className="space-y-2">
                  {insight.warnings.map((w, i) => (
                    <li key={i} className="flex gap-2 text-xs text-amber-600 dark:text-amber-400">
                      <span className="flex-shrink-0">⚠</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={14} className="text-blue-500" />
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Recommendations</h3>
                </div>
                <ul className="space-y-2">
                  {insight.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="text-blue-500 flex-shrink-0">→</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Missing values chart */}
      {missingData.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 size={14} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Missing Values by Column</h3>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={missingData} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
              <Tooltip formatter={(v) => [`${v}%`, 'Missing']} />
              <Bar dataKey="pct" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Column stats grid */}
      {colStats && (
        <div>
          <h3 className="section-header">Column Statistics</h3>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {colStats.map((s) => <ColStatCard key={s.column} s={s} />)}
          </div>
        </div>
      )}
    </div>
  )
}

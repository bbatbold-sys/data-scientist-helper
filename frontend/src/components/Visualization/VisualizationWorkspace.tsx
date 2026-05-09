import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'
import {
  BarChart2, TrendingUp, CircleDot, PieChart as PieIcon, Activity,
  Grid, Layers, GitBranch, Zap, type LucideIcon,
} from 'lucide-react'
import { previewDataset, getColumnStats } from '../../api/client'
import type { ChartType } from '../../types'

interface Props { datasetId: string }

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6']

const CHART_TYPES: { id: ChartType; label: string; icon: LucideIcon; desc: string }[] = [
  { id: 'bar', label: 'Bar', icon: BarChart2, desc: 'Compare categories' },
  { id: 'line', label: 'Line', icon: TrendingUp, desc: 'Show trends' },
  { id: 'scatter', label: 'Scatter', icon: CircleDot, desc: 'Find correlations' },
  { id: 'histogram', label: 'Histogram', icon: BarChart2, desc: 'Distribution' },
  { id: 'pie', label: 'Pie', icon: PieIcon, desc: 'Part of whole' },
  { id: 'correlation', label: 'Correlation', icon: Grid, desc: 'Column heatmap' },
  { id: 'box', label: 'Box Plot', icon: Layers, desc: 'Outlier view' },
  { id: 'timeseries', label: 'Time Series', icon: Activity, desc: 'Over time' },
  { id: 'heatmap', label: 'Heatmap', icon: GitBranch, desc: 'Value intensity' },
]

function computeHistogram(values: number[], bins = 20) {
  const clean = values.filter((v) => typeof v === 'number' && !isNaN(v))
  if (!clean.length) return []
  const min = Math.min(...clean), max = Math.max(...clean)
  const step = (max - min) / bins || 1
  const buckets = Array.from({ length: bins }, (_, i) => ({
    bin: `${(min + i * step).toFixed(2)}`,
    count: 0,
  }))
  clean.forEach((v) => {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1)
    buckets[idx].count++
  })
  return buckets
}

function computeCorrelation(rows: Record<string, unknown>[], cols: string[]) {
  const matrix: { x: string; y: string; value: number }[] = []
  const getVals = (col: string) => rows.map((r) => Number(r[col])).filter((v) => !isNaN(v))
  const corr = (a: number[], b: number[]) => {
    const n = Math.min(a.length, b.length)
    if (!n) return 0
    const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n
    const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n
    let num = 0, da = 0, db = 0
    for (let i = 0; i < n; i++) {
      num += (a[i] - meanA) * (b[i] - meanB)
      da += (a[i] - meanA) ** 2
      db += (b[i] - meanB) ** 2
    }
    return da && db ? num / Math.sqrt(da * db) : 0
  }
  cols.forEach((cx) => cols.forEach((cy) => {
    matrix.push({ x: cx, y: cy, value: parseFloat(corr(getVals(cx), getVals(cy)).toFixed(2)) })
  }))
  return matrix
}

function CorrelationMatrix({ data, cols }: { data: { x: string; y: string; value: number }[]; cols: string[] }) {
  if (!cols.length) return null
  const cellSize = Math.min(60, Math.floor(500 / cols.length))
  return (
    <div className="overflow-auto">
      <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${cols.length}, ${cellSize}px)` }}>
        <div />
        {cols.map((c) => (
          <div key={c} className="text-xs text-slate-400 text-center truncate px-1 py-1" style={{ fontSize: 10 }}>{c}</div>
        ))}
        {cols.map((row) => (
          <>
            <div key={`row-${row}`} className="text-xs text-slate-400 flex items-center pr-1 truncate" style={{ fontSize: 10 }}>{row}</div>
            {cols.map((col) => {
              const cell = data.find((d) => d.x === row && d.y === col)
              const v = cell?.value ?? 0
              const intensity = Math.abs(v)
              const r = v > 0 ? 99 : 239, g = v > 0 ? 102 : 68, b = v > 0 ? 241 : 68
              return (
                <div
                  key={`${row}-${col}`}
                  title={`${row} × ${col}: ${v}`}
                  style={{
                    width: cellSize, height: cellSize,
                    background: `rgba(${r},${g},${b},${intensity * 0.8 + 0.1})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: intensity > 0.5 ? 'white' : '#64748b',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {v.toFixed(1)}
                </div>
              )
            })}
          </>
        ))}
      </div>
    </div>
  )
}

export default function VisualizationWorkspace({ datasetId }: Props) {
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [xCol, setXCol] = useState('')
  const [yCols, setYCols] = useState<string[]>([])
  const [chartTitle, setChartTitle] = useState('')
  const [rowLimit, setRowLimit] = useState(500)

  const { data: colStats } = useQuery({
    queryKey: ['col-stats', datasetId],
    queryFn: () => getColumnStats(datasetId),
    staleTime: 60_000,
  })

  const { data: previewData } = useQuery({
    queryKey: ['preview-viz', datasetId, rowLimit],
    queryFn: () => previewDataset(datasetId, 1, rowLimit),
    enabled: !!colStats,
  })

  const numericCols = useMemo(() => colStats?.filter((s) => s.dtype.includes('int') || s.dtype.includes('float')).map((s) => s.column) ?? [], [colStats])
  const allCols = useMemo(() => colStats?.map((s) => s.column) ?? [], [colStats])
  const rows = previewData?.data ?? []

  const chartData = useMemo(() => {
    if (!xCol || !rows.length) return []
    if (chartType === 'histogram') {
      const vals = rows.map((r) => Number(r[xCol])).filter((v) => !isNaN(v))
      return computeHistogram(vals)
    }
    if (chartType === 'pie') {
      const counts: Record<string, number> = {}
      rows.forEach((r) => { const v = String(r[xCol]); counts[v] = (counts[v] || 0) + 1 })
      return Object.entries(counts).slice(0, 12).map(([name, value]) => ({ name, value }))
    }
    if (chartType === 'correlation') {
      return computeCorrelation(rows, numericCols.slice(0, 10))
    }
    return rows.slice(0, 200).map((r) => {
      const obj: Record<string, unknown> = { [xCol]: r[xCol] }
      yCols.forEach((y) => { obj[y] = r[y] })
      return obj
    })
  }, [rows, xCol, yCols, chartType, numericCols])

  const renderChart = () => {
    if (!xCol && chartType !== 'correlation') return (
      <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
        Select X axis column to render chart
      </div>
    )

    const common = {
      data: chartData,
      margin: { top: 20, right: 20, bottom: 40, left: 20 },
    }

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart {...common}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={xCol} tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {(yCols.length ? yCols : [xCol]).map((col, i) => (
                <Bar key={col} dataKey={col} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )

      case 'line':
      case 'timeseries':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart {...common}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={xCol} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {(yCols.length ? yCols : numericCols.slice(0, 3)).map((col, i) => (
                <Line key={col} type="monotone" dataKey={col} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart {...common}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={xCol} name={xCol} tick={{ fontSize: 11 }} />
              <YAxis dataKey={yCols[0] || numericCols[1] || ''} name={yCols[0]} tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={chartData} fill={COLORS[0]} opacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        )

      case 'histogram':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="bin" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={2} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill={COLORS[0]} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" outerRadius="70%" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'correlation':
        return <CorrelationMatrix data={chartData as { x: string; y: string; value: number }[]} cols={numericCols.slice(0, 10)} />

      default:
        return <div className="text-slate-400 text-center mt-8">Chart type not supported yet</div>
    }
  }

  const toggleYCol = (col: string) =>
    setYCols((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Config panel */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 overflow-y-auto scrollbar-thin p-4 bg-white dark:bg-slate-900">
        <p className="section-header">Chart Type</p>
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {CHART_TYPES.map((ct) => {
            const Icon = ct.icon
            return (
              <button
                key={ct.id}
                onClick={() => setChartType(ct.id)}
                title={ct.desc}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                  chartType === ct.id
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary-300'
                }`}
              >
                <Icon size={16} />
                {ct.label}
              </button>
            )
          })}
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Chart Title (optional)</label>
            <input className="input text-xs" placeholder="My Chart" value={chartTitle} onChange={(e) => setChartTitle(e.target.value)} />
          </div>

          <div>
            <label className="label">X Axis / Category</label>
            <select className="select" value={xCol} onChange={(e) => setXCol(e.target.value)}>
              <option value="">Select column…</option>
              {allCols.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          {!['pie', 'histogram', 'correlation'].includes(chartType) && (
            <div>
              <label className="label">Y Axis / Values (multi-select)</label>
              <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-2 space-y-1">
                {numericCols.map((c) => (
                  <label key={c} className="flex items-center gap-2 cursor-pointer py-0.5">
                    <input type="checkbox" checked={yCols.includes(c)} onChange={() => toggleYCol(c)} className="accent-primary-600" />
                    <span className="text-xs text-slate-700 dark:text-slate-300">{c}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="label">Data rows: {rowLimit.toLocaleString()}</label>
            <input
              type="range" min={100} max={5000} step={100} value={rowLimit}
              onChange={(e) => setRowLimit(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-0.5">
              <span>100</span><span>5000</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 flex flex-col overflow-hidden p-4">
        {chartTitle && (
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 text-center mb-3">{chartTitle}</h3>
        )}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 overflow-auto">
          {rows.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
              <div className="text-center">
                <Zap size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p>Loading data…</p>
              </div>
            </div>
          ) : (
            <div style={{ height: '100%', minHeight: 400 }}>
              {renderChart()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

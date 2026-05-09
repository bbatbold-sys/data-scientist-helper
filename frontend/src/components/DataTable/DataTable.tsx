import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Hash, Type, Calendar } from 'lucide-react'
import { previewDataset, getColumnStats } from '../../api/client'
import { useStore } from '../../store/useStore'
import { exportCsv, exportExcel, exportJson, exportPdfReport } from '../../api/client'
import { Download } from 'lucide-react'

interface Props { datasetId: string }

function TypeIcon({ dtype }: { dtype: string }) {
  if (dtype.includes('int') || dtype.includes('float')) return <Hash size={10} className="text-blue-400" />
  if (dtype.includes('datetime')) return <Calendar size={10} className="text-purple-400" />
  return <Type size={10} className="text-green-400" />
}

function Skeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-1 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-8 rounded" />
      ))}
    </div>
  )
}

export default function DataTable({ datasetId }: Props) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const { datasets } = useStore()
  const ds = datasets.find((d) => d.id === datasetId)

  const { data, isLoading } = useQuery({
    queryKey: ['preview', datasetId, page, pageSize, search, sortCol, sortDir],
    queryFn: () => previewDataset(datasetId, page, pageSize, search, sortCol, sortDir),
    placeholderData: (prev) => prev,
  })

  const { data: colStats } = useQuery({
    queryKey: ['col-stats', datasetId],
    queryFn: () => getColumnStats(datasetId),
    staleTime: 60_000,
  })

  const statsByCol = useMemo(() => {
    const m: Record<string, { dtype: string; null_pct: number }> = {}
    colStats?.forEach((s) => { m[s.column] = { dtype: s.dtype, null_pct: s.null_pct } })
    return m
  }, [colStats])

  const columns = useMemo(() => {
    if (!data?.columns?.length) return []
    const helper = createColumnHelper<Record<string, unknown>>()
    return data.columns.map((col) =>
      helper.accessor(col, {
        id: col,
        header: () => (
          <div
            className="flex items-center gap-1 cursor-pointer"
            onClick={() => {
              if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
              else { setSortCol(col); setSortDir('asc') }
            }}
          >
            <TypeIcon dtype={statsByCol[col]?.dtype || 'object'} />
            <span className="truncate max-w-[120px]">{col}</span>
            {sortCol === col ? (
              sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
            ) : null}
          </div>
        ),
        cell: ({ getValue }) => {
          const val = getValue()
          if (val === null || val === undefined || val === '')
            return <span className="null-cell text-red-400 italic">null</span>
          const s = String(val)
          return <span title={s}>{s.length > 50 ? s.slice(0, 50) + '…' : s}</span>
        },
      })
    )
  }, [data?.columns, sortCol, sortDir, statsByCol])

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: data ? Math.ceil(data.total_rows / pageSize) : 0,
  })

  const totalPages = data ? Math.ceil(data.total_rows / pageSize) : 0

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-8 text-xs"
            placeholder="Search all columns…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            className="select w-auto text-xs py-1.5"
          >
            {[25, 50, 100, 200].map((n) => <option key={n}>{n}</option>)}
          </select>
          <span className="text-xs text-slate-400">rows</span>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
          {ds && (
            <div className="flex items-center gap-1">
              <button onClick={() => exportCsv(datasetId, ds.name)} className="btn-ghost py-1 px-2 text-xs">CSV</button>
              <button onClick={() => exportExcel(datasetId, ds.name)} className="btn-ghost py-1 px-2 text-xs">Excel</button>
              <button onClick={() => exportJson(datasetId, ds.name)} className="btn-ghost py-1 px-2 text-xs">JSON</button>
              <button onClick={() => exportPdfReport(datasetId, ds.name)} className="btn-ghost py-1 px-2 text-xs">
                <Download size={12} /> PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Column stats bar */}
      {colStats && colStats.length > 0 && (
        <div className="flex overflow-x-auto bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          {colStats.slice(0, 20).map((s) => (
            <div key={s.column} className="flex-shrink-0 px-3 py-1.5 border-r border-slate-200 dark:border-slate-700 min-w-[80px]">
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate max-w-[100px]">{s.column}</div>
              <div className="text-xs text-slate-400 dark:text-slate-500">{s.null_pct}% null</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate">
        {isLoading ? (
          <Skeleton />
        ) : (
          <table className="data-table">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  <th className="w-10 text-center">#</th>
                  {hg.headers.map((h) => (
                    <th key={h.id} style={{ minWidth: 80, maxWidth: 200 }}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr key={row.id}>
                  <td className="text-center text-slate-400 font-mono">{(page - 1) * pageSize + i + 1}</td>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cell.getValue() === null || cell.getValue() === undefined ? 'null-cell' : ''}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
        <span className="text-xs text-slate-400">
          {data ? `${data.total_rows.toLocaleString()} total rows` : '—'}
          {search && ` (filtered)`}
        </span>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost py-1 px-2"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-slate-600 dark:text-slate-400">
            Page {page} / {totalPages || 1}
          </span>
          <button
            className="btn-ghost py-1 px-2"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

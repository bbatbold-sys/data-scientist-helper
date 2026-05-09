import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Database, Plus, ChevronLeft, ChevronRight, Trash2, Eye, Sparkles,
  BarChart2, Download, Edit2, AlertTriangle, Copy, Moon, Sun,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { deleteDataset, exportCsv } from '../../api/client'
import { useStore } from '../../store/useStore'
import type { DatasetInfo } from '../../types'
import UploadModal from '../Upload/UploadModal'

export default function Sidebar() {
  const { datasets, activeDatasetId, sidebarCollapsed, isDarkMode, setActiveDataset, setActiveTab, removeDataset, toggleSidebar, toggleDarkMode, updateDataset } = useStore()
  const [showUpload, setShowUpload] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const qc = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: deleteDataset,
    onSuccess: (_, id) => {
      removeDataset(id)
      toast.success('Dataset deleted')
      qc.invalidateQueries({ queryKey: ['datasets'] })
    },
    onError: () => toast.error('Failed to delete'),
  })

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Delete this dataset?')) deleteMutation.mutate(id)
  }

  const handleOpen = (e: React.MouseEvent, ds: DatasetInfo, tab: 'preview' | 'clean' | 'visualize') => {
    e.stopPropagation()
    setActiveDataset(ds.id)
    setActiveTab(tab)
  }

  const startEdit = (e: React.MouseEvent, ds: DatasetInfo) => {
    e.stopPropagation()
    setEditingId(ds.id)
    setEditName(ds.name)
  }

  const missingPct = (ds: DatasetInfo) =>
    ds.rows * ds.cols > 0 ? ((ds.missing_count / (ds.rows * ds.cols)) * 100).toFixed(1) : '0'

  return (
    <>
      <motion.aside
        animate={{ width: sidebarCollapsed ? 60 : 280 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 flex-shrink-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-1 min-w-0"
              >
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">DS Helper</span>
                <span className="block text-xs text-slate-400 dark:text-slate-500">Data Science Platform</span>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={toggleSidebar} className="btn-ghost p-1 flex-shrink-0">
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Upload button */}
        <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setShowUpload(true)}
            className={`w-full btn-primary justify-center ${sidebarCollapsed ? 'px-2' : ''}`}
          >
            <Plus size={16} />
            {!sidebarCollapsed && 'Upload Dataset'}
          </button>
        </div>

        {/* Dataset list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate py-2">
          {!sidebarCollapsed && datasets.length > 0 && (
            <p className="section-header px-4 pt-2">
              Datasets ({datasets.length})
            </p>
          )}

          {datasets.length === 0 && !sidebarCollapsed && (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <Database size={28} className="text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-400 dark:text-slate-500">No datasets yet</p>
              <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Upload a CSV, Excel or JSON file</p>
            </div>
          )}

          <div className="space-y-1 px-2">
            {datasets.map((ds) => {
              const isActive = activeDatasetId === ds.id
              return (
                <motion.div
                  key={ds.id}
                  layout
                  className={`rounded-xl cursor-pointer transition-all duration-150 group ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                  } ${sidebarCollapsed ? 'p-2' : 'p-3'}`}
                  onClick={() => setActiveDataset(ds.id)}
                >
                  {sidebarCollapsed ? (
                    <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                      <Database size={14} className="text-primary-600 dark:text-primary-400" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Database size={12} className="text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {editingId === ds.id ? (
                            <input
                              className="input text-xs py-0.5 px-1"
                              value={editName}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  // Would call rename API here
                                  setEditingId(null)
                                }
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              autoFocus
                            />
                          ) : (
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{ds.name}</p>
                          )}
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {ds.rows.toLocaleString()} rows × {ds.cols} cols
                          </p>
                        </div>
                      </div>

                      {/* Stats chips */}
                      <div className="flex flex-wrap gap-1 mb-2.5">
                        {ds.missing_count > 0 && (
                          <span className="badge-yellow text-xs">
                            <AlertTriangle size={10} />
                            {missingPct(ds)}% missing
                          </span>
                        )}
                        {ds.duplicate_count > 0 && (
                          <span className="badge-red text-xs">
                            <Copy size={10} />
                            {ds.duplicate_count} dups
                          </span>
                        )}
                        {ds.outlier_count > 0 && (
                          <span className="badge-purple text-xs">{ds.outlier_count} outliers</span>
                        )}
                        <span className="badge-slate text-xs">{ds.memory_mb.toFixed(2)} MB</span>
                        {ds.dtypes_summary.numeric > 0 && (
                          <span className="badge-blue text-xs">{ds.dtypes_summary.numeric} num</span>
                        )}
                        {ds.dtypes_summary.categorical > 0 && (
                          <span className="badge-green text-xs">{ds.dtypes_summary.categorical} cat</span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleOpen(e, ds, 'preview')}
                          className="btn-ghost text-xs py-1 px-2"
                          title="Preview"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          onClick={(e) => handleOpen(e, ds, 'clean')}
                          className="btn-ghost text-xs py-1 px-2"
                          title="Clean"
                        >
                          <Sparkles size={12} />
                        </button>
                        <button
                          onClick={(e) => handleOpen(e, ds, 'visualize')}
                          className="btn-ghost text-xs py-1 px-2"
                          title="Visualize"
                        >
                          <BarChart2 size={12} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); exportCsv(ds.id, ds.name) }}
                          className="btn-ghost text-xs py-1 px-2"
                          title="Download CSV"
                        >
                          <Download size={12} />
                        </button>
                        <button
                          onClick={(e) => startEdit(e, ds)}
                          className="btn-ghost text-xs py-1 px-2"
                          title="Rename"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, ds.id)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-slate-200 dark:border-slate-800">
          <button onClick={toggleDarkMode} className="btn-ghost w-full justify-center">
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            {!sidebarCollapsed && (isDarkMode ? 'Light Mode' : 'Dark Mode')}
          </button>
        </div>
      </motion.aside>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </>
  )
}

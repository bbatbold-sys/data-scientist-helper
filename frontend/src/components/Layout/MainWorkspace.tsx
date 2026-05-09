import { motion, AnimatePresence } from 'framer-motion'
import { Database, Upload, Eye, Sparkles, GitMerge, BarChart2, Brain, type LucideIcon } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { WorkspaceTab } from '../../types'
import DataTable from '../DataTable/DataTable'
import CleaningWorkspace from '../Cleaning/CleaningWorkspace'
import MergeWorkspace from '../Merge/MergeWorkspace'
import VisualizationWorkspace from '../Visualization/VisualizationWorkspace'
import AnalysisWorkspace from '../Analysis/AnalysisWorkspace'

const TABS: { id: WorkspaceTab; label: string; icon: LucideIcon }[] = [
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'clean', label: 'Clean', icon: Sparkles },
  { id: 'merge', label: 'Merge', icon: GitMerge },
  { id: 'visualize', label: 'Visualize', icon: BarChart2 },
  { id: 'analyze', label: 'Analyze', icon: Brain },
]

export default function MainWorkspace() {
  const { activeDatasetId, activeTab, setActiveTab, datasets } = useStore()
  const activeDataset = datasets.find((d) => d.id === activeDatasetId)

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
        {activeDataset && (
          <div className="flex items-center gap-2 mr-4">
            <Database size={14} className="text-primary-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{activeDataset.name}</span>
            <span className="badge-slate">{activeDataset.rows.toLocaleString()} × {activeDataset.cols}</span>
          </div>
        )}
        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-4 ml-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                disabled={!activeDatasetId && tab.id !== 'merge'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {!activeDatasetId && activeTab !== 'merge' ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full text-center px-8"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mb-4"
              >
                <Database size={36} className="text-primary-500" />
              </motion.div>
              <motion.h2
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2"
              >
                No dataset selected
              </motion.h2>
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-slate-400 dark:text-slate-500 max-w-sm"
              >
                Upload a dataset using the sidebar or click on an existing one to get started.
              </motion.p>
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="mt-6 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-600"
              >
                <Upload size={14} />
                Supports CSV, Excel, JSON
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key={`${activeTab}-${activeDatasetId}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {activeTab === 'preview' && activeDatasetId && <DataTable datasetId={activeDatasetId} />}
              {activeTab === 'clean' && activeDatasetId && <CleaningWorkspace datasetId={activeDatasetId} />}
              {activeTab === 'merge' && <MergeWorkspace />}
              {activeTab === 'visualize' && activeDatasetId && <VisualizationWorkspace datasetId={activeDatasetId} />}
              {activeTab === 'analyze' && activeDatasetId && <AnalysisWorkspace datasetId={activeDatasetId} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}

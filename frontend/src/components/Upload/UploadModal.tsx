import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { uploadDataset } from '../../api/client'
import { useStore } from '../../store/useStore'

interface Props {
  onClose: () => void
}

export default function UploadModal({ onClose }: Props) {
  const [files, setFiles] = useState<File[]>([])
  const [uploadedIds, setUploadedIds] = useState<Set<string>>(new Set())
  const qc = useQueryClient()
  const addDataset = useStore((s) => s.addDataset)

  const mutation = useMutation({
    mutationFn: uploadDataset,
    onSuccess: (data) => {
      addDataset(data)
      setUploadedIds((prev) => new Set([...prev, data.id]))
      qc.invalidateQueries({ queryKey: ['datasets'] })
    },
    onError: (err: Error) => {
      toast.error(`Upload failed: ${err.message}`)
    },
  })

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/json': ['.json'],
    },
    multiple: true,
  })

  const handleUploadAll = async () => {
    for (const file of files) {
      await mutation.mutateAsync(file)
    }
    toast.success(`Uploaded ${files.length} dataset${files.length > 1 ? 's' : ''}`)
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative card p-6 w-full max-w-lg"
          initial={{ scale: 0.95, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 10 }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Upload Datasets</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">CSV, Excel (.xlsx/.xls), or JSON</p>
            </div>
            <button onClick={onClose} className="btn-ghost p-1.5">
              <X size={18} />
            </button>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
              isDragActive
                ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                : 'border-slate-300 dark:border-slate-600 hover:border-primary-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <input {...getInputProps()} />
            <Upload
              size={36}
              className={`mx-auto mb-3 ${isDragActive ? 'text-primary-500' : 'text-slate-400'}`}
            />
            {isDragActive ? (
              <p className="text-primary-600 dark:text-primary-400 font-medium">Drop files here</p>
            ) : (
              <>
                <p className="text-slate-700 dark:text-slate-300 font-medium">Drag & drop files here</p>
                <p className="text-slate-400 text-sm mt-1">or click to browse</p>
              </>
            )}
            <div className="flex justify-center gap-2 mt-4">
              {['CSV', 'XLSX', 'XLS', 'JSON'].map((t) => (
                <span key={t} className="badge-slate text-xs">{t}</span>
              ))}
            </div>
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <FileText size={16} className="text-primary-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                  {uploadedIds.has(file.name) ? (
                    <CheckCircle size={16} className="text-green-500" />
                  ) : (
                    <button
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-5">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={handleUploadAll}
              disabled={files.length === 0 || mutation.isPending}
              className="btn-primary"
            >
              {mutation.isPending ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              Upload {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : 'Files'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

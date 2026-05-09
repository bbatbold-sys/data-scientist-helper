import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Send, Loader2, TrendingUp, AlertTriangle, Lightbulb, Star, ChevronDown, ChevronUp } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { chatWithAI, analyzeDataset } from '../../api/client'
import { useStore } from '../../store/useStore'
import type { AIInsight, ChatMessage } from '../../types'

function QualityGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'
  const r = 36, cx = 44, cy = 44
  const circumference = 2 * Math.PI * r
  const dash = (pct / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <svg width={88} height={88} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} stroke="#e2e8f0" strokeWidth={8} fill="none" />
        <circle
          cx={cx} cy={cy} r={r}
          stroke={color}
          strokeWidth={8}
          fill="none"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="mt-[-68px] text-center">
        <div className="text-xl font-bold" style={{ color }}>{pct}</div>
        <div className="text-xs text-slate-400 mt-[-2px]">Quality</div>
      </div>
    </div>
  )
}

export default function RightPanel() {
  const { activeDatasetId, datasets } = useStore()
  const activeDataset = datasets.find((d) => d.id === activeDatasetId)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [insight, setInsight] = useState<AIInsight | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [insightOpen, setInsightOpen] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  useEffect(() => {
    setInsight(null)
    setChatHistory([])
  }, [activeDatasetId])

  const chatMutation = useMutation({
    mutationFn: ({ message, history }: { message: string; history: ChatMessage[] }) =>
      chatWithAI(activeDatasetId!, message, history),
    onSuccess: (data, { message, history }) => {
      setChatHistory([...history, { role: 'user', content: message }, { role: 'assistant', content: data.response }])
    },
    onError: () => toast.error('AI chat failed'),
  })

  const handleSend = () => {
    if (!input.trim() || !activeDatasetId) return
    const msg = input.trim()
    setInput('')
    chatMutation.mutate({ message: msg, history: chatHistory })
  }

  const handleAnalyze = async () => {
    if (!activeDatasetId) return
    setAnalyzing(true)
    try {
      const result = await analyzeDataset(activeDatasetId)
      setInsight(result)
    } catch {
      toast.error('Analysis failed. Check your GEMINI_API_KEY in Railway.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <aside className="w-80 flex-shrink-0 flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Assistant</p>
            <p className="text-xs text-slate-400">Powered by Claude</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate">
        {/* Quick stats */}
        {activeDataset && (
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <p className="section-header">Dataset Stats</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Rows', value: activeDataset.rows.toLocaleString(), color: 'text-blue-600' },
                { label: 'Columns', value: activeDataset.cols, color: 'text-violet-600' },
                { label: 'Missing', value: activeDataset.missing_count, color: 'text-amber-600' },
                { label: 'Duplicates', value: activeDataset.duplicate_count, color: 'text-red-600' },
              ].map((s) => (
                <div key={s.label} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5">
                  <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Insights */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <p className="section-header mb-0">AI Insights</p>
            {insight && (
              <button onClick={() => setInsightOpen(!insightOpen)} className="btn-ghost p-1">
                {insightOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>

          {!insight && (
            <button
              onClick={handleAnalyze}
              disabled={!activeDatasetId || analyzing}
              className="btn-primary w-full justify-center"
            >
              {analyzing ? (
                <><Loader2 size={14} className="animate-spin" /> Analyzing…</>
              ) : (
                <><Star size={14} /> Run AI Analysis</>
              )}
            </button>
          )}

          <AnimatePresence>
            {insight && insightOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-3">
                  <QualityGauge score={insight.quality_score} />
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed flex-1">{insight.summary}</p>
                </div>

                {insight.insights.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <TrendingUp size={12} className="text-green-500" />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Insights</span>
                    </div>
                    <ul className="space-y-1">
                      {insight.insights.map((ins, i) => (
                        <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex gap-1.5">
                          <span className="text-green-500 mt-0.5 flex-shrink-0">•</span> {ins}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {insight.warnings.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle size={12} className="text-amber-500" />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Warnings</span>
                    </div>
                    <ul className="space-y-1">
                      {insight.warnings.map((w, i) => (
                        <li key={i} className="text-xs text-amber-600 dark:text-amber-400 flex gap-1.5">
                          <span className="flex-shrink-0">⚠</span> {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {insight.recommendations.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Lightbulb size={12} className="text-blue-500" />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Recommendations</span>
                    </div>
                    <ul className="space-y-1">
                      {insight.recommendations.map((r, i) => (
                        <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex gap-1.5">
                          <span className="text-blue-500 flex-shrink-0">→</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button onClick={handleAnalyze} className="btn-ghost text-xs w-full justify-center mt-1">
                  Re-analyze
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chat */}
        <div className="p-4">
          <p className="section-header">Ask AI</p>

          {!activeDatasetId && (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">Select a dataset to start chatting</p>
          )}

          <div className="space-y-3 mb-3 max-h-64 overflow-y-auto scrollbar-thin">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">
                  <Loader2 size={12} className="animate-spin text-slate-400" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* Chat input */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800">
        <div className="flex gap-2">
          <input
            className="input text-xs flex-1"
            placeholder="Ask about your data…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            disabled={!activeDatasetId || chatMutation.isPending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !activeDatasetId || chatMutation.isPending}
            className="btn-primary px-3"
          >
            {chatMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </aside>
  )
}

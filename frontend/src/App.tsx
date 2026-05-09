import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listDatasets } from './api/client'
import { useStore } from './store/useStore'
import Sidebar from './components/Layout/Sidebar'
import MainWorkspace from './components/Layout/MainWorkspace'
import RightPanel from './components/Layout/RightPanel'

export default function App() {
  const { isDarkMode, setDatasets } = useStore()

  const { data } = useQuery({
    queryKey: ['datasets'],
    queryFn: listDatasets,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (data) setDatasets(data)
  }, [data, setDatasets])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'b') {
        useStore.getState().toggleSidebar()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
        <Sidebar />
        <MainWorkspace />
        <RightPanel />
      </div>
    </div>
  )
}

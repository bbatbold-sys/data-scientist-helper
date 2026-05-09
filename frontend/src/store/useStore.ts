import { create } from 'zustand'
import type { DatasetInfo, WorkspaceTab } from '../types'

interface AppState {
  datasets: DatasetInfo[]
  activeDatasetId: string | null
  activeTab: WorkspaceTab
  isDarkMode: boolean
  sidebarCollapsed: boolean

  setDatasets: (d: DatasetInfo[]) => void
  addDataset: (d: DatasetInfo) => void
  removeDataset: (id: string) => void
  updateDataset: (d: DatasetInfo) => void
  setActiveDataset: (id: string | null) => void
  setActiveTab: (tab: WorkspaceTab) => void
  toggleDarkMode: () => void
  toggleSidebar: () => void
}

export const useStore = create<AppState>((set) => ({
  datasets: [],
  activeDatasetId: null,
  activeTab: 'preview',
  isDarkMode: false,
  sidebarCollapsed: false,

  setDatasets: (datasets) => set({ datasets }),
  addDataset: (d) => set((s) => ({ datasets: [...s.datasets, d] })),
  removeDataset: (id) =>
    set((s) => ({
      datasets: s.datasets.filter((x) => x.id !== id),
      activeDatasetId: s.activeDatasetId === id ? null : s.activeDatasetId,
    })),
  updateDataset: (d) =>
    set((s) => ({ datasets: s.datasets.map((x) => (x.id === d.id ? d : x)) })),
  setActiveDataset: (id) => set({ activeDatasetId: id, activeTab: 'preview' }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleDarkMode: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))

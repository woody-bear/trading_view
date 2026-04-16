import { create } from 'zustand'

interface TrendOverlayStore {
  showLines: boolean
  toggle: () => void
}

export const useTrendOverlayStore = create<TrendOverlayStore>((set) => ({
  showLines: false,
  toggle: () => set((s) => ({ showLines: !s.showLines })),
}))

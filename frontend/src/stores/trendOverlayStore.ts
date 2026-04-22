import { create } from 'zustand'

interface TrendOverlayStore {
  showLines: boolean
  toggle: () => void
}

export const useTrendOverlayStore = create<TrendOverlayStore>((set) => ({
  showLines: true,
  toggle: () => set((s) => ({ showLines: !s.showLines })),
}))

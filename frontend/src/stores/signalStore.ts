import { create } from 'zustand'
import type { Signal } from '../types'

export interface PriceUpdate {
  watchlist_id: number
  symbol: string
  market: string
  price: number
  open: number
  high: number
  low: number
  volume: number
  change_pct: number
}

interface SignalStore {
  signals: Signal[]
  setSignals: (s: Signal[]) => void
  updateSignal: (s: Signal) => void
  updatePrices: (updates: PriceUpdate[]) => void
}

export const useSignalStore = create<SignalStore>((set) => ({
  signals: [],
  setSignals: (signals) => set({ signals }),
  updateSignal: (updated) =>
    set((state) => ({
      signals: state.signals.map((s) =>
        s.watchlist_id === updated.watchlist_id ? updated : s
      ),
    })),
  updatePrices: (updates) =>
    set((state) => ({
      signals: state.signals.map((s) => {
        const u = updates.find((p) => p.watchlist_id === s.watchlist_id)
        if (!u) return s
        return { ...s, price: u.price, change_pct: u.change_pct }
      }),
    })),
}))

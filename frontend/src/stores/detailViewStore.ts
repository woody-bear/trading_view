import { create } from 'zustand'

export interface ChartUiState {
  sensitivity: string  // 'strict' | 'normal' | 'sensitive'
  // 향후 확장: period, toggles(BB/RSI/MACD 등)
}

interface DetailViewStore {
  byKey: Record<string, ChartUiState>
  get: (key: string) => ChartUiState | undefined
  set: (key: string, patch: Partial<ChartUiState>) => void
}

export const useDetailViewStore = create<DetailViewStore>((setState, getState) => ({
  byKey: {},
  get: (key) => getState().byKey[key],
  set: (key, patch) =>
    setState((s) => ({
      byKey: {
        ...s.byKey,
        [key]: { ...(s.byKey[key] ?? { sensitivity: 'strict' }), ...patch },
      },
    })),
}))

export const buildDetailKey = (market: string, symbol: string) => `${market}:${symbol}`

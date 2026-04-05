import { create } from 'zustand'
import { fetchFullScanLatest, fetchUnifiedCache } from '../api/client'

interface ScanData {
  buyItems: any[]
  overheatItems: any[]
  picks: any | null
}

interface ScanStore extends ScanData {
  loaded: boolean       // 최초 로딩 완료 여부 — false이면 로딩 중으로 표시
  lastFetchedAt: number // 마지막 성공 fetch 타임스탬프 (ms)
  setAll: (data: ScanData) => void
}

export const useScanStore = create<ScanStore>((set) => ({
  buyItems: [],
  overheatItems: [],
  picks: null,
  loaded: false,
  lastFetchedAt: 0,
  setAll: (data) => set({ ...data, loaded: true, lastFetchedAt: Date.now() }),
}))

const STALE_MS = 3 * 60 * 1000  // 3분 이내 데이터는 재조회 안함

/**
 * 스캔 데이터 로드 — Dashboard와 Scan 양쪽에서 공유 사용
 * - 최초 진입: 항상 fetch
 * - 재진입(3분 이내): 기존 store 데이터 유지, fetch 스킵
 * - 재진입(3분 초과): 기존 데이터 유지하며 백그라운드 갱신
 */
export async function loadScanData(): Promise<void> {
  const { loaded, lastFetchedAt, setAll } = useScanStore.getState()
  if (loaded && Date.now() - lastFetchedAt < STALE_MS) return

  try {
    const r = await fetchFullScanLatest()
    if (r?.status !== 'no_data' && r?.picks) {
      setAll({
        buyItems: r.chart_buy?.items || [],
        overheatItems: r.overheat?.items || [],
        picks: r.picks,
      })
      return
    }
  } catch {}

  try {
    const r2 = await fetchUnifiedCache()
    setAll({
      buyItems: r2?.chart_buy?.items || [],
      overheatItems: r2?.overheat?.items || [],
      picks: r2?.picks || null,
    })
  } catch {}
}

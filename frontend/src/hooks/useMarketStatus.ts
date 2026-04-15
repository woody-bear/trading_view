import { useQuery } from '@tanstack/react-query'
import { fetchMarketStatus, type MarketStatusDTO } from '../api/client'

/** 시장 상태 4분류 — 60초 refetch, 30초 stale. */
export function useMarketStatus(market: string | undefined) {
  return useQuery<MarketStatusDTO>({
    queryKey: ['market-status', market],
    queryFn: () => fetchMarketStatus(market!),
    enabled: !!market,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

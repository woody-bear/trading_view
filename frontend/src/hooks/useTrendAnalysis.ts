import { useQuery } from '@tanstack/react-query'
import { fetchTrendAnalysis, type TrendAnalysisResponse } from '../api/client'

export function useTrendAnalysis(symbol: string | undefined, market: string) {
  return useQuery<TrendAnalysisResponse>({
    queryKey: ['trend-analysis', market, symbol],
    queryFn: () => fetchTrendAnalysis(symbol!, market),
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

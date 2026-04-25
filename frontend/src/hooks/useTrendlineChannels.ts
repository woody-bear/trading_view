import { useQuery } from '@tanstack/react-query'
import { fetchTrendlineChannels, type TrendlineChannelsResponse } from '../api/client'

export function useTrendlineChannels(symbol: string | undefined, market: string) {
  return useQuery<TrendlineChannelsResponse>({
    queryKey: ['trendline-channels', market, symbol],
    queryFn: () => fetchTrendlineChannels(symbol!, market),
    enabled: !!symbol,
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

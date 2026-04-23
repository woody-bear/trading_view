import { useQuery } from '@tanstack/react-query'
import { fetchSparklines } from '../api/client'

export function useSparklines(items: { symbol: string; market: string }[]): Record<string, number[]> {
  const key = items.map(i => `${i.symbol}:${i.market}`).sort().join(',')
  const { data } = useQuery({
    queryKey: ['sparklines', key],
    queryFn: () => fetchSparklines(items),
    staleTime: 900_000,
    enabled: items.length > 0,
  })
  return data ?? {}
}

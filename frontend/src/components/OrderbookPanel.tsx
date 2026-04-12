import { useQuery } from '@tanstack/react-query'
import { fetchOrderbook } from '../api/client'

interface Props {
  symbol: string
  market: string
}

export default function OrderbookPanel({ symbol, market }: Props) {
  const isKR = market === 'KR' || market === 'KOSPI' || market === 'KOSDAQ'
  if (!isKR) return null

  const { data, isLoading } = useQuery({
    queryKey: ['orderbook', symbol],
    queryFn: () => fetchOrderbook(symbol, market),
    enabled: isKR,
    refetchInterval: 5000, // 5초 갱신
    staleTime: 3000,
  })

  if (isLoading) return <div className="text-xs text-[var(--muted)] py-2">호가 로딩 중...</div>
  if (!data || data.status === 'unavailable') return null

  const asks = (data.asks || []).slice(0, 5).reverse()  // 매도: 높은 가격이 위
  const bids = (data.bids || []).slice(0, 5)  // 매수: 높은 가격이 위
  const maxVol = Math.max(
    ...asks.map((a: any) => a.volume),
    ...bids.map((b: any) => b.volume),
    1
  )

  const bidRatio = data.bid_ratio ?? 50
  const isBuyDominant = bidRatio > 55
  const isSellDominant = bidRatio < 45

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 md:p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-[var(--muted)]">호가</h3>
        <div className="flex items-center gap-2">
          {isBuyDominant && <span className="text-caption text-green-400 font-bold">매수 우세</span>}
          {isSellDominant && <span className="text-caption text-red-400 font-bold">매도 우세</span>}
          <span className="text-caption text-[var(--muted)]">
            매수 <span className="text-green-400 font-mono">{bidRatio.toFixed(0)}%</span>
          </span>
        </div>
      </div>

      {/* 매도 호가 (빨간) */}
      <div className="space-y-0.5 mb-1">
        {asks.map((a: any, i: number) => (
          <HogaRow key={`ask-${i}`} price={a.price} volume={a.volume} maxVol={maxVol} type="ask" />
        ))}
      </div>

      {/* 구분선 */}
      <div className="border-t border-[var(--border)] my-1" />

      {/* 매수 호가 (파란) */}
      <div className="space-y-0.5 mt-1">
        {bids.map((b: any, i: number) => (
          <HogaRow key={`bid-${i}`} price={b.price} volume={b.volume} maxVol={maxVol} type="bid" />
        ))}
      </div>

      {/* 총잔량 */}
      <div className="flex justify-between mt-2 text-caption">
        <span className="text-red-400">매도 {data.total_ask_volume?.toLocaleString()}</span>
        <span className="text-green-400">매수 {data.total_bid_volume?.toLocaleString()}</span>
      </div>

      {/* 비율 바 */}
      <div className="flex h-1.5 mt-1 rounded-full overflow-hidden">
        <div className="bg-red-500/60" style={{ width: `${100 - bidRatio}%` }} />
        <div className="bg-green-500/60" style={{ width: `${bidRatio}%` }} />
      </div>
    </div>
  )
}

function HogaRow({ price, volume, maxVol, type }: {
  price: number; volume: number; maxVol: number; type: 'ask' | 'bid'
}) {
  const pct = (volume / maxVol) * 100
  const barColor = type === 'ask' ? 'bg-red-500/20' : 'bg-blue-500/20'
  const textColor = type === 'ask' ? 'text-red-400' : 'text-blue-400'

  return (
    <div className="relative flex items-center justify-between text-caption md:text-caption h-6 px-2 rounded">
      <div className={`absolute inset-0 ${barColor} rounded`} style={{ width: `${pct}%` }} />
      <span className={`relative font-mono ${textColor}`}>{price.toLocaleString()}</span>
      <span className="relative font-mono text-[var(--muted)]">{volume.toLocaleString()}</span>
    </div>
  )
}

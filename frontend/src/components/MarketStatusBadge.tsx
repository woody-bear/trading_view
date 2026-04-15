import { useMarketStatus } from '../hooks/useMarketStatus'

type Color = 'red' | 'gray' | 'green' | 'blue' | 'purple'

const COLOR_CLASS: Record<Color, string> = {
  red:    'text-red-400 border-red-400/40 bg-red-500/10',
  gray:   'text-gray-300 border-gray-400/40 bg-gray-400/10',
  green:  'text-green-400 border-green-400/40 bg-green-500/10',
  blue:   'text-blue-400 border-blue-400/40 bg-blue-500/10',
  purple: 'text-purple-300 border-purple-400/40 bg-purple-500/10',
}

export default function MarketStatusBadge({ market, className = '' }: { market: string; className?: string }) {
  const { data } = useMarketStatus(market)
  if (!data) return null
  const cls = COLOR_CLASS[data.color] ?? COLOR_CLASS.gray
  return (
    <span
      className={`text-xs border rounded px-1.5 py-0.5 font-medium ${cls} ${className}`}
      title={data.tz_now}
    >
      {data.label}
    </span>
  )
}

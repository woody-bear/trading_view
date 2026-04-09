import { useQuery } from '@tanstack/react-query'
import { fetchCompanyInfo, type InvestmentMetrics } from '../api/client'

interface Props {
  symbol: string
  market: string
}

function fmtMarketCap(val: number | null, currency: 'KRW' | 'USD'): string {
  if (val == null) return '-'
  if (currency === 'KRW') {
    if (val >= 1e12) return `${(val / 1e12).toFixed(1)}조`
    if (val >= 1e8) return `${(val / 1e8).toFixed(0)}억`
    return val.toLocaleString('ko-KR')
  } else {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`
    if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`
    return `$${val.toLocaleString()}`
  }
}

function fmtMoney(val: number | null, currency: 'KRW' | 'USD'): string {
  if (val == null) return '-'
  if (currency === 'KRW') return `${val.toLocaleString('ko-KR')}원`
  return `$${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function fmtPct(val: number | null): string {
  if (val == null) return '-'
  return `${val.toFixed(1)}%`
}

function fmtMultiple(val: number | null): string {
  if (val == null) return '-'
  return `${val.toFixed(1)}배`
}

interface MetricCardProps {
  label: string
  value: string
  sublabel?: string
  highlight?: 'undervalued' | 'overvalued' | 'good' | 'income'
}

function MetricCard({ label, value, sublabel, highlight }: MetricCardProps) {
  const colorMap = {
    undervalued: 'text-blue-400',
    overvalued: 'text-red-400',
    good: 'text-green-400',
    income: 'text-yellow-400',
  }
  const bgMap = {
    undervalued: 'bg-blue-500/10',
    overvalued: 'bg-red-500/10',
    good: 'bg-green-500/10',
    income: 'bg-yellow-500/10',
  }
  const hintMap = {
    undervalued: '저평가',
    overvalued: '고평가',
    good: '우수',
    income: '고배당',
  }

  const color = highlight ? colorMap[highlight] : 'text-white'
  const bg = highlight ? bgMap[highlight] : 'bg-[var(--bg)]'
  const hint = highlight ? hintMap[highlight] : null

  return (
    <div className={`${bg} rounded-lg p-2 text-center`}>
      <div className="text-[10px] text-[var(--muted)] mb-0.5">{label}</div>
      <div className={`text-xs font-mono font-bold ${color} ${value === '-' ? 'text-[var(--muted)]' : ''}`}>
        {value}
      </div>
      {sublabel && value !== '-' && (
        <div className="text-[9px] text-[var(--muted)]">{sublabel}</div>
      )}
      {hint && value !== '-' && (
        <div className={`text-[9px] font-bold ${color} mt-0.5`}>{hint}</div>
      )}
    </div>
  )
}

function buildCards(m: InvestmentMetrics) {
  const cur = m.currency

  const perHighlight =
    m.per != null && m.per > 0 && m.per < 10 ? 'undervalued' :
    m.per != null && m.per > 30 ? 'overvalued' : undefined

  const roeHighlight =
    m.roe != null && m.roe > 15 ? 'good' : undefined

  const divHighlight =
    m.dividend_yield != null && m.dividend_yield > 3 ? 'income' : undefined

  return [
    { label: 'PER (TTM)', value: fmtMultiple(m.per), sublabel: '주가/순이익', highlight: perHighlight },
    { label: 'PBR', value: fmtMultiple(m.pbr), sublabel: '주가/순자산', highlight: m.pbr != null && m.pbr < 1 ? 'undervalued' : undefined },
    { label: 'ROE', value: fmtPct(m.roe), sublabel: '자기자본이익률', highlight: roeHighlight },
    { label: 'ROA', value: fmtPct(m.roa), sublabel: '총자산이익률', highlight: undefined },
    { label: 'EPS (TTM)', value: fmtMoney(m.eps, cur), sublabel: '주당순이익', highlight: undefined },
    { label: 'BPS', value: fmtMoney(m.bps, cur), sublabel: '주당순자산', highlight: undefined },
    { label: '배당수익률', value: fmtPct(m.dividend_yield), sublabel: m.dividend_yield == null ? '무배당/미제공' : undefined, highlight: divHighlight },
    { label: '시가총액', value: fmtMarketCap(m.market_cap, cur), sublabel: undefined, highlight: undefined },
    { label: '영업이익률', value: fmtPct(m.operating_margin), sublabel: undefined, highlight: m.operating_margin != null && m.operating_margin > 20 ? 'good' : undefined },
    { label: '부채비율', value: m.debt_to_equity != null ? `${m.debt_to_equity.toFixed(0)}%` : '-', sublabel: undefined, highlight: undefined },
  ] as (MetricCardProps & { label: string })[]
}

export default function InvestmentMetricsPanel({ symbol, market }: Props) {
  const isCrypto = market === 'CRYPTO'

  const { data, isLoading } = useQuery({
    queryKey: ['company-info', symbol, market],
    queryFn: () => fetchCompanyInfo(symbol, market),
    enabled: !isCrypto,
    staleTime: 3600000,
    retry: 1,
  })

  if (isCrypto) return null
  if (isLoading) return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 md:p-3 mb-4 animate-pulse">
      <div className="h-3 bg-[var(--border)] rounded w-24 mb-3" />
      <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-[var(--bg)] rounded-lg h-14" />
        ))}
      </div>
    </div>
  )

  if (!data?.metrics) return null

  const cards = buildCards(data.metrics)

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 md:p-3 mb-4">
      <div className="text-xs text-[var(--muted)] mb-2 font-medium">투자 지표 (TTM)</div>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-3">
        {cards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>
    </div>
  )
}

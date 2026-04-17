import { useQuery } from '@tanstack/react-query'
import { fetchCompanyInfo, type AssetClass } from '../api/client'
import MetricCard, { type MetricHighlight } from './value/MetricCard'
import UnsupportedNotice from './value/UnsupportedNotice'
import CompanyInfoPanel from './CompanyInfoPanel'
import '../styles/value-tab.css'

interface Props {
  symbol: string
  market: string
  assetClassHint?: AssetClass
}

const fmtMarketCap = (v: number | null, currency: 'KRW' | 'USD'): string | null => {
  if (v == null) return null
  if (currency === 'KRW') {
    if (v >= 1e12) return `${(v / 1e12).toFixed(2)}조 원`
    if (v >= 1e8) return `${(v / 1e8).toFixed(0)}억 원`
    return `${v.toLocaleString()} 원`
  }
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  return `$${v.toLocaleString()}`
}

const fmtMultiple = (v: number | null): string | null =>
  v == null ? null : `${v.toFixed(1)}배`

const fmtPct = (v: number | null): string | null =>
  v == null ? null : `${v.toFixed(1)}%`

const fmtMoney = (v: number | null, currency: 'KRW' | 'USD'): string | null => {
  if (v == null) return null
  return currency === 'KRW' ? `${Math.round(v).toLocaleString()} 원` : `$${v.toFixed(2)}`
}

interface CardDef {
  label: string
  value: string | null
  sublabel?: string
  highlight?: MetricHighlight
}

export default function ValueAnalysisTab({ symbol, market, assetClassHint }: Props) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['company', market, symbol],
    queryFn: () => fetchCompanyInfo(symbol, market),
    staleTime: 60 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  if (isLoading) {
    return (
      <div className="p-3 md:p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-20 bg-[var(--card)] border border-[var(--border)] rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-6 flex flex-col items-center gap-3">
        <div className="text-sm text-[var(--sell)]">가치 지표를 불러오지 못했습니다.</div>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 bg-[var(--card)] border border-[var(--border)] rounded text-xs text-white hover:bg-[var(--border)]"
        >
          다시 시도
        </button>
      </div>
    )
  }

  const assetClass = assetClassHint ?? data.asset_class
  if (assetClass !== 'STOCK_KR' && assetClass !== 'STOCK_US') {
    return <UnsupportedNotice assetClass={assetClass} />
  }

  const m = data.metrics
  const currency = (m?.currency ?? 'USD') as 'KRW' | 'USD'
  const sector = data.company?.sector ?? null

  // 하이라이트 판정 (InvestmentMetricsPanel과 동일 임계값)
  const perHL: MetricHighlight | undefined =
    m?.per != null && m.per > 0 && m.per < 10 ? 'undervalued'
    : m?.per != null && m.per > 30 ? 'overvalued'
    : undefined
  const pbrHL: MetricHighlight | undefined =
    m?.pbr != null && m.pbr < 1 ? 'undervalued' : undefined
  const roeHL: MetricHighlight | undefined =
    m?.roe != null && m.roe > 15 ? 'good' : undefined
  const opmHL: MetricHighlight | undefined =
    m?.operating_margin != null && m.operating_margin > 20 ? 'good' : undefined
  const divHL: MetricHighlight | undefined =
    m?.dividend_yield != null && m.dividend_yield > 3 ? 'income' : undefined

  // 중요도 순 11 카드 (규모 → 밸류에이션 → 수익성 → 수익 → 주주환원 → 재무 → 업종)
  const cards: CardDef[] = [
    {
      label: '시가총액',
      value: fmtMarketCap(m?.market_cap ?? null, currency),
    },
    {
      label: 'PER (TTM)',
      value: fmtMultiple(m?.per ?? null),
      sublabel:
        m?.per == null && m?.eps != null && m.eps <= 0
          ? '적자로 산출 불가'
          : '주가/순이익',
      highlight: perHL,
    },
    {
      label: 'PBR',
      value: fmtMultiple(m?.pbr ?? null),
      sublabel: '주가/순자산',
      highlight: pbrHL,
    },
    {
      label: 'ROE (TTM)',
      value: fmtPct(m?.roe ?? null),
      sublabel: '자기자본이익률',
      highlight: roeHL,
    },
    {
      label: 'ROA (TTM)',
      value: fmtPct(m?.roa ?? null),
      sublabel:
        m?.roa == null && assetClass === 'STOCK_KR'
          ? '국내 종목 데이터 미제공'
          : '총자산이익률',
    },
    {
      label: '영업이익률',
      value: fmtPct(m?.operating_margin ?? null),
      sublabel: '영업이익/매출',
      highlight: opmHL,
    },
    {
      label: 'EPS (TTM)',
      value: fmtMoney(m?.eps ?? null, currency),
      sublabel: '주당순이익',
    },
    {
      label: 'BPS',
      value: fmtMoney(m?.bps ?? null, currency),
      sublabel: '주당순자산',
    },
    {
      label: '배당수익률',
      value: fmtPct(m?.dividend_yield ?? null),
      sublabel: m?.dividend_yield == null ? '무배당/미제공' : '연간 배당금/주가',
      highlight: divHL,
    },
    {
      label: '부채비율',
      value:
        m?.debt_to_equity != null ? `${m.debt_to_equity.toFixed(0)}%` : null,
      sublabel: '부채/자기자본',
    },
    {
      label: '섹터 (업종)',
      value: sector,
    },
  ]

  return (
    <div className="value-tab-scroll p-3 md:p-6">
      {/* 회사 정보 — 가치 분석 탭 최상단 (023) */}
      <CompanyInfoPanel symbol={symbol} market={market} />

      {/* 헤더: 보고 기준일 + 통화 */}
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-[var(--muted)]">
          {data.reporting_period ? (
            <>
              <span className="text-white font-semibold">{data.reporting_period}</span> 기준
            </>
          ) : (
            '기준 보고 시점 정보 없음'
          )}
        </div>
        <div className="text-[10px] text-[var(--muted)] opacity-60">
          표시 통화: {currency}
        </div>
      </div>

      {/* 11개 카드 — 모바일 2열 / PC 3열 (모바일 스냅은 한 줄 단위) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 pb-24 md:pb-6">
        {cards.map((c) => (
          <MetricCard
            key={c.label}
            label={c.label}
            value={c.value}
            sublabel={c.sublabel}
            highlight={c.highlight}
          />
        ))}
      </div>

      {/* 푸터: 갱신 시각 */}
      {data.cached_at && (
        <div className="mt-4 text-[10px] text-[var(--muted)] opacity-50 text-right">
          최종 갱신: {new Date(data.cached_at).toLocaleString('ko-KR')}
        </div>
      )}
    </div>
  )
}

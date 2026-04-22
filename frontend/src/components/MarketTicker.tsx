/* SQZ Terminal — MarketTicker (Phase 6, 실데이터 연동)
   /sentiment/overview API 재활용 — vix·kospi·sp500·nasdaq·usdkrw·us10y */

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fetchSentiment } from '../api/client'
import Spark from './charts/Spark'
import { genSpark } from '../utils/chartDummy'

interface IndexData {
  name: string
  value: number
  change: number
  change_pct: number
  direction: 'up' | 'down' | 'flat'
}

interface SentimentData {
  vix: IndexData
  kospi: IndexData
  sp500: IndexData
  nasdaq: IndexData
  usdkrw: IndexData
  us10y?: IndexData
}

interface TickerDef {
  key: keyof SentimentData
  label: string
  flag: string
  fmt: (v: number) => string
  invertColor?: boolean  // 값 상승이 부정적인 지표 (VIX, US10Y 등)
  detailSymbol: string   // 종목 상세 페이지 URL 심볼 (yfinance 티커)
  detailMarket: string   // 종목 상세 페이지 market 파라미터
}

const TICKERS: TickerDef[] = [
  { key: 'kospi',  label: 'KOSPI',   flag: '🇰🇷', fmt: v => v.toLocaleString('ko-KR', { maximumFractionDigits: 0 }), detailSymbol: '^KS11',    detailMarket: 'KR' },
  { key: 'nasdaq', label: 'NASDAQ',  flag: '🇺🇸', fmt: v => v.toLocaleString('en-US', { maximumFractionDigits: 0 }), detailSymbol: '^IXIC',    detailMarket: 'US' },
  { key: 'sp500',  label: 'S&P 500', flag: '🇺🇸', fmt: v => v.toLocaleString('en-US', { maximumFractionDigits: 0 }), detailSymbol: '^GSPC',    detailMarket: 'US' },
  { key: 'vix',    label: 'VIX',     flag: '📉',  fmt: v => v.toFixed(2), invertColor: true,  detailSymbol: '^VIX',     detailMarket: 'US' },
  { key: 'usdkrw', label: 'USD/KRW', flag: '💱',  fmt: v => v.toLocaleString('ko-KR', { maximumFractionDigits: 0 }), invertColor: true, detailSymbol: 'USDKRW=X', detailMarket: 'US' },
  { key: 'us10y',  label: 'US10Y',   flag: '🏦',  fmt: v => v.toFixed(3) + '%', invertColor: true,  detailSymbol: '^TNX',     detailMarket: 'US' },
]

function TickerCell({ def: d, data, index, onNavigate }: { def: TickerDef; data: IndexData | undefined; index: number; onNavigate: (symbol: string, market: string) => void }) {
  const noData = !data || data.value === 0
  const pct = data?.change_pct ?? 0
  const isUp = data?.direction === 'up'
  // invertColor: VIX·US10Y 상승은 부정적이므로 색상 반전
  const neg = d.invertColor ? isUp : !isUp
  const color = noData ? 'var(--fg-4)' : neg ? 'var(--down)' : 'var(--up)'

  // 스파크라인: 더미 seeded (실 히스토리 API 연결 전까지)
  const spark = noData ? null : genSpark(24, index * 3 + 1, (d.invertColor ? -1 : 1) * (pct / 100))

  return (
    <div
      onClick={() => onNavigate(d.detailSymbol, d.detailMarket)}
      style={{
        padding: '10px 14px',
        borderLeft: index === 0 ? 'none' : '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        minWidth: 0,
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: 11 }}>{d.flag}</span>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', color: 'var(--fg-3)', textTransform: 'uppercase' }}>
          {d.label}
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--fg-0)', letterSpacing: '-0.01em' }}>
        {noData ? '—' : d.fmt(data!.value)}
      </div>
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: 10.5, color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {noData ? '—' : `${isUp ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%`}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {spark && <Spark data={spark} w={54} h={14} color={color} strokeW={1} fill={false} />}
        </div>
      </div>
    </div>
  )
}

function TickerSkeleton() {
  const sk = (w: number | string, h: number, r = 3) => (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: r }} />
  )
  return (
    <>
      {TICKERS.map((_, i) => (
        <div key={i} style={{ padding: '10px 14px', borderLeft: i === 0 ? 'none' : '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {sk('55%', 9)}
          {sk('70%', 16)}
          {sk('45%', 9)}
        </div>
      ))}
    </>
  )
}

export default function MarketTicker() {
  const nav = useNavigate()
  const { data, isPending } = useQuery<SentimentData>({
    queryKey: ['sentiment'],
    queryFn: fetchSentiment,
    staleTime: 60_000,
    refetchInterval: 300_000,
  })

  const handleNavigate = (symbol: string, market: string) => {
    nav(`/${symbol.replace(/\//g, '_')}?market=${market}`)
  }

  return (
    <div
      className="panel"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${TICKERS.length}, 1fr)`,
        padding: 0,
        overflow: 'hidden',
      }}
    >
      {isPending
        ? <TickerSkeleton />
        : TICKERS.map((def, i) => (
            <TickerCell key={def.key} def={def} data={data?.[def.key] as IndexData | undefined} index={i} onNavigate={handleNavigate} />
          ))
      }
    </div>
  )
}

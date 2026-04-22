/* SQZ Terminal — QuickBuyStrip (Phase 17, 모바일 홈)
   최신 BUY/SQZ BUY 종목 최대 5개를 스파크라인 + 신호 칩과 함께 표시.
   스냅샷 없으면 null 반환(숨김). */

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchFullScanLatest } from '../api/client'
import Spark from './charts/Spark'
import { genCandles } from '../utils/chartDummy'
import { fmt, fmtPrice } from '../utils/format'

interface ScanItem {
  symbol: string
  display_name?: string
  name?: string
  market: string
  market_type?: string
  price: number
  change_pct: number
  last_signal: string
}

function QuickRow({ item, index }: { item: ScanItem; index: number }) {
  const sparkData = useMemo(() => {
    const seed = (item.symbol.charCodeAt(0) || 1) + (index + 1) * 7
    return genCandles(20, seed, 100, 0.03).map(c => c.c)
  }, [item.symbol, index])

  const pct = item.change_pct ?? 0
  const signalChip = item.last_signal === 'SQZ BUY'
    ? { label: 'SQZ BUY', cls: 'chip chip-mag' }
    : { label: 'BUY', cls: 'chip chip-up' }

  const handleTap = () => {
    window.open(`/${item.symbol.replace(/\//g, '_')}?market=${item.market_type || item.market}`, '_blank')
  }

  return (
    <div
      onClick={handleTap}
      className="flex items-center"
      style={{
        padding: '9px 12px',
        gap: 10,
        borderRadius: 6,
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
      }}
    >
      {/* 신호 칩 */}
      <span className={signalChip.cls} style={{ flexShrink: 0, fontSize: 9 }}>
        {signalChip.label}
      </span>

      {/* 종목명 */}
      <span
        className="truncate flex-1"
        style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', minWidth: 0 }}
      >
        {item.display_name || item.name || item.symbol}
      </span>

      {/* 스파크 */}
      <div style={{ flexShrink: 0 }}>
        <Spark
          data={sparkData}
          w={48}
          h={22}
          color={pct >= 0 ? 'var(--up)' : 'var(--down)'}
        />
      </div>

      {/* 가격·등락률 */}
      <div className="flex flex-col items-end" style={{ flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--fg-0)' }}>
          {fmtPrice(item.price, item.market)}
        </span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: pct >= 0 ? 'var(--up)' : 'var(--down)' }}>
          {pct >= 0 ? '▲' : '▼'} {fmt.pct(Math.abs(pct))}
        </span>
      </div>
    </div>
  )
}

export default function QuickBuyStrip() {
  const { data } = useQuery({
    queryKey: ['quick-buy-strip'],
    queryFn: fetchFullScanLatest,
    staleTime: 120_000,
    refetchInterval: 300_000,
  })

  const items: ScanItem[] = data?.chart_buy?.items?.slice(0, 5) ?? []
  if (!items.length) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span className="label">최신 BUY</span>
        <span className="chip chip-ghost">{items.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <QuickRow key={item.symbol} item={item} index={i} />
        ))}
      </div>
    </div>
  )
}

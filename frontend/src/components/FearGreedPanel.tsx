/* SQZ Terminal — FearGreedPanel (Phase 7, PC 전용)
   원본: /tmp/design_extract/asst/project/pc-dashboard.jsx FearGreedPanel
   기존 sentiment API(/sentiment, /sentiment-history) 재활용. */

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchSentiment, fetchSentimentHistory } from '../api/client'
import FGGauge from './charts/FGGauge'
import { fmt } from '../utils/format'

interface SentimentData {
  fear_greed: number
  fear_greed_label: string
  sentiment_summary: string
  updated_at: string
}

interface HistoryData {
  dates: string[]
  values: number[]
}

const PERIOD_TABS: { label: string; days: 30 | 90 | 365 }[] = [
  { label: '1개월', days: 30 },
  { label: '3개월', days: 90 },
  { label: '1년', days: 365 },
]

// dates(YYYY-MM-DD)에서 N일 전 값 (가장 가까운 인덱스)
function valueDaysAgo(history: HistoryData, daysBack: number): number | null {
  if (!history?.values?.length) return null
  const idx = Math.max(0, history.values.length - 1 - daysBack)
  return history.values[idx] ?? null
}

function fmtMonthDay(yyyymmdd: string): string {
  // "2026-04-21" → "APR 21"
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const [, mm, dd] = yyyymmdd.split('-')
  const mIdx = parseInt(mm, 10) - 1
  return `${months[mIdx] ?? mm} ${dd}`
}

function TrendChart({ history, current }: { history: HistoryData; current: number }) {
  const w = 520
  const h = 220
  const PAD_T = 24  // 상단 여백 — 최고값 라인 + badge가 잘리지 않도록
  const PAD_B = 16  // 하단 여백
  const data = history.values
  if (!data.length) return null

  // 데이터 좌표 → SVG y 좌표
  const yOf = (v: number) => h - PAD_B - (v / 100) * (h - PAD_T - PAD_B)
  const xOf = (i: number) => (i / (data.length - 1)) * w

  const pts = data.map((v, i) => [xOf(i), yOf(v)] as const)
  const dPath = 'M' + pts.map(p => p.join(',')).join(' L')

  const lastX = pts[pts.length - 1][0]
  const lastY = pts[pts.length - 1][1]

  // x축 라벨 (6개 균등 분포)
  const labelCount = 6
  const labels: { x: number; text: string }[] = []
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount - 1)) * (history.dates.length - 1))
    labels.push({ x: xOf(idx), text: fmtMonthDay(history.dates[idx]) })
  }

  return (
    <>
      <svg
        width={w}
        height={h}
        style={{ width: '100%', height: h, display: 'block' }}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        {/* zone bands — yOf 좌표계 기준으로 정렬 */}
        <rect x="0" y={yOf(80)} width={w} height={yOf(60) - yOf(80)} fill="var(--up)" opacity="0.05" />
        <rect x="0" y={yOf(40)} width={w} height={yOf(20) - yOf(40)} fill="var(--down)" opacity="0.05" />
        {/* grid lines */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line
              x1="0" x2={w}
              y1={yOf(v)} y2={yOf(v)}
              stroke="var(--border)"
              strokeDasharray="2,3"
              opacity="0.6"
            />
            <text
              x={w - 2}
              y={yOf(v) - 4}
              textAnchor="end"
              fill="var(--fg-3)"
              fontSize="9"
              fontFamily="var(--font-mono)"
            >
              {v}
            </text>
          </g>
        ))}
        <defs>
          <linearGradient id="fg-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--spark)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--spark)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={dPath + ` L${w},${yOf(0)} L0,${yOf(0)} Z`} fill="url(#fg-area)" />
        <path d={dPath} stroke="var(--spark)" strokeWidth="1.8" fill="none" />
        {/* 마지막 값 badge */}
        <circle cx={lastX} cy={lastY} r="3.5" fill="var(--spark)" stroke="var(--bg-1)" strokeWidth="1.5" />
        <rect x={lastX - 36} y={lastY - 11} width="34" height="17" fill="var(--accent)" rx="3" />
        <text
          x={lastX - 19}
          y={lastY + 2}
          textAnchor="middle"
          fill="var(--bg-1)"
          fontSize="10"
          fontWeight="700"
          fontFamily="var(--font-mono)"
        >
          {current.toFixed(0)}
        </text>
      </svg>
      <div
        className="flex justify-between"
        style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginTop: 4 }}
      >
        {labels.map((l, i) => (
          <span key={i}>{l.text}</span>
        ))}
      </div>
    </>
  )
}

function FearGreedSkeleton() {
  const sk = (w: number | string, h: number, r = 4) => (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0 }} />
  )
  return (
    <div className="panel" style={{ display: 'flex', padding: 0, overflow: 'hidden' }}>
      {/* 좌: 게이지 영역 */}
      <div style={{ padding: '20px 24px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, minWidth: 240 }}>
        {sk(60, 10, 3)}
        {sk(164, 164, 82)}
        <div style={{ display: 'flex', gap: 16 }}>
          {sk(28, 10, 3)}{sk(28, 10, 3)}{sk(28, 10, 3)}
        </div>
      </div>
      {/* 우: 차트 영역 */}
      <div style={{ flex: 1, padding: '14px 18px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sk(120, 10, 3)}
            {sk(80, 28, 3)}
          </div>
          {sk(130, 26, 3)}
        </div>
        {sk('100%', 220, 4)}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {[0,1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ width: 36, height: 10, borderRadius: 3 }} />)}
        </div>
      </div>
    </div>
  )
}

export default function FearGreedPanel() {
  const [days, setDays] = useState<30 | 90 | 365>(30)

  const { data: sentiment, isLoading: sLoading } = useQuery<SentimentData>({
    queryKey: ['sentiment'],
    queryFn: fetchSentiment,
    refetchInterval: 300_000,
    staleTime: 60_000,
  })

  const { data: history, isLoading: hLoading } = useQuery<HistoryData>({
    queryKey: ['sentiment-history', days],
    queryFn: () => fetchSentimentHistory(days),
    refetchInterval: 300_000,
    staleTime: 60_000,
  })

  if (sLoading || !sentiment) return <FearGreedSkeleton />

  const current = sentiment.fear_greed
  const w1 = history ? valueDaysAgo(history, 7) : null
  const m1 = history ? valueDaysAgo(history, 30) : null
  const m3 = history ? valueDaysAgo(history, 90) : null

  // 30일 추이용 last 30 윈도우
  const recent30: HistoryData | null = history
    ? {
        dates: history.dates.slice(-30),
        values: history.values.slice(-30),
      }
    : null

  // 변화량/변화율 — 30일 추이 첫 값 기준
  const baseline = recent30?.values[0] ?? current
  const delta = current - baseline
  const deltaPct = baseline ? (delta / baseline) * 100 : 0

  return (
    <div className="panel" style={{ display: 'flex', padding: 0 }}>
      {/* 좌: gauge */}
      <div
        style={{
          padding: '20px 24px',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: 240,
        }}
      >
        <div className="label self-start" style={{ marginBottom: 8 }}>
          SENTIMENT · 1D
        </div>
        <FGGauge value={Math.round(current)} size={200} />
        <div
          className="flex gap-4"
          style={{ marginTop: 6, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}
        >
          <span>
            1W <span style={{ color: 'var(--fg-1)' }}>{w1 != null ? Math.round(w1) : '—'}</span>
          </span>
          <span>
            1M <span style={{ color: 'var(--fg-1)' }}>{m1 != null ? Math.round(m1) : '—'}</span>
          </span>
          <span>
            3M <span style={{ color: 'var(--fg-1)' }}>{m3 != null ? Math.round(m3) : '—'}</span>
          </span>
        </div>
      </div>

      {/* 우: chart */}
      <div style={{ flex: 1, padding: '14px 18px 10px', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <div>
            <div className="label">공포·탐욕 지수 · 30일 추이</div>
            <div className="flex items-baseline gap-2.5" style={{ marginTop: 4 }}>
              <span
                style={{
                  fontSize: 28,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: 'var(--fg-0)',
                }}
              >
                {current.toFixed(2)}
              </span>
              <span
                className="mono"
                style={{
                  color: delta >= 0 ? 'var(--up)' : 'var(--down)',
                  fontSize: 13,
                }}
              >
                {delta >= 0 ? '▲' : '▼'} {fmt.pct(deltaPct, 1)} ({delta >= 0 ? '+' : ''}{delta.toFixed(0)})
              </span>
            </div>
          </div>
          <div className="flex" style={{ border: '1px solid var(--border)', borderRadius: 3 }}>
            {PERIOD_TABS.map((t, i) => {
              const active = days === t.days
              return (
                <button
                  key={t.days}
                  onClick={() => setDays(t.days)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    background: active ? 'var(--bg-3)' : 'transparent',
                    color: active ? 'var(--fg-0)' : 'var(--fg-3)',
                    borderRight: i < PERIOD_TABS.length - 1 ? '1px solid var(--border)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
        {hLoading || !recent30 ? (
          <div
            className="flex items-center justify-center"
            style={{ height: 180, color: 'var(--fg-3)', fontSize: 11 }}
          >
            추이 데이터 로딩…
          </div>
        ) : (
          <TrendChart history={recent30} current={current} />
        )}
      </div>
    </div>
  )
}

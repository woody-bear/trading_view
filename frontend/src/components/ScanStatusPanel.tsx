/* SQZ Terminal — ScanStatusPanel (Phase 8)
   원본: /tmp/design_extract/asst/project/pc-dashboard.jsx ScanStatusPanel
   Dashboard.tsx MarketScanBox 헤더 + 요약 카운트 블록을 대체. */

import { fmt } from '../utils/format'

interface Props {
  recommendedCount: number | null
  pullbackCount: number | null
  largeCapCount: number | null
  deadCrossCount: number | null
  deadCrossPct?: number | null
  totalSymbols?: number | null
  scanning: boolean
  scanTimeText: string | null   // "04/20 18:44" 형식
  allMarketsClosed: boolean
  scanElapsedSec: number
  onRefresh: () => void
}

export default function ScanStatusPanel({
  recommendedCount,
  pullbackCount,
  largeCapCount,
  deadCrossCount,
  deadCrossPct,
  totalSymbols,
  scanning,
  scanTimeText,
  allMarketsClosed,
  scanElapsedSec,
  onRefresh,
}: Props) {
  const cells = [
    {
      label: '추천',
      value: recommendedCount,
      color: 'var(--up)',
      sub: 'BUY 라벨 · EMA5 미역배열',
    },
    {
      label: '눌림목',
      value: pullbackCount,
      color: 'var(--warn)',
      sub: '장기 상승 · 단기 눌림',
    },
    {
      label: '대형주',
      value: largeCapCount,
      color: 'var(--accent)',
      sub: 'KOSPI200·KOSDAQ150·S&P500',
    },
    {
      label: '데드크로스',
      value: deadCrossCount,
      color: 'var(--down)',
      sub:
        deadCrossPct != null && totalSymbols
          ? `${deadCrossPct.toFixed(0)}% · ${fmt.num(totalSymbols)}종목 중`
          : 'EMA 5선 역배열',
    },
  ]

  return (
    <div className="panel" style={{ padding: 0 }}>
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div className="flex items-center" style={{ gap: 10 }}>
          <div className="label">시장 스캔</div>
          {allMarketsClosed && !scanning && <span className="chip chip-ghost">장종료</span>}
          {scanning && <span className="chip chip-warn">스캔 중</span>}
          {scanTimeText && !scanning && (
            <span
              style={{
                fontSize: 11,
                color: 'var(--fg-3)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              최근 스캔 · {scanTimeText}
            </span>
          )}
        </div>
        <div className="flex items-center" style={{ gap: 10 }}>
          {scanning && (
            <>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--warn)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ⟳ {scanElapsedSec > 0 ? `${scanElapsedSec}s` : '진행 중'}
              </span>
              <div
                style={{
                  width: 120,
                  height: 3,
                  background: 'var(--bg-3)',
                  borderRadius: 2,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* indeterminate progress — 백엔드에서 % 데이터 없으므로 애니메이션 바 */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--warn)',
                    width: '40%',
                    animation: 'sqz-scan-bar 1.6s linear infinite',
                  }}
                />
              </div>
              <style>{`
                @keyframes sqz-scan-bar {
                  0%   { transform: translateX(-100%); }
                  100% { transform: translateX(250%); }
                }
              `}</style>
            </>
          )}
          <button
            onClick={onRefresh}
            disabled={scanning}
            style={{
              background: 'var(--down-bg)',
              color: 'var(--down)',
              border: '1px solid var(--down)',
              padding: '3px 10px',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              borderRadius: 3,
              cursor: scanning ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em',
              opacity: scanning ? 0.5 : 1,
            }}
          >
            ⟳ REFRESH
          </button>
        </div>
      </div>

      {/* 4-column metric grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          padding: 0,
        }}
      >
        {cells.map((x, i) => (
          <div
            key={x.label}
            style={{
              padding: '14px 16px',
              borderLeft: i === 0 ? 'none' : '1px solid var(--border)',
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: 'var(--fg-3)',
                letterSpacing: '0.08em',
                fontWeight: 600,
              }}
            >
              {x.label}
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                color: x.color,
                marginTop: 2,
                lineHeight: 1,
              }}
            >
              {x.value != null ? fmt.num(x.value) : '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>
              {x.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

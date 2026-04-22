/* SQZ Terminal — EntryPlanPanel (Phase 12)
   분할매수 진입 계획 — 실제 단계 체크 기능 포함.
   BUY 신호 시: 3단계 체크/리셋 가능 (localStorage + 서버 동기화)
   SELL/NEUTRAL: 대기 안내 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { getPosition, updatePosition } from '../../api/client'
import { useAuthStore } from '../../store/authStore'

interface Props {
  symbol: string
  signalState: string         // BUY / SELL / NEUTRAL (차트 마지막 마커 기준)
  lastSignalText?: string | null
  lastSignalDate?: string | null
  rsi?: number | null
  bbPctB?: number | null
  ema20?: number | null
  ema50?: number | null
}

interface StepDef {
  label: string
  pct: number
  cond: string
  conditionMet: boolean
  currentValue: string
}

interface SavedState {
  signalDate: string
  completedSteps: number[]
}

function loadState(symbol: string): SavedState | null {
  try {
    const raw = localStorage.getItem(`posGuide:${symbol}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveState(symbol: string, state: SavedState) {
  localStorage.setItem(`posGuide:${symbol}`, JSON.stringify(state))
}

function clearState(symbol: string) {
  localStorage.removeItem(`posGuide:${symbol}`)
}

function getStepDefs(rsi: number, bbPctB: number, ema20: number, ema50: number): StepDef[] {
  return [
    {
      label: '1차 진입',
      pct: 30,
      cond: 'BUY 신호 발생 시 진입',
      conditionMet: true,
      currentValue: `RSI ${rsi.toFixed(0)} · BB ${(bbPctB * 100).toFixed(0)}%`,
    },
    {
      label: '2차 추가',
      pct: 30,
      cond: 'RSI < 30 (추가 과매도)',
      conditionMet: rsi < 30,
      currentValue: rsi < 30 ? '충족' : `RSI ${rsi.toFixed(0)} → 30 이하 (${(rsi - 30).toFixed(0)}pt)`,
    },
    {
      label: '3차 추가',
      pct: 40,
      cond: 'EMA20 > EMA50 (BULL 확인)',
      conditionMet: ema20 > ema50,
      currentValue: ema20 > ema50 ? '상승추세 확인' : `EMA20 ${ema20.toFixed(0)} < EMA50 ${ema50.toFixed(0)}`,
    },
  ]
}

export default function EntryPlanPanel({
  symbol,
  signalState,
  lastSignalText = null,
  lastSignalDate = null,
  rsi = null,
  bbPctB = null,
  ema20 = null,
  ema50 = null,
}: Props) {
  const { user } = useAuthStore()
  const signalDate = lastSignalDate || ''
  const rsiVal = rsi ?? 50
  const bbVal = bbPctB ?? 0.5
  const ema20Val = ema20 ?? 0
  const ema50Val = ema50 ?? 0

  const [completed, setCompleted] = useState<number[]>(() => {
    const saved = loadState(symbol)
    if (saved && saved.signalDate === signalDate && signalDate) return saved.completedSteps
    return []
  })

  // 초기 동기화 완료 여부 — 이 플래그가 true 되기 전엔 PUT 금지 (빈 상태로 DB 덮어쓰기 방지)
  const hydratedRef = useRef(false)
  // 로컬 신호일 기준 리셋 여부 추적 — signalDate가 비어있다가 실제 값으로 채워질 때 리셋 오판정 방지
  const lastSyncedSignalRef = useRef<string>('')

  // 로그인 상태면 서버에서 상태 로드. 비로그인이면 localStorage 기준으로 즉시 hydrate 완료.
  useEffect(() => {
    // signalDate가 아직 로드되지 않은 초기 렌더 — 빈 상태로 서버/localStorage를 덮어쓰는 것을 방지
    if (!signalDate) {
      hydratedRef.current = false
      return
    }

    let cancelled = false

    if (!user) {
      // 비로그인: localStorage만 사용. 신호일 바뀌면 리셋.
      const saved = loadState(symbol)
      if (saved && saved.signalDate === signalDate && signalDate) {
        setCompleted(saved.completedSteps)
      } else {
        setCompleted([])
        if (signalDate) clearState(symbol)
      }
      lastSyncedSignalRef.current = signalDate
      hydratedRef.current = true
      return
    }

    // 로그인: 서버 상태를 신뢰. signal_date가 현재 신호와 다르면 리셋(새 BUY 신호)
    hydratedRef.current = false
    getPosition(symbol, 'KR')
      .then(res => {
        if (cancelled) return
        const serverStages = res.completed_stages ?? []
        const serverSignalDate = res.signal_date ?? ''
        if (signalDate && serverSignalDate && serverSignalDate !== signalDate) {
          // 새 신호 발생 → 이전 기록 무효화
          setCompleted([])
          clearState(symbol)
        } else {
          setCompleted(serverStages)
          if (serverStages.length > 0 && signalDate) {
            saveState(symbol, { signalDate, completedSteps: serverStages })
          }
        }
        lastSyncedSignalRef.current = signalDate
        hydratedRef.current = true
      })
      .catch(() => {
        if (cancelled) return
        // 서버 실패 시 localStorage 폴백
        const saved = loadState(symbol)
        if (saved && saved.signalDate === signalDate && signalDate) {
          setCompleted(saved.completedSteps)
        } else {
          setCompleted([])
        }
        lastSyncedSignalRef.current = signalDate
        hydratedRef.current = true
      })

    return () => { cancelled = true }
  }, [symbol, user, signalDate])

  // 상태 변경 시 저장 (서버 + localStorage). hydrate 전엔 건너뜀.
  useEffect(() => {
    if (!hydratedRef.current) return
    if (!signalDate) return

    saveState(symbol, { signalDate, completedSteps: completed })

    if (user) {
      updatePosition(symbol, {
        market: 'KR',
        completed_stages: completed,
        signal_date: signalDate,
      }).catch(() => {})
    }
  }, [symbol, signalDate, completed, user])

  const handleToggle = useCallback((idx: number) => {
    setCompleted(prev =>
      prev.includes(idx)
        ? prev.filter(v => v !== idx)
        : [...prev, idx].sort()
    )
  }, [])

  const handleReset = useCallback(() => {
    setCompleted([])
    clearState(symbol)
  }, [symbol])

  // SELL / NEUTRAL 분기
  if (signalState === 'SELL') {
    const distToBuy = rsiVal - 40
    return (
      <div className="panel" style={{ padding: 0 }}>
        <div className="flex justify-between items-center" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <span style={{ color: 'var(--warn)', fontSize: 13 }}>⏱</span>
            <div>
              <div className="label">ENTRY PLAN · 분할매수</div>
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                직전 신호: <span style={{ color: 'var(--down)' }}>{lastSignalText || 'SELL'}</span>{lastSignalDate ? ` (${lastSignalDate})` : ''}
              </div>
            </div>
          </div>
          <span className="chip chip-warn">BUY 대기</span>
        </div>
        <div style={{ padding: 12, fontSize: 11, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>
          <div style={{ marginBottom: 6 }}>직전 SELL — 신규 매수 보류</div>
          <div style={{ color: 'var(--fg-3)' }}>
            {distToBuy > 0
              ? <>다음 BUY 조건: RSI {rsiVal.toFixed(0)} → <span style={{ color: 'var(--up)', fontWeight: 600 }}>40 이하</span> ({distToBuy.toFixed(0)}pt) + BB 하단</>
              : <>RSI 조건 근접 — BB 하단 터치 시 BUY 신호 가능</>}
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--fg-4)', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 10 }}>
            * 투자 참고 정보이며, 투자 판단은 본인 책임입니다.
          </div>
        </div>
      </div>
    )
  }

  if (signalState === 'NEUTRAL') {
    const distToBuy = rsiVal - 40
    return (
      <div className="panel" style={{ padding: 0 }}>
        <div className="flex justify-between items-center" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <span style={{ color: 'var(--fg-3)', fontSize: 13 }}>○</span>
            <div>
              <div className="label">ENTRY PLAN · 분할매수</div>
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>신호 대기 중</div>
            </div>
          </div>
          <span className="chip chip-ghost">대기</span>
        </div>
        <div style={{ padding: 12, fontSize: 11, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>
          <div style={{ marginBottom: 6 }}>BUY/SELL 신호 발생 시 가이드가 활성화됩니다.</div>
          {distToBuy > 0 && (
            <div style={{ color: 'var(--fg-3)' }}>
              BUY 조건: RSI {rsiVal.toFixed(0)} → <span style={{ color: 'var(--up)', fontWeight: 600 }}>40 이하</span> ({distToBuy.toFixed(0)}pt)
            </div>
          )}
          <div style={{ fontSize: 9.5, color: 'var(--fg-4)', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 10 }}>
            * 투자 참고 정보이며, 투자 판단은 본인 책임입니다.
          </div>
        </div>
      </div>
    )
  }

  // BUY 단계 체크 — 3단계 자유 선택 (조건 미충족은 텍스트로만 안내)
  const stages = getStepDefs(rsiVal, bbVal, ema20Val, ema50Val)
  const totalCompleted = completed.length
  const summary = totalCompleted === 3 ? '풀 포지션 완료' : totalCompleted > 0 ? `${totalCompleted}/3 완료` : '1차 대기'

  return (
    <div className="panel" style={{ padding: 0 }}>
      <div className="flex justify-between items-center" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <span style={{ color: 'var(--up)', fontSize: 13 }}>↗</span>
          <div>
            <div className="label">ENTRY PLAN · 분할매수</div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
              직전 신호: <span style={{ color: 'var(--mag)' }}>{lastSignalText || 'BUY'}</span>{lastSignalDate ? ` (${lastSignalDate})` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 6 }}>
          <span className={totalCompleted === 3 ? 'chip chip-up' : 'chip chip-ghost'}>{summary}</span>
          {totalCompleted > 0 && (
            <button onClick={handleReset} title="리셋" style={{ color: 'var(--fg-3)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}>
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col" style={{ padding: 12, gap: 8 }}>
        {stages.map((st, i) => {
          const isCompleted = completed.includes(i)
          const borderColor = isCompleted ? 'var(--up)' : st.conditionMet ? 'var(--up)' : 'var(--border)'
          const bg = 'var(--bg-1)'

          return (
            <div
              key={st.label}
              onClick={() => handleToggle(i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleToggle(i)
                }
              }}
              style={{
                border: `1px solid ${borderColor}`,
                borderRadius: 4,
                padding: '10px 12px',
                background: bg,
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background 120ms ease',
              }}
            >
              <div className="flex items-center" style={{ gap: 10 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggle(i)
                  }}
                  aria-label={isCompleted ? `${st.label} 완료 해제` : `${st.label} 매수 완료`}
                  aria-pressed={isCompleted}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: `1.5px solid ${isCompleted ? 'var(--up)' : 'var(--fg-3)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    background: isCompleted ? 'var(--up)' : 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 120ms ease',
                  }}
                >
                  {isCompleted && <Check size={12} style={{ color: '#fff' }} strokeWidth={3} />}
                </button>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>{st.label}</span>
                <span
                  style={{
                    fontSize: 10,
                    background: 'var(--bg-3)',
                    padding: '1px 5px',
                    borderRadius: 2,
                    color: 'var(--fg-1)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                  }}
                >
                  {st.pct}%
                </span>
                {isCompleted && <span style={{ fontSize: 10, color: 'var(--up)', fontWeight: 600 }}>완료</span>}
                {!isCompleted && st.conditionMet && <span style={{ fontSize: 10, color: 'var(--up)', fontWeight: 600 }}>조건 충족</span>}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: 'var(--fg-2)',
                  marginTop: 6,
                  paddingLeft: 32,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {st.cond} · <span style={{ color: isCompleted || st.conditionMet ? 'var(--fg-0)' : 'var(--fg-3)' }}>{st.currentValue}</span>
              </div>
            </div>
          )
        })}
        {!user && (
          <div style={{ fontSize: 10, color: 'var(--accent)', opacity: 0.8 }}>
            💡 로그인하면 기기 간 포지션 상태가 동기화됩니다.
          </div>
        )}
        <div
          style={{
            fontSize: 9.5,
            color: 'var(--fg-4)',
            borderTop: '1px solid var(--border)',
            paddingTop: 6,
          }}
        >
          * 투자 참고 정보이며, 투자 판단은 본인 책임입니다.
        </div>
      </div>
    </div>
  )
}

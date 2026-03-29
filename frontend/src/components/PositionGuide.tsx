import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, CheckCircle2, Circle, Clock, RotateCcw, TrendingUp } from 'lucide-react'
import apiClient from '../api/client'
import { useAuthStore } from '../store/authStore'

interface Props {
  symbol: string
  signalState: string    // BUY / SELL / NEUTRAL (차트 마지막 마커 기준)
  lastSignalText?: string
  lastSignalDate?: string
  rsi: number
  bbPctB: number
  ema20: number
  ema50: number
}

interface StepDef {
  label: string
  ratio: string
  condition: string
  conditionMet: boolean
  currentValue: string
}

interface SavedState {
  signalDate: string  // BUY 신호 날짜 — 새 신호 시 리셋
  completedSteps: number[]  // 완료된 단계 인덱스 [0, 1, 2]
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

function getBuyStepDefs(rsi: number, bbPctB: number, ema20: number, ema50: number): StepDef[] {
  return [
    {
      label: '1차 진입',
      ratio: '30%',
      condition: 'BUY 신호 발생 시 진입',
      conditionMet: true,  // BUY 신호가 나왔으므로 1차는 항상 진입 가능
      currentValue: `RSI ${rsi.toFixed(0)} · BB ${(bbPctB * 100).toFixed(0)}%`,
    },
    {
      label: '2차 추가',
      ratio: '30%',
      condition: 'RSI < 30 (추가 과매도)',
      conditionMet: rsi < 30,
      currentValue: `RSI ${rsi.toFixed(0)}${rsi >= 30 ? ` → 30 이하 (${(rsi - 30).toFixed(0)}pt)` : ' 충족'}`,
    },
    {
      label: '3차 추가',
      ratio: '40%',
      condition: 'EMA20 > EMA50 (BULL 확인)',
      conditionMet: ema20 > ema50,
      currentValue: ema20 > ema50 ? '상승추세 확인' : `EMA20 ${ema20.toFixed(0)} < EMA50 ${ema50.toFixed(0)}`,
    },
  ]
}

export default function PositionGuide({ symbol, signalState, lastSignalText, lastSignalDate, rsi, bbPctB, ema20, ema50 }: Props) {
  const signalLabel = lastSignalText ? `${lastSignalText} (${lastSignalDate})` : ''

  // === BUY 가이드 ===
  if (signalState === 'BUY') {
    return (
      <BuyGuide
        symbol={symbol}
        signalLabel={signalLabel}
        signalDate={lastSignalDate || ''}
        rsi={rsi}
        bbPctB={bbPctB}
        ema20={ema20}
        ema50={ema50}
      />
    )
  }

  // === SELL → BUY 대기 ===
  if (signalState === 'SELL') {
    const distToBuy = rsi - 40
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 md:p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-yellow-400" />
            <span className="text-sm font-bold text-yellow-400">포지션 가이드 — BUY 신호 대기</span>
          </div>
          <span className="text-[10px] text-[var(--muted)]">직전: {signalLabel}</span>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-2">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={14} className="text-yellow-400" />
            <span className="text-xs font-bold text-yellow-400">직전 SELL 신호 — 신규 매수 보류</span>
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            새로운 BUY 신호가 나올 때까지 매수를 보류하세요.
          </p>
        </div>
        <div className="text-[10px] text-[var(--muted)]">
          {distToBuy > 0 ? (
            <span>다음 BUY 조건: RSI {rsi.toFixed(0)} → <span className="text-green-400 font-bold">40 이하</span> ({distToBuy.toFixed(0)}pt) + BB 하단</span>
          ) : (
            <span>RSI 조건 근접 — BB 하단 터치 시 BUY 신호 가능</span>
          )}
        </div>
        <Disclaimer />
      </div>
    )
  }

  // === NEUTRAL ===
  const distToBuy = rsi - 40
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 md:p-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Circle size={16} className="text-slate-400" />
        <span className="text-sm font-bold text-slate-400">포지션 가이드 — 신호 대기 중</span>
      </div>
      <p className="text-xs text-[var(--muted)] mb-2">BUY/SELL 신호 발생 시 가이드가 활성화됩니다.</p>
      {distToBuy > 0 && (
        <div className="text-[10px] text-[var(--muted)]">
          BUY 조건: RSI {rsi.toFixed(0)} → <span className="text-green-400 font-bold">40 이하</span> ({distToBuy.toFixed(0)}pt)
        </div>
      )}
      <Disclaimer />
    </div>
  )
}

// ── BUY 가이드 (순차 체크 + localStorage / 서버 동기화) ──────────────────
function BuyGuide({ symbol, signalLabel, signalDate, rsi, bbPctB, ema20, ema50 }: {
  symbol: string; signalLabel: string; signalDate: string
  rsi: number; bbPctB: number; ema20: number; ema50: number
}) {
  const stepDefs = getBuyStepDefs(rsi, bbPctB, ema20, ema50)
  const { user } = useAuthStore()

  // localStorage에서 상태 로드 (신호 날짜가 다르면 리셋)
  const [completed, setCompleted] = useState<number[]>(() => {
    const saved = loadState(symbol)
    if (saved && saved.signalDate === signalDate) return saved.completedSteps
    return []
  })

  // 로그인 시 서버에서 상태 로드
  useEffect(() => {
    if (!user) return
    apiClient.get(`/api/position/${symbol}`, { params: { market: 'KR' } })
      .then(res => {
        const stages: number[] = res.data.completed_stages ?? []
        if (stages.length > 0) setCompleted(stages)
      })
      .catch(() => {})
  }, [symbol, user])

  // 신호 날짜 변경 시 리셋
  useEffect(() => {
    const saved = loadState(symbol)
    if (saved && saved.signalDate !== signalDate) {
      setCompleted([])
      clearState(symbol)
    }
  }, [symbol, signalDate])

  // 상태 저장 (localStorage + 서버)
  useEffect(() => {
    if (signalDate) {
      saveState(symbol, { signalDate, completedSteps: completed })
    }
    if (user) {
      apiClient.put(`/api/position/${symbol}`, { market: 'KR', completed_stages: completed })
        .catch(() => {})
    }
  }, [symbol, signalDate, completed, user])

  const handleComplete = useCallback((stepIndex: number) => {
    setCompleted(prev => {
      if (prev.includes(stepIndex)) return prev
      return [...prev, stepIndex].sort()
    })
  }, [])

  const handleReset = useCallback(() => {
    setCompleted([])
    clearState(symbol)
  }, [symbol])

  // 단계 활성화 조건: 1차는 항상, 2차/3차는 1차 완료 후 조건 충족 시 독립 활성
  const step1Done = completed.includes(0)

  // 요약
  const totalCompleted = completed.length
  const summary = totalCompleted === 3 ? '풀 포지션 완료'
    : totalCompleted > 0 ? `${totalCompleted}/3 단계 완료`
    : '1차 진입 대기'

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 md:p-3 mb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-green-400" />
          <span className="text-sm font-bold text-green-400">분할매수 가이드</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${totalCompleted === 3 ? 'text-green-400' : 'text-[var(--muted)]'}`}>{summary}</span>
          {totalCompleted > 0 && (
            <button onClick={handleReset} className="text-[var(--muted)] hover:text-white transition" title="리셋">
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="text-[10px] text-[var(--muted)] mb-3 ml-6">직전 신호: {signalLabel}</div>

      <div className="space-y-2">
        {stepDefs.map((step, i) => {
          const isCompleted = completed.includes(i)
          // 1차는 항상 활성, 2차/3차는 1차 완료 후 조건 충족 시 독립 활성
          const isUnlocked = i === 0 || step1Done
          const isLocked = !isUnlocked
          const canAct = isUnlocked && step.conditionMet && !isCompleted

          return (
            <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border transition ${
              isCompleted ? 'border-green-500/40 bg-green-500/10'
              : canAct ? 'border-green-500/60 bg-green-500/15 ring-1 ring-green-500/30'
              : isLocked ? 'border-[var(--border)] bg-[var(--bg)] opacity-50'
              : 'border-[var(--border)] bg-[var(--bg)]'
            }`}>
              {/* 아이콘 */}
              {isCompleted
                ? <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                : isLocked
                  ? <Circle size={18} className="text-[var(--border)] shrink-0" />
                  : step.conditionMet
                    ? <div className="w-[18px] h-[18px] rounded-full border-2 border-green-400 bg-green-400/20 shrink-0 animate-pulse" />
                    : <Circle size={18} className="text-[var(--border)] shrink-0" />
              }

              {/* 내용 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${isCompleted ? 'text-green-400' : isLocked ? 'text-[var(--muted)]' : 'text-white'}`}>
                    {step.label}
                  </span>
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                    isCompleted ? 'bg-green-500/20 text-green-400'
                    : canAct ? 'bg-green-500/20 text-green-400'
                    : 'bg-[var(--border)] text-[var(--muted)]'
                  }`}>
                    {step.ratio}
                  </span>
                  {isCompleted && <span className="text-[9px] text-green-400">완료</span>}
                  {isLocked && <span className="text-[9px] text-[var(--muted)]">1차 매수 완료 필요</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[var(--muted)]">{step.condition}</span>
                  <span className="text-[10px] text-[var(--muted)]">·</span>
                  <span className={`text-[10px] font-mono ${
                    isCompleted ? 'text-green-400' : step.conditionMet && !isLocked ? 'text-white' : 'text-[var(--muted)]'
                  }`}>
                    {step.currentValue}
                  </span>
                </div>
              </div>

              {/* 체크 버튼 */}
              {canAct && (
                <button
                  onClick={() => handleComplete(i)}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition active:scale-95"
                >
                  <Check size={12} />
                  매수 완료
                </button>
              )}
            </div>
          )
        })}
      </div>

      {!user && (
        <p className="text-[9px] text-blue-400/70 mt-2">
          💡 로그인하면 기기 간 포지션 상태가 동기화됩니다
        </p>
      )}
      <Disclaimer />
    </div>
  )
}

function Disclaimer() {
  return (
    <p className="text-[8px] text-[var(--muted)] mt-3 opacity-60">
      * 투자 참고 정보이며, 투자 판단은 본인 책임입니다
    </p>
  )
}

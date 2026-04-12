import { Check, Database, Loader2, MessageCircle, Play, Send, Settings as SettingsIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { fetchFullScanHistory, fetchFullScanStatus, getSensitivity, getTelegram, setSensitivity, setTelegram, testBuyAlert, testTelegram, triggerFullScan } from '../api/client'
import { useToastStore } from '../stores/toastStore'
import { useAuthStore } from '../store/authStore'
import { LoginButton } from '../components/LoginButton'
import { usePageSwipe } from '../hooks/usePageSwipe'
import { UserMenu } from '../components/UserMenu'


const SENSITIVITIES = [
  {
    value: 'strict', label: '엄격', desc: '4/4 조건 충족 시 신호 발생',
    detail: 'RSI<30, %B≤0.05, MACD↑, 거래량>1.2x',
    color: 'text-blue-400', bg: 'bg-blue-600/20', border: 'border-blue-500/50',
  },
  {
    value: 'normal', label: '보통', desc: '3/4 조건 충족 시 신호 발생',
    detail: 'RSI<35, %B≤0.15, MACD↑, 거래량>1.1x',
    color: 'text-yellow-400', bg: 'bg-yellow-600/20', border: 'border-yellow-500/50',
  },
  {
    value: 'sensitive', label: '민감', desc: '2/4 조건 충족 시 신호 발생',
    detail: 'RSI<40, %B≤0.25, MACD↑, 거래량>1.0x',
    color: 'text-red-400', bg: 'bg-red-600/20', border: 'border-red-500/50',
  },
]

function SnapHdr({ title, color, currentSection, total }: {
  title: string; color: string; currentSection: number; total: number
}) {
  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0 border-b border-[var(--border)]/50">
      <h2 className={`text-display font-bold ${color}`}>{title}</h2>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${
            i === currentSection
              ? `w-4 ${color.replace('text-', 'bg-')}`
              : 'w-1.5 bg-white/20'
          }`} />
        ))}
      </div>
    </div>
  )
}

export default function Settings() {
  const { user } = useAuthStore()
  const snapRef = useRef<HTMLDivElement>(null)
  const [currentSection, setCurrentSection] = useState(0)
  const [currentSens, setCurrentSens] = useState('strict')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // 텔레그램
  const [tgToken, setTgToken] = useState('')
  const [tgTokenHint, setTgTokenHint] = useState('')
  const [tgChatId, setTgChatId] = useState('')
  const [tgConfigured, setTgConfigured] = useState(false)
  const [tgSaving, setTgSaving] = useState(false)
  const [tgMsg, setTgMsg] = useState('')
  const [tgMsgType, setTgMsgType] = useState<'ok' | 'err'>('ok')
  const [tgTesting, setTgTesting] = useState(false)

  // 전체 스캔 모니터링
  const [scanHistory, setScanHistory] = useState<Array<{
    id: number; status: string; total_symbols: number; scanned_count: number;
    picks_count: number; max_sq_count: number; buy_count: number;
    error_message: string | null; started_at: string; completed_at: string | null;
    elapsed_seconds: number | null;
  }>>([])
  const [scanStatus, setScanStatus] = useState<{
    running: boolean; progress_pct: number; elapsed_seconds: number;
    scanned_count: number; total_symbols: number; last_completed_at: string | null;
  } | null>(null)
  const [scanTriggering, setScanTriggering] = useState(false)

  useEffect(() => {
    const el = snapRef.current
    if (!el) return
    const onScroll = () => {
      const h = el.clientHeight
      if (h > 0) setCurrentSection(Math.round(el.scrollTop / h))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    getSensitivity().then(d => setCurrentSens(d.current)).catch(() => {})
    getTelegram().then(d => {
      setTgConfigured(d.configured)
      setTgToken('')  // 토큰은 항상 빈 값으로 — 변경 시 새로 입력
      setTgTokenHint(d.bot_token_hint || '')
      setTgChatId(d.chat_id)
    }).catch(() => {})
    fetchFullScanHistory(10).then(setScanHistory).catch(() => {})
    fetchFullScanStatus().then(setScanStatus).catch(() => {})
  }, [])

  // 스캔 진행 중이면 5초 폴링
  useEffect(() => {
    if (!scanStatus?.running) return
    const timer = setInterval(async () => {
      try {
        const s = await fetchFullScanStatus()
        setScanStatus(s)
        if (!s.running) {
          clearInterval(timer)
          fetchFullScanHistory(10).then(setScanHistory).catch(() => {})
        }
      } catch { /* ignore */ }
    }, 5000)
    return () => clearInterval(timer)
  }, [scanStatus?.running])

  const handleFullScanTrigger = async () => {
    setScanTriggering(true)
    try {
      const res = await triggerFullScan()
      if (res.status === 'started') {
        addToast('success', '전체 시장 스캔 시작됨')
        setScanStatus(prev => prev ? { ...prev, running: true, progress_pct: 0, elapsed_seconds: 0 } : null)
        // 폴링 시작을 위해 상태 갱신
        setTimeout(async () => {
          const s = await fetchFullScanStatus()
          setScanStatus(s)
        }, 2000)
      } else if (res.status === 'already_running') {
        addToast('error', '이미 스캔이 진행 중입니다')
      }
    } catch {
      addToast('error', '스캔 트리거 실패')
    } finally { setScanTriggering(false) }
  }

  const handleSensChange = async (level: string) => {
    setSaving(true); setMsg('')
    try {
      await setSensitivity(level)
      setCurrentSens(level)
      const label = SENSITIVITIES.find(s => s.value === level)?.label
      setMsg(`신호 민감도 → ${label}`)
      setTimeout(() => setMsg(''), 3000)
    } catch { setMsg('변경 실패'); setTimeout(() => setMsg(''), 3000) }
    finally { setSaving(false) }
  }

  const handleTgSave = async () => {
    // 기존 설정이 있는 경우 토큰 비워도 Chat ID만 변경 가능
    if ((!tgToken && !tgConfigured) || !tgChatId) {
      setTgMsg('토큰과 Chat ID를 모두 입력하세요')
      setTgMsgType('err')
      setTimeout(() => setTgMsg(''), 3000)
      return
    }
    if (!tgToken && tgConfigured) {
      setTgMsg('토큰을 변경하지 않으려면 기존 토큰을 다시 입력하세요')
      setTgMsgType('err')
      setTimeout(() => setTgMsg(''), 3000)
      return
    }
    setTgSaving(true); setTgMsg('')
    try {
      await setTelegram({ bot_token: tgToken, chat_id: tgChatId })
      setTgConfigured(true)
      setTgMsg('텔레그램 설정 저장 완료')
      setTgMsgType('ok')
      const d = await getTelegram()
      setTgToken('')
      setTgTokenHint(d.bot_token_hint || '')
      setTgChatId(d.chat_id)
      setTimeout(() => setTgMsg(''), 3000)
    } catch {
      setTgMsg('저장 실패')
      setTgMsgType('err')
      setTimeout(() => setTgMsg(''), 3000)
    } finally { setTgSaving(false) }
  }

  const handleTgTest = async () => {
    setTgTesting(true); setTgMsg('')
    try {
      const res = await testTelegram()
      setTgMsg(res.message)
      setTgMsgType(res.status === 'ok' ? 'ok' : 'err')
      setTimeout(() => setTgMsg(''), 5000)
    } catch {
      setTgMsg('테스트 발송 실패')
      setTgMsgType('err')
      setTimeout(() => setTgMsg(''), 3000)
    } finally { setTgTesting(false) }
  }

  const { addToast } = useToastStore()
  const [buyAlertTesting, setBuyAlertTesting] = useState(false)

  const handleBuyAlertTest = async () => {
    setBuyAlertTesting(true)
    try {
      const res = await testBuyAlert()
      if (res.status === 'error') {
        addToast('error', res.message)
      } else {
        addToast('success', res.message || `BUY 신호 ${res.symbol_count}종목 전송 완료`)
      }
    } catch {
      addToast('error', 'BUY 신호 알림 테스트 실패')
    } finally { setBuyAlertTesting(false) }
  }

  const sH = 'calc(100dvh - 64px)'
  usePageSwipe(snapRef)

  // ── 공통 섹션 내용 블록 ──────────────────────────────────────
  const profileBlock = (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between">
      {user ? (
        <>
          <div>
            <p className="text-sm font-medium text-[var(--text)]">{user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email}</p>
            <p className="text-xs text-[var(--muted)]">{user.email}</p>
          </div>
          <UserMenu />
        </>
      ) : (
        <>
          <p className="text-sm text-[var(--muted)]">로그인하면 개인화 기능을 사용할 수 있습니다</p>
          <LoginButton />
        </>
      )}
    </div>
  )

  const sensitivityBlock = (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <h2 className="text-[var(--text)] font-semibold mb-1">BUY/SELL 신호 민감도</h2>
      <p className="text-xs text-[var(--muted)] mb-3">민감도가 높을수록 신호가 자주 발생합니다</p>
      <div className="space-y-2">
        {SENSITIVITIES.map(s => (
          <button key={s.value} onClick={() => handleSensChange(s.value)} disabled={saving}
            className={`w-full text-left px-4 py-3 rounded-lg transition ${
              currentSens === s.value ? `${s.bg} border ${s.border}` : 'bg-[var(--bg)] border border-transparent hover:border-[var(--border)]'
            } disabled:opacity-50`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${currentSens === s.value ? s.color.replace('text-', 'bg-') : 'bg-[var(--border)]'}`} />
                <span className={`text-sm font-bold ${currentSens === s.value ? s.color : 'text-[var(--muted)]'}`}>{s.label}</span>
              </div>
              <span className="text-xs text-[var(--muted)]">{s.desc}</span>
            </div>
            <div className="text-caption text-[var(--muted)] ml-4 font-mono">{s.detail}</div>
          </button>
        ))}
      </div>
    </div>
  )

  const telegramBlock = (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <h2 className="text-[var(--text)] font-semibold mb-1 flex items-center gap-2">
        <MessageCircle size={16} className="text-sky-400" /> 텔레그램 알림
      </h2>
      <p className="text-xs text-[var(--muted)] mb-3">BUY/SELL 신호 전환 시 텔레그램으로 실시간 알림을 받습니다</p>
      {tgMsg && (
        <div className={`mb-3 text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
          tgMsgType === 'ok' ? 'text-[var(--buy)] bg-[var(--buy)]/10' : 'text-[var(--sell)] bg-[var(--sell)]/10'
        }`}>
          {tgMsgType === 'ok' ? <Check size={14} /> : null} {tgMsg}
        </div>
      )}
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">Bot Token</label>
          <input type="text" value={tgToken} onChange={e => setTgToken(e.target.value)}
            placeholder={tgTokenHint || '123456:ABC-DEF...'} autoComplete="off"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--muted)] focus:border-sky-500 focus:outline-none" />
          <p className="text-caption text-[var(--muted)] mt-1">{tgConfigured ? '변경 시에만 새 토큰 입력 (현재 설정됨)' : '@BotFather에서 봇 생성 후 발급'}</p>
        </div>
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">Chat ID</label>
          <input type="text" value={tgChatId} onChange={e => setTgChatId(e.target.value)}
            placeholder="-1001234567890" autoComplete="off"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--muted)] focus:border-sky-500 focus:outline-none" />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={handleTgSave} disabled={tgSaving}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm rounded-lg transition disabled:opacity-50">
            {tgSaving ? '저장 중...' : '저장'}
          </button>
          <button onClick={handleTgTest} disabled={tgTesting || !tgConfigured}
            className="px-4 py-2 bg-[var(--bg)] border border-[var(--border)] hover:border-sky-500 text-[var(--muted)] hover:text-white text-sm rounded-lg transition disabled:opacity-50 flex items-center gap-1">
            <Send size={14} />{tgTesting ? '발송 중...' : '테스트 발송'}
          </button>
        </div>
        {tgConfigured && <div className="text-caption text-green-400 flex items-center gap-1 mt-1"><Check size={12} /> 텔레그램 연동됨</div>}
      </div>
    </div>
  )

  return (
    <>
      {/* ── Mobile snap layout ── */}
      <div
        ref={snapRef}
        className="md:hidden fixed inset-x-0 top-0"
        style={{ bottom: '64px', overflowY: 'scroll', scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none' } as any}
      >
        {/* Section 1: 프로필 + 신호 민감도 */}
        <div className="flex flex-col bg-[var(--bg)]" style={{ height: sH, scrollSnapAlign: 'start' }}>
          <SnapHdr title="신호 설정" color="text-blue-400" currentSection={currentSection} total={3} />
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3 space-y-4" style={{ overscrollBehaviorY: 'contain' } as any}>
            {profileBlock}
            {msg && (
              <div className="text-xs text-green-400 bg-green-400/10 px-3 py-2 rounded-lg flex items-center gap-2">
                <Check size={14} /> {msg}
              </div>
            )}
            {sensitivityBlock}
          </div>
        </div>

        {/* Section 2: 텔레그램 */}
        <div className="flex flex-col bg-[var(--bg)]" style={{ height: sH, scrollSnapAlign: 'start' }}>
          <SnapHdr title="텔레그램 알림" color="text-sky-400" currentSection={currentSection} total={3} />
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3 space-y-4" style={{ overscrollBehaviorY: 'contain' } as any}>
            {telegramBlock}
            {tgConfigured && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <h2 className="text-[var(--text)] font-semibold mb-1 flex items-center gap-2">
                  <MessageCircle size={16} className="text-[var(--buy)]" /> BUY 신호 정기 알림
                </h2>
                <p className="text-xs text-[var(--muted)] mb-3">평일 10:30 / 15:00 국내주식 BUY 신호 자동 발송</p>
                <button onClick={handleBuyAlertTest} disabled={buyAlertTesting}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition disabled:opacity-50 flex items-center gap-1">
                  <Send size={14} />{buyAlertTesting ? '전송 중...' : 'BUY 신호 알림 테스트'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: 스캔 모니터링 */}
        <div className="flex flex-col bg-[var(--bg)]" style={{ height: sH, scrollSnapAlign: 'start' }}>
          <SnapHdr title="스캔 모니터링" color="text-purple-400" currentSection={currentSection} total={3} />
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3 space-y-4" style={{ overscrollBehaviorY: 'contain' } as any}>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
              <h2 className="text-[var(--text)] font-semibold mb-1 flex items-center gap-2">
                <Database size={16} className="text-purple-400" /> 전체 시장 스캔
              </h2>
              <p className="text-xs text-[var(--muted)] mb-3">국내 351 / 미국 835 전종목 스캔</p>
              {scanStatus?.running && (
                <div className="mb-3 bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-purple-400 text-sm mb-2">
                    <Loader2 size={14} className="animate-spin" />
                    스캔 진행 중... {scanStatus.progress_pct}%
                  </div>
                  <div className="w-full bg-[var(--bg)] rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${scanStatus.progress_pct}%` }} />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <button onClick={handleFullScanTrigger} disabled={scanTriggering || scanStatus?.running}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition disabled:opacity-50 flex items-center gap-1">
                  <Play size={14} />{scanTriggering ? '시작 중...' : scanStatus?.running ? '진행 중...' : '수동 스캔 실행'}
                </button>
                {scanStatus?.last_completed_at && (
                  <span className="text-xs text-[var(--muted)]">
                    완료: {new Date(scanStatus.last_completed_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PC layout ── */}
      <div className="hidden md:block p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-[var(--text)] flex items-center gap-2 mb-6">
        <SettingsIcon size={22} className="text-blue-400" /> 설정
      </h1>

      {/* 모바일 로그인 섹션 (PC 헤더에 없는 경우 표시) */}
      <div className="md:hidden bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-6 flex items-center justify-between">
        {user ? (
          <>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">{user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email}</p>
              <p className="text-xs text-[var(--muted)]">{user.email}</p>
            </div>
            <UserMenu />
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--muted)]">로그인하면 개인화 기능을 사용할 수 있습니다</p>
            <LoginButton />
          </>
        )}
      </div>

      {msg && (
        <div className="mb-4 text-xs text-[var(--buy)] bg-[var(--buy)]/10 px-3 py-2 rounded-lg flex items-center gap-2">
          <Check size={14} /> {msg}
        </div>
      )}

      {/* 신호 민감도 */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 mb-6">
        <h2 className="text-[var(--text)] font-semibold mb-1">BUY/SELL 신호 민감도</h2>
        <p className="text-xs text-[var(--muted)] mb-4">민감도가 높을수록 신호가 자주 발생합니다</p>

        <div className="space-y-2">
          {SENSITIVITIES.map(s => (
            <button key={s.value}
              onClick={() => handleSensChange(s.value)}
              disabled={saving}
              className={`w-full text-left px-4 py-3 rounded-lg transition ${
                currentSens === s.value
                  ? `${s.bg} border ${s.border}`
                  : 'bg-[var(--bg)] border border-transparent hover:border-[var(--border)]'
              } disabled:opacity-50`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${currentSens === s.value ? s.color.replace('text-', 'bg-') : 'bg-[var(--border)]'}`} />
                  <span className={`text-sm font-bold ${currentSens === s.value ? s.color : 'text-[var(--muted)]'}`}>{s.label}</span>
                </div>
                <span className="text-xs text-[var(--muted)]">{s.desc}</span>
              </div>
              <div className="text-caption text-[var(--muted)] ml-4 font-mono">{s.detail}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 텔레그램 알림 */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 mt-6">
        <h2 className="text-[var(--text)] font-semibold mb-1 flex items-center gap-2">
          <MessageCircle size={16} className="text-sky-400" /> 텔레그램 알림
        </h2>
        <p className="text-xs text-[var(--muted)] mb-4">
          BUY/SELL 신호 전환 시 텔레그램으로 실시간 알림을 받습니다
        </p>

        {tgMsg && (
          <div className={`mb-3 text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
            tgMsgType === 'ok' ? 'text-[var(--buy)] bg-[var(--buy)]/10' : 'text-[var(--sell)] bg-[var(--sell)]/10'
          }`}>
            {tgMsgType === 'ok' ? <Check size={14} /> : null} {tgMsg}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Bot Token</label>
            <input
              type="text"
              value={tgToken}
              onChange={e => setTgToken(e.target.value)}
              placeholder={tgTokenHint || '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--muted)] focus:border-sky-500 focus:outline-none"
            />
            <p className="text-caption text-[var(--muted)] mt-1">
              {tgConfigured ? '변경 시에만 새 토큰 입력 (현재 설정됨)' : '@BotFather에서 봇 생성 후 받은 토큰'}
            </p>
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Chat ID</label>
            <input
              type="text"
              value={tgChatId}
              onChange={e => setTgChatId(e.target.value)}
              placeholder="-1001234567890"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--muted)] focus:border-sky-500 focus:outline-none"
            />
            <p className="text-caption text-[var(--muted)] mt-1">@userinfobot으로 확인 가능 (그룹은 - 접두사)</p>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleTgSave}
              disabled={tgSaving}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm rounded-lg transition disabled:opacity-50"
            >
              {tgSaving ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={handleTgTest}
              disabled={tgTesting || !tgConfigured}
              className="px-4 py-2 bg-[var(--bg)] border border-[var(--border)] hover:border-sky-500 text-[var(--muted)] hover:text-white text-sm rounded-lg transition disabled:opacity-50 flex items-center gap-1"
            >
              <Send size={14} />
              {tgTesting ? '발송 중...' : '테스트 발송'}
            </button>
          </div>
          {tgConfigured && (
            <div className="text-caption text-green-400 flex items-center gap-1 mt-1">
              <Check size={12} /> 텔레그램 연동됨
            </div>
          )}
        </div>
      </div>

      {/* BUY 신호 알림 */}
      {tgConfigured && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 mt-6">
          <h2 className="text-[var(--text)] font-semibold mb-1 flex items-center gap-2">
            <MessageCircle size={16} className="text-[var(--buy)]" /> BUY 신호 정기 알림
          </h2>
          <p className="text-xs text-[var(--muted)] mb-4">
            평일 오전 10:30 / 오후 3:00에 국내주식 BUY 신호 종목을 텔레그램으로 자동 발송합니다.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBuyAlertTest}
              disabled={buyAlertTesting}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition disabled:opacity-50 flex items-center gap-1"
            >
              <Send size={14} />
              {buyAlertTesting ? '전송 중...' : 'BUY 신호 알림 테스트'}
            </button>
            <a href="/alerts" className="text-xs text-sky-400 hover:text-sky-300 underline">
              알림 이력 보기 →
            </a>
          </div>
        </div>
      )}

      {/* 텔레그램 알림 조건표 */}
      {tgConfigured && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 mt-6">
          <h2 className="text-[var(--text)] font-semibold mb-3 flex items-center gap-2">
            <MessageCircle size={16} className="text-sky-400" /> 텔레그램 자동 알림 스케줄
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--muted)] border-b border-[var(--border)]">
                  <th className="text-left py-1.5 pr-3">발송 시각 (KST)</th>
                  <th className="text-left py-1.5 pr-3">종류</th>
                  <th className="text-left py-1.5">내용</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/40">
                <tr className="text-[var(--text)]">
                  <td className="py-2 pr-3 font-mono text-[var(--buy)]">평일 10:30</td>
                  <td className="py-2 pr-3 whitespace-nowrap">🟢 BUY 신호 알림 (국내)</td>
                  <td className="py-2 text-[var(--muted)]">전체 스캔 차트 BUY 종목 목록 (최대 20개)</td>
                </tr>
                <tr className="text-[var(--text)]">
                  <td className="py-2 pr-3 font-mono text-[var(--buy)]">평일 15:00</td>
                  <td className="py-2 pr-3 whitespace-nowrap">🟢 BUY 신호 알림 (국내)</td>
                  <td className="py-2 text-[var(--muted)]">전체 스캔 차트 BUY 종목 목록 (최대 20개)</td>
                </tr>
                <tr className="text-[var(--text)]">
                  <td className="py-2 pr-3 font-mono text-yellow-400">평일 09:00~15:30<br/><span className="text-caption text-[var(--muted)]">(30분마다)</span></td>
                  <td className="py-2 pr-3 whitespace-nowrap">🔴 SELL 체크 (국내 관심종목)</td>
                  <td className="py-2 text-[var(--muted)]">국내 관심종목 중 SELL 신호 종목 (장중 14회)</td>
                </tr>
                <tr className="text-[var(--text)]">
                  <td className="py-2 pr-3 font-mono text-yellow-400">평일 20:00</td>
                  <td className="py-2 pr-3 whitespace-nowrap">🔴 SELL 체크 (미국 관심종목)</td>
                  <td className="py-2 text-[var(--muted)]">미국 관심종목 중 SELL 신호 종목</td>
                </tr>
                <tr className="text-[var(--text)]">
                  <td className="py-2 pr-3 font-mono text-yellow-400">화~토 04:00</td>
                  <td className="py-2 pr-3 whitespace-nowrap">🔴 SELL 체크 (미국 관심종목 장중)</td>
                  <td className="py-2 text-[var(--muted)]">미국 장중 관심종목 중 SELL 신호 종목</td>
                </tr>
                <tr className="text-[var(--text)]">
                  <td className="py-2 pr-3 font-mono text-blue-400">평일 20:00</td>
                  <td className="py-2 pr-3 whitespace-nowrap">🔵 BUY 신호 알림 (미국)</td>
                  <td className="py-2 text-[var(--muted)]">미국 스캔 차트 BUY 종목 목록 (최대 20개)</td>
                </tr>
                <tr className="text-[var(--text)]">
                  <td className="py-2 pr-3 font-mono text-blue-400">화~토 04:00</td>
                  <td className="py-2 pr-3 whitespace-nowrap">🔵 BUY 신호 알림 (미국 장중)</td>
                  <td className="py-2 text-[var(--muted)]">미국 스캔 차트 BUY 종목 목록 (최대 20개)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-caption text-[var(--muted)] mt-3">
            ※ BUY 알림은 전체 시장 스캔 완료 후 발송 · SELL 체크는 관심종목에 등록된 종목만 대상
          </p>
        </div>
      )}

      {/* 전체 시장 스캔 모니터링 */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 mt-6">
        <h2 className="text-[var(--text)] font-semibold mb-1 flex items-center gap-2">
          <Database size={16} className="text-purple-400" /> 전체 시장 스캔
        </h2>
        <p className="text-xs text-[var(--muted)] mb-4">
          국내 351 / 미국 835 전종목 스캔 · 차트BUY/추천/과열 신호 저장<br />
          <span className="text-purple-300">국내</span>: 평일 9:30~15:30 매시 :30 (7회) &nbsp;
          <span className="text-blue-300">미국</span>: 평일 19:50 · 화~토 03:50 (2회)
        </p>

        {/* 진행 상태 */}
        {scanStatus?.running && (
          <div className="mb-4 bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-purple-400 text-sm mb-2">
              <Loader2 size={14} className="animate-spin" />
              스캔 진행 중... {scanStatus.scanned_count}/{scanStatus.total_symbols}종목 ({scanStatus.progress_pct}%)
            </div>
            <div className="w-full bg-[var(--bg)] rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${scanStatus.progress_pct}%` }}
              />
            </div>
            <div className="text-caption text-[var(--muted)] mt-1">
              경과: {scanStatus.elapsed_seconds}초
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleFullScanTrigger}
            disabled={scanTriggering || scanStatus?.running}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition disabled:opacity-50 flex items-center gap-1"
          >
            <Play size={14} />
            {scanTriggering ? '시작 중...' : scanStatus?.running ? '진행 중...' : '수동 스캔 실행'}
          </button>
          {scanStatus?.last_completed_at && (
            <span className="text-xs text-[var(--muted)]">
              마지막 완료: {new Date(scanStatus.last_completed_at).toLocaleString('ko-KR')}
            </span>
          )}
        </div>

        {/* 최근 스캔 이력 */}
        {scanHistory.length > 0 && (
          <div>
            <h3 className="text-sm text-[var(--muted)] mb-2">최근 스캔 이력</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="text-left py-1.5 pr-2">시간</th>
                    <th className="text-center py-1.5 px-1">상태</th>
                    <th className="text-right py-1.5 px-1">종목</th>
                    <th className="text-right py-1.5 px-1">추천</th>
                    <th className="text-right py-1.5 px-1">MAX</th>
                    <th className="text-right py-1.5 px-1">BUY</th>
                    <th className="text-right py-1.5 pl-1">소요</th>
                  </tr>
                </thead>
                <tbody>
                  {scanHistory.map(h => (
                    <tr key={h.id} className="border-b border-[var(--border)]/50 text-[var(--text)]">
                      <td className="py-1.5 pr-2 whitespace-nowrap text-[var(--muted)]">
                        {h.started_at ? new Date(h.started_at).toLocaleString('ko-KR', {
                          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                        }) : '-'}
                      </td>
                      <td className="py-1.5 px-1 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-caption font-medium ${
                          h.status === 'completed' ? 'bg-[var(--buy)]/20 text-[var(--buy)]' :
                          h.status === 'failed' ? 'bg-[var(--sell)]/20 text-[var(--sell)]' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {h.status === 'completed' ? '완료' : h.status === 'failed' ? '실패' : '진행중'}
                        </span>
                      </td>
                      <td className="py-1.5 px-1 text-right font-mono">
                        {h.scanned_count}/{h.total_symbols}
                      </td>
                      <td className="py-1.5 px-1 text-right text-yellow-400 font-mono">
                        {h.picks_count}
                      </td>
                      <td className="py-1.5 px-1 text-right text-orange-400 font-mono">
                        {h.max_sq_count}
                      </td>
                      <td className="py-1.5 px-1 text-right text-[var(--buy)] font-mono">
                        {h.buy_count}
                      </td>
                      <td className="py-1.5 pl-1 text-right text-[var(--muted)] font-mono">
                        {h.elapsed_seconds != null ? `${Math.floor(h.elapsed_seconds / 60)}분${h.elapsed_seconds % 60}초` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {scanHistory.length === 0 && !scanStatus?.running && (
          <div className="text-xs text-[var(--muted)] text-center py-4">
            아직 스캔 이력이 없습니다. 수동 스캔을 실행하거나 스케줄 시간을 기다려주세요.
          </div>
        )}
      </div>
      </div>
    </>
  )
}

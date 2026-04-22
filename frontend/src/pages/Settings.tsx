import { Check, Database, Loader2, MessageCircle, Play, Send, Settings as SettingsIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { fetchFullScanHistory, fetchFullScanStatus, getSensitivity, getTelegram, setSensitivity, setTelegram, testBuyAlert, testTelegram, triggerFullScan } from '../api/client'
import { useToastStore } from '../stores/toastStore'
import { useAuthStore } from '../store/authStore'
import { LoginButton } from '../components/LoginButton'
import { usePageSwipe } from '../hooks/usePageSwipe'
import { UserMenu } from '../components/UserMenu'

const SENSITIVITIES = [
  { value: 'strict',    label: '엄격',  desc: '4/4 조건 충족 시 신호 발생', detail: 'RSI<30, %B≤0.05, MACD↑, 거래량>1.2x', dotColor: 'var(--up)',   chipCls: 'chip chip-up'   },
  { value: 'normal',    label: '보통',  desc: '3/4 조건 충족 시 신호 발생', detail: 'RSI<35, %B≤0.15, MACD↑, 거래량>1.1x', dotColor: 'var(--warn)', chipCls: 'chip chip-warn' },
  { value: 'sensitive', label: '민감',  desc: '2/4 조건 충족 시 신호 발생', detail: 'RSI<40, %B≤0.25, MACD↑, 거래량>1.0x', dotColor: 'var(--down)', chipCls: 'chip chip-down' },
]

const SECTION_DOTS = [
  { label: '신호 설정',    color: 'var(--accent)' },
  { label: '텔레그램 알림', color: 'var(--up)' },
  { label: '스캔 모니터',  color: 'var(--mag)' },
]

function SnapHdr({ title, idx, currentSection, onDotClick }: {
  title: string; idx: number; currentSection: number; onDotClick: (i: number) => void
}) {
  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: SECTION_DOTS[idx].color, fontFamily: 'var(--font-sans)' }}>
        {title}
      </h2>
      <div style={{
        display: 'flex', gap: 5, alignItems: 'center',
        background: 'color-mix(in oklch, var(--bg-2), transparent 30%)',
        borderRadius: 8, padding: '4px 8px',
      }}>
        {SECTION_DOTS.map((s, i) => (
          <button
            key={i}
            onClick={() => onDotClick(i)}
            title={s.label}
            style={{
              height: 8, borderRadius: 4, transition: 'all 0.2s',
              width: i === currentSection ? 22 : 8,
              background: i === currentSection ? s.color : 'color-mix(in oklch, var(--fg-0), transparent 55%)',
              border: 'none', padding: 0, cursor: 'pointer',
            }}
          />
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
  const { addToast } = useToastStore()

  // 텔레그램
  const [tgToken, setTgToken] = useState('')
  const [tgTokenHint, setTgTokenHint] = useState('')
  const [tgChatId, setTgChatId] = useState('')
  const [tgConfigured, setTgConfigured] = useState(false)
  const [tgSaving, setTgSaving] = useState(false)
  const [tgMsg, setTgMsg] = useState('')
  const [tgMsgType, setTgMsgType] = useState<'ok' | 'err'>('ok')
  const [tgTesting, setTgTesting] = useState(false)
  const [buyAlertTesting, setBuyAlertTesting] = useState(false)

  // 스캔 모니터링
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
      setTgToken('')
      setTgTokenHint(d.bot_token_hint || '')
      setTgChatId(d.chat_id)
    }).catch(() => {})
    fetchFullScanHistory(10).then(setScanHistory).catch(() => {})
    fetchFullScanStatus().then(setScanStatus).catch(() => {})
  }, [])

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
    if ((!tgToken && !tgConfigured) || !tgChatId) {
      setTgMsg('토큰과 Chat ID를 모두 입력하세요'); setTgMsgType('err')
      setTimeout(() => setTgMsg(''), 3000); return
    }
    if (!tgToken && tgConfigured) {
      setTgMsg('변경 시에만 새 토큰 입력'); setTgMsgType('err')
      setTimeout(() => setTgMsg(''), 3000); return
    }
    setTgSaving(true); setTgMsg('')
    try {
      await setTelegram({ bot_token: tgToken, chat_id: tgChatId })
      setTgConfigured(true)
      setTgMsg('텔레그램 설정 저장 완료'); setTgMsgType('ok')
      const d = await getTelegram()
      setTgToken(''); setTgTokenHint(d.bot_token_hint || ''); setTgChatId(d.chat_id)
      setTimeout(() => setTgMsg(''), 3000)
    } catch {
      setTgMsg('저장 실패'); setTgMsgType('err')
      setTimeout(() => setTgMsg(''), 3000)
    } finally { setTgSaving(false) }
  }

  const handleTgTest = async () => {
    setTgTesting(true); setTgMsg('')
    try {
      const res = await testTelegram()
      setTgMsg(res.message); setTgMsgType(res.status === 'ok' ? 'ok' : 'err')
      setTimeout(() => setTgMsg(''), 5000)
    } catch {
      setTgMsg('테스트 발송 실패'); setTgMsgType('err')
      setTimeout(() => setTgMsg(''), 3000)
    } finally { setTgTesting(false) }
  }

  const handleBuyAlertTest = async () => {
    setBuyAlertTesting(true)
    try {
      const res = await testBuyAlert()
      if (res.status === 'error') addToast('error', res.message)
      else addToast('success', res.message || `BUY 신호 ${res.symbol_count}종목 전송 완료`)
    } catch { addToast('error', 'BUY 신호 알림 테스트 실패') }
    finally { setBuyAlertTesting(false) }
  }

  const handleFullScanTrigger = async () => {
    setScanTriggering(true)
    try {
      const res = await triggerFullScan()
      if (res.status === 'started') {
        addToast('success', '전체 시장 스캔 시작됨')
        setScanStatus(prev => prev ? { ...prev, running: true, progress_pct: 0, elapsed_seconds: 0 } : null)
        setTimeout(async () => { const s = await fetchFullScanStatus(); setScanStatus(s) }, 2000)
      } else if (res.status === 'already_running') {
        addToast('error', '이미 스캔이 진행 중입니다')
      }
    } catch { addToast('error', '스캔 트리거 실패') }
    finally { setScanTriggering(false) }
  }

  const sH = 'calc(100dvh - 64px)'
  usePageSwipe(snapRef)

  const scrollToSection = (idx: number) => {
    const el = snapRef.current
    if (!el) return
    el.scrollTo({ top: idx * el.clientHeight, behavior: 'smooth' })
  }

  // ── 공통 블록 ──────────────────────────────────────────────────

  const inpStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4,
    padding: '8px 12px', fontSize: 13, color: 'var(--fg-0)', outline: 'none',
    fontFamily: 'var(--font-mono)', boxSizing: 'border-box',
  }

  const profileBlock = (
    <div className="panel" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {user ? (
        <>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', margin: 0 }}>
              {user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email}
            </p>
            <p style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{user.email}</p>
          </div>
          <UserMenu />
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--fg-3)' }}>로그인하면 개인화 기능을 사용할 수 있습니다</p>
          <LoginButton />
        </>
      )}
    </div>
  )

  const sensitivityBlock = (
    <div className="panel" style={{ padding: 0 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="label">BUY/SELL 신호 민감도</div>
        <p style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>민감도가 높을수록 신호가 자주 발생합니다</p>
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {SENSITIVITIES.map(s => {
          const selected = currentSens === s.value
          return (
            <button
              key={s.value}
              onClick={() => handleSensChange(s.value)}
              disabled={saving}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 6,
                background: selected ? 'color-mix(in oklch, var(--accent), transparent 88%)' : 'var(--bg-2)',
                border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: selected ? s.dotColor : 'var(--border)', transition: 'background 0.15s', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: selected ? s.dotColor : 'var(--fg-2)' }}>{s.label}</span>
                  {selected && <span className={s.chipCls} style={{ fontSize: 9 }}>선택됨</span>}
                </div>
                <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{s.desc}</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', paddingLeft: 16 }}>
                {s.detail}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  const telegramBlock = (
    <div className="panel" style={{ padding: 0 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageCircle size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <div className="label">텔레그램 알림</div>
        {tgConfigured && <span className="chip chip-up" style={{ fontSize: 9 }}>연동됨</span>}
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: 0 }}>BUY/SELL 신호 전환 시 텔레그램으로 실시간 알림</p>
        {tgMsg && (
          <div style={{ fontSize: 11, padding: '8px 12px', borderRadius: 4, background: tgMsgType === 'ok' ? 'color-mix(in oklch, var(--up), transparent 85%)' : 'color-mix(in oklch, var(--down), transparent 85%)', color: tgMsgType === 'ok' ? 'var(--up)' : 'var(--down)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {tgMsgType === 'ok' && <Check size={12} />} {tgMsg}
          </div>
        )}
        <div>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--fg-3)', marginBottom: 4 }}>Bot Token</label>
          <input type="text" value={tgToken} onChange={e => setTgToken(e.target.value)}
            placeholder={tgTokenHint || '123456:ABC-DEF...'} autoComplete="off" style={inpStyle} />
          <p style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 3 }}>
            {tgConfigured ? '변경 시에만 새 토큰 입력 (현재 설정됨)' : '@BotFather에서 봇 생성 후 발급'}
          </p>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--fg-3)', marginBottom: 4 }}>Chat ID</label>
          <input type="text" value={tgChatId} onChange={e => setTgChatId(e.target.value)}
            placeholder="-1001234567890" autoComplete="off" style={inpStyle} />
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
          <button onClick={handleTgSave} disabled={tgSaving}
            style={{ padding: '6px 16px', background: 'var(--accent)', color: 'var(--bg-0)', fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 4, cursor: tgSaving ? 'not-allowed' : 'pointer', opacity: tgSaving ? 0.6 : 1 }}>
            {tgSaving ? '저장 중...' : '저장'}
          </button>
          <button onClick={handleTgTest} disabled={tgTesting || !tgConfigured}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg-2)', fontSize: 12, borderRadius: 4, cursor: (tgTesting || !tgConfigured) ? 'not-allowed' : 'pointer', opacity: (tgTesting || !tgConfigured) ? 0.5 : 1 }}>
            <Send size={12} />{tgTesting ? '발송 중...' : '테스트 발송'}
          </button>
        </div>
      </div>
    </div>
  )

  const buyAlertBlock = tgConfigured && (
    <div className="panel" style={{ padding: 0 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageCircle size={14} style={{ color: 'var(--up)', flexShrink: 0 }} />
        <div className="label">BUY 신호 정기 알림</div>
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: 0 }}>평일 10:30 / 15:00 국내주식 BUY 신호 자동 발송</p>
        <button onClick={handleBuyAlertTest} disabled={buyAlertTesting}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--up)', color: 'var(--bg-0)', fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 4, cursor: buyAlertTesting ? 'not-allowed' : 'pointer', opacity: buyAlertTesting ? 0.6 : 1, width: 'fit-content' }}>
          <Send size={12} />{buyAlertTesting ? '전송 중...' : 'BUY 신호 알림 테스트'}
        </button>
      </div>
    </div>
  )

  const scanBlock = (
    <div className="panel" style={{ padding: 0 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Database size={14} style={{ color: 'var(--mag)', flexShrink: 0 }} />
        <div className="label">전체 시장 스캔</div>
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: 0 }}>
          국내 ~470 / 미국 ~718 전종목 스캔<br />
          <span style={{ color: 'var(--up)' }}>국내</span>: 평일 9:30~15:30 매시 :30 &nbsp;
          <span style={{ color: 'var(--accent)' }}>미국</span>: 평일 19:50 · 화~토 03:50
        </p>
        {scanStatus?.running && (
          <div style={{ background: 'color-mix(in oklch, var(--mag), transparent 88%)', border: '1px solid color-mix(in oklch, var(--mag), transparent 60%)', borderRadius: 6, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--mag)', marginBottom: 8 }}>
              <Loader2 size={13} className="animate-spin" />
              스캔 진행 중... {scanStatus.scanned_count}/{scanStatus.total_symbols}종목 ({scanStatus.progress_pct}%)
            </div>
            <div style={{ width: '100%', background: 'var(--bg-3)', borderRadius: 3, height: 5 }}>
              <div style={{ width: `${scanStatus.progress_pct}%`, background: 'var(--mag)', height: 5, borderRadius: 3, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>경과: {scanStatus.elapsed_seconds}초</div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={handleFullScanTrigger} disabled={scanTriggering || scanStatus?.running}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: 'var(--mag)', color: 'var(--bg-0)', fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 4, cursor: (scanTriggering || scanStatus?.running) ? 'not-allowed' : 'pointer', opacity: (scanTriggering || scanStatus?.running) ? 0.6 : 1 }}>
            <Play size={12} />{scanTriggering ? '시작 중...' : scanStatus?.running ? '진행 중...' : '수동 스캔 실행'}
          </button>
          {scanStatus?.last_completed_at && (
            <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              완료: {new Date(scanStatus.last_completed_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        {scanHistory.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 6 }}>최근 스캔 이력</div>
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                    <th style={{ textAlign: 'left', padding: '5px 10px', color: 'var(--fg-3)', fontWeight: 600 }}>시간</th>
                    <th style={{ textAlign: 'center', padding: '5px 6px', color: 'var(--fg-3)', fontWeight: 600 }}>상태</th>
                    <th style={{ textAlign: 'right', padding: '5px 6px', color: 'var(--fg-3)', fontWeight: 600 }}>BUY</th>
                    <th style={{ textAlign: 'right', padding: '5px 10px', color: 'var(--fg-3)', fontWeight: 600 }}>소요</th>
                  </tr>
                </thead>
                <tbody>
                  {scanHistory.map((h, i) => (
                    <tr key={h.id} style={{ borderBottom: i < scanHistory.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td className="mono" style={{ padding: '5px 10px', color: 'var(--fg-3)', fontSize: 10.5, whiteSpace: 'nowrap' }}>
                        {h.started_at ? new Date(h.started_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                        <span className={h.status === 'completed' ? 'chip chip-up' : h.status === 'failed' ? 'chip chip-down' : 'chip chip-warn'} style={{ fontSize: 9 }}>
                          {h.status === 'completed' ? '완료' : h.status === 'failed' ? '실패' : '진행중'}
                        </span>
                      </td>
                      <td className="mono" style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--up)' }}>{h.buy_count}</td>
                      <td className="mono" style={{ padding: '5px 10px', textAlign: 'right', color: 'var(--fg-3)', fontSize: 10 }}>
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
          <p style={{ fontSize: 11, color: 'var(--fg-4)', textAlign: 'center', padding: '8px 0' }}>아직 스캔 이력이 없습니다</p>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* ── 모바일: 스냅 3섹션 ── */}
      <div
        ref={snapRef}
        className="md:hidden fixed inset-x-0 top-0"
        style={{ bottom: '64px', overflowY: 'scroll', scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none' } as any}
      >
        {/* 섹션 0: 프로필 + 민감도 */}
        <div className="flex flex-col" style={{ height: sH, scrollSnapAlign: 'start', background: 'var(--bg-0)' }}>
          <SnapHdr title="신호 설정" idx={0} currentSection={currentSection} onDotClick={scrollToSection} />
          <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 space-y-3" style={{ overscrollBehaviorY: 'contain' } as any}>
            {profileBlock}
            {msg && (
              <div style={{ fontSize: 11, padding: '8px 12px', borderRadius: 4, background: 'color-mix(in oklch, var(--up), transparent 85%)', color: 'var(--up)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={12} /> {msg}
              </div>
            )}
            {sensitivityBlock}
          </div>
        </div>

        {/* 섹션 1: 텔레그램 */}
        <div className="flex flex-col" style={{ height: sH, scrollSnapAlign: 'start', background: 'var(--bg-0)' }}>
          <SnapHdr title="텔레그램 알림" idx={1} currentSection={currentSection} onDotClick={scrollToSection} />
          <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 space-y-3" style={{ overscrollBehaviorY: 'contain' } as any}>
            {telegramBlock}
            {buyAlertBlock}
          </div>
        </div>

        {/* 섹션 2: 스캔 모니터링 */}
        <div className="flex flex-col" style={{ height: sH, scrollSnapAlign: 'start', background: 'var(--bg-0)' }}>
          <SnapHdr title="스캔 모니터" idx={2} currentSection={currentSection} onDotClick={scrollToSection} />
          <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 space-y-3" style={{ overscrollBehaviorY: 'contain' } as any}>
            {scanBlock}
          </div>
        </div>
      </div>

      {/* ── PC 레이아웃 ── */}
      <div className="hidden md:block p-6 max-w-xl mx-auto">
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <SettingsIcon size={20} style={{ color: 'var(--accent)' }} /> 설정
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {profileBlock}

          {msg && (
            <div style={{ fontSize: 11, padding: '8px 12px', borderRadius: 4, background: 'color-mix(in oklch, var(--up), transparent 85%)', color: 'var(--up)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={12} /> {msg}
            </div>
          )}

          {sensitivityBlock}
          {telegramBlock}
          {buyAlertBlock}
          {scanBlock}
        </div>
      </div>
    </>
  )
}

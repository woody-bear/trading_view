import { Check, MessageCircle, Send, Settings as SettingsIcon, TrendingUp, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchWatchlist, getKIS, getSensitivity, getTelegram, setKIS, setSensitivity, setTelegram, testBuyAlert, testKIS, testTelegram, updateSymbol } from '../api/client'
import { useToastStore } from '../stores/toastStore'

const TIMEFRAMES = [
  { value: '15m', label: '15분봉', desc: '단타/스캘핑용' },
  { value: '30m', label: '30분봉', desc: '단기 트레이딩' },
  { value: '1h', label: '1시간봉', desc: '단기 스윙' },
  { value: '4h', label: '4시간봉', desc: '중기 스윙' },
  { value: '1d', label: '일봉', desc: '중장기 투자' },
  { value: '1w', label: '주봉', desc: '추세 추종 (기본값)' },
]

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

export default function Settings() {
  const [currentTf, setCurrentTf] = useState(() => localStorage.getItem('timeframe') || '1w')
  const [currentSens, setCurrentSens] = useState('strict')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // 텔레그램
  const [tgToken, setTgToken] = useState('')
  const [tgChatId, setTgChatId] = useState('')
  const [tgConfigured, setTgConfigured] = useState(false)
  const [tgSaving, setTgSaving] = useState(false)
  const [tgMsg, setTgMsg] = useState('')
  const [tgMsgType, setTgMsgType] = useState<'ok' | 'err'>('ok')
  const [tgTesting, setTgTesting] = useState(false)

  // 한투 API
  const [kisAppKey, setKisAppKey] = useState('')
  const [kisAppSecret, setKisAppSecret] = useState('')
  const [kisAccountNo, setKisAccountNo] = useState('')
  const [kisPaper, setKisPaper] = useState(true)
  const [kisConfigured, setKisConfigured] = useState(false)
  const [kisSaving, setKisSaving] = useState(false)
  const [kisMsg, setKisMsg] = useState('')
  const [kisMsgType, setKisMsgType] = useState<'ok' | 'err'>('ok')
  const [kisTesting, setKisTesting] = useState(false)
  const [kisWs, setKisWs] = useState<{ connected: boolean; subscribed: number; max: number } | null>(null)

  useEffect(() => {
    getSensitivity().then(d => setCurrentSens(d.current)).catch(() => {})
    getTelegram().then(d => {
      setTgConfigured(d.configured)
      setTgToken(d.bot_token)
      setTgChatId(d.chat_id)
    }).catch(() => {})
    getKIS().then(d => {
      setKisConfigured(d.configured)
      setKisAppKey(d.app_key)
      setKisAccountNo(d.account_no)
      setKisPaper(d.paper_trading)
      setKisWs(d.websocket)
    }).catch(() => {})
  }, [])

  const handleTfChange = async (tf: string) => {
    setSaving(true); setMsg('')
    try {
      localStorage.setItem('timeframe', tf)
      setCurrentTf(tf)
      const items = await fetchWatchlist()
      await Promise.all(items.map((i: any) => updateSymbol(i.id, { timeframe: tf })))
      setMsg(`봉 단위 → ${TIMEFRAMES.find(t => t.value === tf)?.label}`)
      setTimeout(() => setMsg(''), 3000)
    } catch { setMsg('변경 실패'); setTimeout(() => setMsg(''), 3000) }
    finally { setSaving(false) }
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
    if (!tgToken || !tgChatId) {
      setTgMsg('토큰과 Chat ID를 모두 입력하세요')
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
      // Re-fetch masked token
      const d = await getTelegram()
      setTgToken(d.bot_token)
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

  const handleKisSave = async () => {
    if (!kisAppKey || !kisAppSecret) {
      setKisMsg('APP KEY와 SECRET을 모두 입력하세요')
      setKisMsgType('err')
      setTimeout(() => setKisMsg(''), 3000)
      return
    }
    setKisSaving(true); setKisMsg('')
    try {
      await setKIS({ app_key: kisAppKey, app_secret: kisAppSecret, account_no: kisAccountNo, paper_trading: kisPaper })
      setKisConfigured(true)
      setKisMsg('한투 API 설정 저장 완료')
      setKisMsgType('ok')
      const d = await getKIS()
      setKisAppKey(d.app_key)
      setKisWs(d.websocket)
      setTimeout(() => setKisMsg(''), 3000)
    } catch {
      setKisMsg('저장 실패')
      setKisMsgType('err')
      setTimeout(() => setKisMsg(''), 3000)
    } finally { setKisSaving(false) }
  }

  const handleKisTest = async () => {
    setKisTesting(true); setKisMsg('')
    try {
      const res = await testKIS()
      setKisMsg(res.message)
      setKisMsgType(res.status === 'ok' ? 'ok' : 'err')
      setTimeout(() => setKisMsg(''), 5000)
    } catch {
      setKisMsg('연결 테스트 실패')
      setKisMsgType('err')
      setTimeout(() => setKisMsg(''), 3000)
    } finally { setKisTesting(false) }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
        <SettingsIcon size={22} className="text-blue-400" /> 설정
      </h1>

      {msg && (
        <div className="mb-4 text-xs text-green-400 bg-green-400/10 px-3 py-2 rounded-lg flex items-center gap-2">
          <Check size={14} /> {msg}
        </div>
      )}

      {/* 신호 민감도 */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-1">BUY/SELL 신호 민감도</h2>
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
              <div className="text-[10px] text-[var(--muted)] ml-4 font-mono">{s.detail}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 차트 봉 단위 */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-white font-semibold mb-1">차트 봉 단위</h2>
        <p className="text-xs text-[var(--muted)] mb-4">모든 종목의 차트와 지표 계산에 적용됩니다</p>

        <div className="space-y-2">
          {TIMEFRAMES.map(tf => (
            <button key={tf.value}
              onClick={() => handleTfChange(tf.value)}
              disabled={saving}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition ${
                currentTf === tf.value
                  ? 'bg-blue-600/20 border border-blue-500/50 text-white'
                  : 'bg-[var(--bg)] border border-transparent hover:border-[var(--border)] text-[var(--muted)] hover:text-white'
              } disabled:opacity-50`}>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${currentTf === tf.value ? 'bg-blue-400' : 'bg-[var(--border)]'}`} />
                <span className="text-sm font-semibold">{tf.label}</span>
              </div>
              <span className="text-xs text-[var(--muted)]">{tf.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 텔레그램 알림 */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 mt-6">
        <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
          <MessageCircle size={16} className="text-sky-400" /> 텔레그램 알림
        </h2>
        <p className="text-xs text-[var(--muted)] mb-4">
          BUY/SELL 신호 전환 시 텔레그램으로 실시간 알림을 받습니다
        </p>

        {tgMsg && (
          <div className={`mb-3 text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
            tgMsgType === 'ok' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'
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
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--muted)] focus:border-sky-500 focus:outline-none"
            />
            <p className="text-[10px] text-[var(--muted)] mt-1">@BotFather에서 봇 생성 후 받은 토큰</p>
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
            <p className="text-[10px] text-[var(--muted)] mt-1">@userinfobot으로 확인 가능 (그룹은 - 접두사)</p>
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
            <div className="text-[10px] text-green-400 flex items-center gap-1 mt-1">
              <Check size={12} /> 텔레그램 연동됨
            </div>
          )}
        </div>
      </div>

      {/* BUY 신호 알림 */}
      {tgConfigured && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 mt-6">
          <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
            <MessageCircle size={16} className="text-green-400" /> BUY 신호 정기 알림
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

      {/* 한국투자증권 API */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 mt-6">
        <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
          <TrendingUp size={16} className="text-orange-400" /> 한국투자증권 API
        </h2>
        <p className="text-xs text-[var(--muted)] mb-4">
          한국 주식 실시간 체결가를 초 단위로 수신합니다 (미설정 시 pykrx fallback)
        </p>

        {kisMsg && (
          <div className={`mb-3 text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
            kisMsgType === 'ok' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'
          }`}>
            {kisMsgType === 'ok' ? <Check size={14} /> : null} {kisMsg}
          </div>
        )}

        {kisWs && (
          <div className={`mb-4 text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
            kisWs.connected ? 'text-green-400 bg-green-400/10' : 'text-[var(--muted)] bg-[var(--bg)]'
          }`}>
            {kisWs.connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            WebSocket {kisWs.connected ? '연결됨' : '미연결'} — {kisWs.subscribed}/{kisWs.max} 종목 구독 중
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">APP KEY</label>
            <input
              type="text"
              value={kisAppKey}
              onChange={e => setKisAppKey(e.target.value)}
              placeholder="PSxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--muted)] focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">APP SECRET</label>
            <input
              type="password"
              value={kisAppSecret}
              onChange={e => setKisAppSecret(e.target.value)}
              placeholder="시크릿 키 입력"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--muted)] focus:border-orange-500 focus:outline-none"
            />
            <p className="text-[10px] text-[var(--muted)] mt-1">KIS Developers에서 앱 등록 후 발급</p>
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">계좌번호</label>
            <input
              type="text"
              value={kisAccountNo}
              onChange={e => setKisAccountNo(e.target.value)}
              placeholder="00000000-01"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--muted)] focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-[var(--muted)]">모의투자 모드</label>
            <button
              onClick={() => setKisPaper(!kisPaper)}
              className={`w-10 h-5 rounded-full transition relative ${kisPaper ? 'bg-orange-500' : 'bg-[var(--border)]'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition ${kisPaper ? 'left-5' : 'left-0.5'}`} />
            </button>
            <span className="text-xs text-[var(--muted)]">{kisPaper ? 'ON (모의)' : 'OFF (실전)'}</span>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleKisSave}
              disabled={kisSaving}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-lg transition disabled:opacity-50"
            >
              {kisSaving ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={handleKisTest}
              disabled={kisTesting || !kisConfigured}
              className="px-4 py-2 bg-[var(--bg)] border border-[var(--border)] hover:border-orange-500 text-[var(--muted)] hover:text-white text-sm rounded-lg transition disabled:opacity-50 flex items-center gap-1"
            >
              <Send size={14} />
              {kisTesting ? '테스트 중...' : '연결 테스트'}
            </button>
          </div>
          {kisConfigured && (
            <div className="text-[10px] text-green-400 flex items-center gap-1 mt-1">
              <Check size={12} /> 한투 API 연동됨
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

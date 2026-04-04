import { Loader2, Plus, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addSymbol, fetchLatestPicks, scanMarket } from '../api/client'

import { fmtPrice } from '../utils/format'

const sqColors: Record<number, string> = { 0: '#22c55e', 1: '#eab308', 2: '#f97316', 3: '#ef4444' }
const sqLabels: Record<number, string> = { 0: 'NO SQ', 1: 'LOW SQ', 2: 'MID SQ', 3: 'MAX SQ' }

interface Pick {
  symbol: string; name: string; price: number; change_pct: number;
  rsi: number; bb_pct_b: number; squeeze_level: number;
  macd_hist: number; volume_ratio: number; confidence: number;
  market_type?: string; trend?: string; trend_label?: string;
}

function isAllMarketsClosed(): boolean {
  const now = new Date()
  const krOpen = (() => {
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const d = kst.getDay(), h = kst.getHours(), m = kst.getMinutes()
    if (d === 0 || d === 6) return false
    return h >= 9 && (h < 15 || (h === 15 && m <= 30))
  })()
  const usOpen = (() => {
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const d = et.getDay(), h = et.getHours(), m = et.getMinutes()
    if (d === 0 || d === 6) return false
    return (h > 9 || (h === 9 && m >= 30)) && h < 16
  })()
  return !krOpen && !usOpen
}

export default function TopPicks() {
  const nav = useNavigate()
  const [kospi, setKospi] = useState<Pick[]>([])
  const [kosdaq, setKosdaq] = useState<Pick[]>([])
  const [us, setUs] = useState<Pick[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanDate, setScanDate] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchLatestPicks()
        if (data.scan_date && (data.kospi.length || data.kosdaq.length || data.us.length)) {
          setKospi(data.kospi); setKosdaq(data.kosdaq); setUs(data.us)
          setScanDate(data.scan_date); setLoaded(true)
        } else {
          await runScan()
        }
      } catch { await runScan() }
    })()
  }, [])

  const runScan = async () => {
    setScanning(true)
    try {
      const data = await scanMarket(3)
      setKospi(data.kospi || []); setKosdaq(data.kosdaq || []); setUs(data.us || [])
      setScanDate(new Date().toISOString().slice(0, 10)); setLoaded(true)
    } catch (e) { console.error(e) }
    finally { setScanning(false) }
  }

  const handleClick = (p: Pick) => {
    const market = p.market_type || 'US'
    nav(`/${p.symbol.replace(/\//g, '_')}?market=${market}`)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="text-orange-400" size={24} /> 스퀴즈 추천 종목
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            상승추세 + 스퀴즈 압축 종목 — EMA 20 &gt; 50 &gt; 200 정배열 + 폭발적 움직임 임박
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAllMarketsClosed() && !scanning && (
            <span className="text-xs font-semibold text-slate-300 bg-slate-600/40 border border-slate-500/40 px-2.5 py-1 rounded-full">
              장 종료
            </span>
          )}
          {scanDate && <span className="text-xs text-[var(--muted)]">마지막 스캔: {scanDate}</span>}
          <button onClick={runScan} disabled={scanning}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm disabled:opacity-50 flex items-center gap-2">
            {scanning ? <><Loader2 size={14} className="animate-spin" /> 스캔 중...</> : '전체 시장 스캔'}
          </button>
        </div>
      </div>

      {scanning && (
        <div className="text-center py-20">
          <Loader2 size={32} className="animate-spin text-orange-400 mx-auto mb-3" />
          <p className="text-[var(--muted)]">코스피 · 코스닥 · 미국 전체 종목 스캔 중...</p>
          <p className="text-xs text-[var(--muted)] mt-1">약 1~3분 소요됩니다</p>
        </div>
      )}

      {loaded && !scanning && (
        <div className="space-y-8">
          <PickSection title="코스피 Top 3" picks={kospi} onClick={handleClick} />
          <PickSection title="코스닥 Top 3" picks={kosdaq} onClick={handleClick} />
          <PickSection title="미국 Top 3" picks={us} onClick={handleClick} />
        </div>
      )}

      {loaded && !scanning && !kospi.length && !kosdaq.length && !us.length && (
        <div className="text-center py-20 text-[var(--muted)]">
          <p className="text-lg">스퀴즈 단계 종목이 없습니다</p>
          <p className="text-sm mt-1">시장 변동성이 낮은 시기에는 스퀴즈 종목이 적을 수 있습니다</p>
        </div>
      )}
    </div>
  )
}

function PickSection({ title, picks, onClick }: { title: string; picks: Pick[]; onClick: (p: Pick) => void }) {
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  if (!picks.length) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-[var(--muted)] mb-3">{title}</h2>
        <p className="text-sm text-[var(--muted)] opacity-60">해당 시장에 스퀴즈 종목 없음</p>
      </div>
    )
  }

  const handleAdd = async (p: Pick, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const m = (p.market_type === 'KOSPI' || p.market_type === 'KOSDAQ') ? 'KR' : 'US'
      await addSymbol({ market: m, symbol: p.symbol, timeframe: '1d' })
      setAddedIds(prev => new Set(prev).add(p.symbol))
    } catch {}
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--muted)] mb-3">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {picks.map((p, i) => (
          <div key={p.symbol} onClick={() => onClick(p)}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 cursor-pointer hover:border-orange-500/50 transition">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-[var(--border)] text-white w-5 h-5 rounded flex items-center justify-center font-mono">#{i + 1}</span>
                <div>
                  <span className="text-white font-semibold">{p.name}</span>
                  <span className="text-[var(--muted)] text-xs ml-2">{p.symbol}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {p.trend === 'BULL' && (
                  <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">상승추세</span>
                )}
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ background: sqColors[p.squeeze_level] }} />
                  <span className="text-xs font-bold" style={{ color: sqColors[p.squeeze_level] }}>{sqLabels[p.squeeze_level]}</span>
                </div>
                {!addedIds.has(p.symbol) ? (
                  <button onClick={(e) => handleAdd(p, e)} title="워치리스트에 추가"
                    className="p-1 text-blue-400 hover:text-white hover:bg-blue-600 rounded transition">
                    <Plus size={14} />
                  </button>
                ) : (
                  <span className="text-[10px] text-green-400">추가됨</span>
                )}
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-white text-lg font-mono">{fmtPrice(p.price, p.market_type)}</span>
              <span className={`text-sm font-mono ${p.change_pct >= 0 ? 'text-[var(--buy)]' : 'text-[var(--sell)]'}`}>
                {p.change_pct >= 0 ? '+' : ''}{p.change_pct}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="text-[var(--muted)]">RSI</span>
                <div className={`font-mono ${p.rsi < 30 ? 'text-[var(--buy)]' : p.rsi > 70 ? 'text-[var(--sell)]' : 'text-[var(--text)]'}`}>{p.rsi}</div></div>
              <div><span className="text-[var(--muted)]">%B</span><div className="font-mono text-[var(--text)]">{p.bb_pct_b}%</div></div>
              <div><span className="text-[var(--muted)]">거래량</span><div className="font-mono text-[var(--text)]">{p.volume_ratio}x</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { Search, TrendingUp, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMarketCapDistribution, fetchScanSymbols, type MarketCapDistributionResponse } from '../api/client'
import MarketCapDistributionBar from '../components/MarketCapDistributionBar'

interface StockSymbol {
  symbol: string
  name: string
  market: string
  market_type: string
  is_etf: boolean
  indices?: string[]
}

interface Breakdown {
  kospi: number
  kospi_etf: number
  kosdaq: number
  nasdaq100: number
  sp500: number
  djia30: number
  us_etf: number
}

const INDEX_BADGE: Record<string, { label: string; cls: string }> = {
  SP500:    { label: 'S&P500', cls: 'bg-emerald-500/20 text-emerald-300' },
  NASDAQ100:{ label: 'NQ100',  cls: 'bg-blue-500/20 text-blue-300' },
  DJIA30:   { label: 'DJIA',   cls: 'bg-orange-500/20 text-orange-300' },
}

function SymbolTable({ title, items, onRowClick }: {
  title: string; items: StockSymbol[]; onRowClick: (s: StockSymbol) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2 px-1">
        <h3 className="text-sm font-semibold text-[var(--muted)]">{title}</h3>
        <span className="text-xs text-[var(--muted)] bg-[var(--border)] px-1.5 py-0.5 rounded">{items.length.toLocaleString()}개</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--navy)]">
              <th className="text-left px-3 py-2 text-caption text-[var(--muted)] w-10">#</th>
              <th className="text-left px-3 py-2 text-caption text-[var(--muted)] w-24">코드</th>
              <th className="text-left px-3 py-2 text-caption text-[var(--muted)]">종목명</th>
              <th className="text-left px-3 py-2 text-caption text-[var(--muted)]">지수</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={item.symbol}
                onClick={() => onRowClick(item)}
                className="border-b border-[var(--border)]/50 hover:bg-white/5 cursor-pointer transition-colors active:bg-white/10"
              >
                <td className="px-3 py-2 text-caption text-[var(--muted)] font-mono">{i + 1}</td>
                <td className="px-3 py-2 text-caption text-[var(--gold)] font-mono">{item.symbol}</td>
                <td className="px-3 py-2 text-label text-white">{item.name}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {item.is_etf && (
                      <span className="text-micro px-1 py-0.5 rounded bg-purple-500/20 text-purple-400">ETF</span>
                    )}
                    {item.indices && item.indices.map(idx => {
                      const b = INDEX_BADGE[idx]
                      return b ? (
                        <span key={idx} className={`text-micro px-1 py-0.5 rounded ${b.cls}`}>{b.label}</span>
                      ) : null
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function BuyList() {
  const nav = useNavigate()
  const [symbols, setSymbols] = useState<StockSymbol[]>([])
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)
  const [activeTab, setActiveTab] = useState<'KR' | 'US'>('KR')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'kospi' | 'kospiEtf' | 'kosdaq' | 'nasdaq100' | 'sp500' | 'djia30' | 'usEtf' | null>(null)
  const [capDist, setCapDist] = useState<MarketCapDistributionResponse | null>(null)
  const [capDistLoading, setCapDistLoading] = useState(true)

  const selectCategory = (cat: typeof selectedCategory) => {
    setSelectedCategory(prev => prev === cat ? null : cat)
    setSearchQuery('')
    if (cat === 'kospi' || cat === 'kospiEtf' || cat === 'kosdaq') setActiveTab('KR')
    else if (cat !== null) setActiveTab('US')
  }

  useEffect(() => {
    fetchScanSymbols()
      .then(symData => {
        setSymbols(symData.symbols || [])
        setBreakdown(symData.breakdown || null)
      })
      .catch(e => console.error('fetchScanSymbols error:', e))
  }, [])

  useEffect(() => {
    fetchMarketCapDistribution()
      .then(r => setCapDist(r))
      .catch(e => console.error('fetchMarketCapDistribution error:', e))
      .finally(() => setCapDistLoading(false))
  }, [])

  const filteredSymbols = useMemo(() => {
    if (!searchQuery.trim()) return symbols
    const q = searchQuery.trim().toUpperCase()
    return symbols.filter(s =>
      s.name.toUpperCase().includes(q) ||
      s.symbol.toUpperCase().includes(q)
    )
  }, [symbols, searchQuery])

  const byCategory = useMemo(() => ({
    kospi:       filteredSymbols.filter(s => s.market_type === 'KOSPI' && !s.is_etf),
    kospiEtf:    filteredSymbols.filter(s => s.market_type === 'KOSPI' && s.is_etf),
    kosdaq:      filteredSymbols.filter(s => s.market_type === 'KOSDAQ'),
    nasdaq100:   filteredSymbols.filter(s => s.market_type === 'NASDAQ100'),
    sp500:       filteredSymbols.filter(s => s.market_type === 'SP500'),
    djia30:      filteredSymbols.filter(s => s.indices?.includes('DJIA30')),
    usEtf:       filteredSymbols.filter(s => s.market_type === 'ETF' || s.market_type === 'NYSE'),
  }), [filteredSymbols])

  const hasSearchResult = filteredSymbols.length > 0
  const krTotal = (breakdown?.kospi ?? 0) + (breakdown?.kospi_etf ?? 0) + (breakdown?.kosdaq ?? 0)
  const usTotal = (breakdown?.nasdaq100 ?? 0) + (breakdown?.sp500 ?? 0) + (breakdown?.us_etf ?? 0)
  const total = breakdown ? krTotal + usTotal : 0

  const handleRowClick = (item: StockSymbol) => {
    nav(`/${item.symbol}?market=${item.market_type || item.market}`)
  }

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">
      {/* 페이지 제목 */}
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={20} className="text-cyan-400" />
        <h1 className="text-lg font-bold text-white">조회종목 리스트</h1>
      </div>

      {/* 시가총액 분포 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
        <MarketCapDistributionBar
          title="🇰🇷 국내 시총 분포"
          titleColor="text-blue-400"
          data={capDist?.kr}
          loading={capDistLoading}
        />
        <MarketCapDistributionBar
          title="🇺🇸 미국 시총 분포"
          titleColor="text-emerald-400"
          data={capDist?.us}
          loading={capDistLoading}
        />
      </div>

      {/* 총 종목수 요약 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
          <div className="text-2xl md:text-xl font-bold text-white font-mono">{total.toLocaleString()}</div>
          <div className="text-caption text-[var(--muted)]">총 스캔 종목</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
          <div className="text-2xl md:text-xl font-bold text-blue-400 font-mono">{krTotal.toLocaleString()}</div>
          <div className="text-caption text-[var(--muted)]">국내 (9:30~15:30)</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
          <div className="text-2xl md:text-xl font-bold text-emerald-400 font-mono">{usTotal.toLocaleString()}</div>
          <div className="text-caption text-[var(--muted)]">미국 (19:50/03:50)</div>
        </div>
      </div>

      {/* 스캔 범위 배지 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2">
          <div className="text-caption font-semibold text-blue-400 mb-1.5">🇰🇷 국내 스캔 대상</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: '코스피200', count: breakdown?.kospi ?? 0, color: 'bg-blue-500/20 text-blue-300', activeColor: 'ring-1 ring-blue-400', cat: 'kospi' as const },
              { label: '코스닥150', count: breakdown?.kosdaq ?? 0, color: 'bg-cyan-500/20 text-cyan-300', activeColor: 'ring-1 ring-cyan-400', cat: 'kosdaq' as const },
              { label: '국내 ETF', count: breakdown?.kospi_etf ?? 0, color: 'bg-violet-500/20 text-violet-300', activeColor: 'ring-1 ring-violet-400', cat: 'kospiEtf' as const },
            ].map(b => (
              <button
                key={b.label}
                onClick={() => selectCategory(b.cat)}
                className={`text-caption px-2 py-0.5 rounded-full font-mono transition-all cursor-pointer hover:brightness-125 ${b.color} ${selectedCategory === b.cat ? b.activeColor : ''}`}
              >
                {b.label} {b.count > 0 ? `${b.count}` : ''}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
          <div className="text-caption font-semibold text-emerald-400 mb-1.5">🇺🇸 미국+암호화폐 스캔 대상</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'S&P 500', count: breakdown?.sp500 ?? 0, color: 'bg-emerald-500/20 text-emerald-300', activeColor: 'ring-1 ring-emerald-400', cat: 'sp500' as const },
              { label: '나스닥100', count: breakdown?.nasdaq100 ?? 0, color: 'bg-green-500/20 text-green-300', activeColor: 'ring-1 ring-green-400', cat: 'nasdaq100' as const },
              { label: '다우존스30', count: breakdown?.djia30 ?? 0, color: 'bg-orange-500/20 text-orange-300', activeColor: 'ring-1 ring-orange-400', cat: 'djia30' as const },
              { label: '미국 ETF', count: breakdown?.us_etf ?? 0, color: 'bg-yellow-500/20 text-yellow-300', activeColor: 'ring-1 ring-yellow-400', cat: 'usEtf' as const },
            ].map(b => (
              <button
                key={b.label}
                onClick={() => selectCategory(b.cat)}
                className={`text-caption px-2 py-0.5 rounded-full font-mono transition-all cursor-pointer hover:brightness-125 ${b.color} ${selectedCategory === b.cat ? b.activeColor : ''}`}
              >
                {b.label} {b.count > 0 ? `${b.count}` : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 검색창 */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="종목명 또는 코드 검색... (예: 삼성전자, AAPL)"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-form-type="other"
          name="buy-symbol-search"
          className="w-full pl-9 pr-8 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* 국내/미국 탭 */}
      {!searchQuery && !selectedCategory && (
        <div className="flex border-b border-[var(--border)] mb-4">
          {(['KR', 'US'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[var(--gold)] text-[var(--gold)]'
                  : 'border-transparent text-[var(--muted)] hover:text-white'
              }`}
            >
              {tab === 'KR' ? `국내 (${krTotal.toLocaleString()})` : `미국 (${usTotal.toLocaleString()})`}
            </button>
          ))}
        </div>
      )}
      {selectedCategory && !searchQuery && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-[var(--muted)]">필터:</span>
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/15 text-white px-2.5 py-1 rounded-full transition-colors"
          >
            {{
              kospi: '코스피200', kospiEtf: '국내 ETF', kosdaq: '코스닥150',
              nasdaq100: '나스닥100', sp500: 'S&P 500', djia30: '다우존스30', usEtf: '미국 ETF',
            }[selectedCategory]}
            <X size={11} />
          </button>
        </div>
      )}

      {/* 종목 테이블 */}
      {searchQuery ? (
        hasSearchResult ? (
          <>
            {byCategory.kospi.length > 0 && <SymbolTable title="코스피" items={byCategory.kospi} onRowClick={handleRowClick} />}
            {byCategory.kospiEtf.length > 0 && <SymbolTable title="코스피 ETF" items={byCategory.kospiEtf} onRowClick={handleRowClick} />}
            {byCategory.kosdaq.length > 0 && <SymbolTable title="코스닥" items={byCategory.kosdaq} onRowClick={handleRowClick} />}
            {byCategory.nasdaq100.length > 0 && <SymbolTable title="NASDAQ 100" items={byCategory.nasdaq100} onRowClick={handleRowClick} />}
            {byCategory.sp500.length > 0 && <SymbolTable title="S&P 500" items={byCategory.sp500} onRowClick={handleRowClick} />}
            {byCategory.djia30.length > 0 && <SymbolTable title="다우존스30" items={byCategory.djia30} onRowClick={handleRowClick} />}
            {byCategory.usEtf.length > 0 && <SymbolTable title="미국 ETF" items={byCategory.usEtf} onRowClick={handleRowClick} />}
          </>
        ) : (
          <div className="text-center py-12 text-[var(--muted)]">
            <p className="text-sm">"{searchQuery}"에 해당하는 종목이 없습니다</p>
          </div>
        )
      ) : selectedCategory ? (
        <SymbolTable
          title={{ kospi: '코스피200', kospiEtf: '국내 ETF', kosdaq: '코스닥150', nasdaq100: 'NASDAQ 100 (QQQ)', sp500: 'S&P 500', djia30: '다우존스30', usEtf: '미국 ETF' }[selectedCategory]}
          items={byCategory[selectedCategory]}
          onRowClick={handleRowClick}
        />
      ) : activeTab === 'KR' ? (
        <>
          <SymbolTable title="코스피" items={byCategory.kospi} onRowClick={handleRowClick} />
          <SymbolTable title="코스닥" items={byCategory.kosdaq} onRowClick={handleRowClick} />
          <SymbolTable title="코스피 ETF" items={byCategory.kospiEtf} onRowClick={handleRowClick} />
        </>
      ) : (
        <>
          <SymbolTable title="NASDAQ 100 (QQQ)" items={byCategory.nasdaq100} onRowClick={handleRowClick} />
          <SymbolTable title="S&P 500" items={byCategory.sp500} onRowClick={handleRowClick} />
          <SymbolTable title="미국 ETF" items={byCategory.usEtf} onRowClick={handleRowClick} />
        </>
      )}
    </div>
  )
}

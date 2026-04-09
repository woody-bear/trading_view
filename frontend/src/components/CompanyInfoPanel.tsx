import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { fetchCompanyInfo } from '../api/client'

const LABEL_KO: Record<string, string> = {
  // Sectors
  'Technology': '기술',
  'Industrials': '산업재',
  'Consumer Cyclical': '경기소비재',
  'Consumer Defensive': '필수소비재',
  'Healthcare': '헬스케어',
  'Financial Services': '금융',
  'Basic Materials': '기초소재',
  'Energy': '에너지',
  'Utilities': '유틸리티',
  'Real Estate': '부동산',
  'Communication Services': '커뮤니케이션',
  // Industries
  'Electrical Equipment & Parts': '전기장비·부품',
  'Solar': '태양광',
  'Semiconductors': '반도체',
  'Consumer Electronics': '가전',
  'Software—Application': '소프트웨어·응용',
  'Software—Infrastructure': '소프트웨어·인프라',
  'Internet Retail': '인터넷 소매',
  'Internet Content & Information': '인터넷 정보·콘텐츠',
  'Specialty Chemicals': '특수화학',
  'Specialty Retail': '전문소매',
  'Auto Manufacturers': '자동차 제조',
  'Auto Parts': '자동차 부품',
  'Banks—Regional': '지방은행',
  'Banks—Diversified': '종합은행',
  'Insurance—Diversified': '종합보험',
  'Drug Manufacturers—General': '제약',
  'Biotechnology': '바이오',
  'Medical Devices': '의료기기',
  'Aerospace & Defense': '항공우주·방위',
  'Steel': '철강',
  'Chemicals': '화학',
  'Oil & Gas E&P': '석유·가스 탐사',
  'Oil & Gas Integrated': '종합 석유·가스',
  'Agricultural Inputs': '농업 투입재',
  'Electronic Components': '전자부품',
  'Capital Markets': '자본시장',
  'Asset Management': '자산운용',
  'REIT—Industrial': '산업용 리츠',
  'REIT—Retail': '소매 리츠',
  'Telecom Services': '통신 서비스',
  'Wireless Telecom Services': '무선통신',
  'Staffing & Employment Services': '인재파견·고용',
  'Restaurants': '외식',
  'Packaged Foods': '가공식품',
  'Beverages—Non-Alcoholic': '비주류 음료',
  'Beverages—Alcoholic': '주류',
  'Household & Personal Products': '생활·개인용품',
  'Apparel Manufacturing': '의류 제조',
  'Luxury Goods': '명품',
  'Entertainment': '엔터테인먼트',
  'Publishing': '출판',
  'Electronic Gaming & Multimedia': '전자게임·멀티미디어',
  'Shipping & Ports': '해운·항만',
  'Airlines': '항공',
  'Railroads': '철도',
  'Trucking': '육상운송',
  'Waste Management': '폐기물 관리',
  'Engineering & Construction': '엔지니어링·건설',
  'Building Products & Equipment': '건축자재·설비',
  'Real Estate—Development': '부동산 개발',
  'Real Estate Services': '부동산 서비스',
  'Information Technology Services': 'IT 서비스',
  'Computer Hardware': '컴퓨터 하드웨어',
  'Data Storage': '데이터 저장장치',
  'Communication Equipment': '통신장비',
  'Scientific & Technical Instruments': '과학·기술 장비',
  'Semiconductor Equipment & Materials': '반도체 장비·소재',
  'Medical Care Facilities': '의료시설',
  'Health Information Services': '의료정보 서비스',
  'Diagnostics & Research': '진단·연구',
  'Medical Distribution': '의약품 유통',
  'Pharmaceutical Retailers': '약국',
  'Insurance—Life': '생명보험',
  'Insurance—Property & Casualty': '손해보험',
  'Credit Services': '신용 서비스',
  'Mortgage Finance': '모기지 금융',
  'Financial Data & Stock Exchanges': '금융 데이터·거래소',
  'Shell Companies': '페이퍼컴퍼니',
  'Conglomerates': '복합기업',
  'Farm & Heavy Construction Machinery': '건설·농업기계',
  'Industrial Distribution': '산업재 유통',
  'Coking Coal': '코킹석탄',
  'Thermal Coal': '석탄(발전용)',
  'Aluminum': '알루미늄',
  'Copper': '구리',
  'Gold': '금',
  'Silver': '은',
  'Other Industrial Metals & Mining': '기타 금속·광업',
  'Uranium': '우라늄',
  'Independent Power Producers': '독립발전사업자',
  'Utilities—Regulated Electric': '규제 전기 유틸리티',
  'Utilities—Regulated Gas': '규제 가스 유틸리티',
  'Utilities—Diversified': '종합 유틸리티',
  'Residential Construction': '주택건설',
  'South Korea': '대한민국',
  'United States': '미국',
  'China': '중국',
  'Japan': '일본',
  'Germany': '독일',
  'United Kingdom': '영국',
  'France': '프랑스',
  'Taiwan': '대만',
}

function koLabel(text: string | null | undefined): string | null {
  if (!text) return null
  return LABEL_KO[text] ?? text
}

interface Props {
  symbol: string
  market: string
}

function AvatarFallback({ name }: { name: string }) {
  const colors = [
    'bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-orange-600',
    'bg-pink-600', 'bg-teal-600', 'bg-indigo-600', 'bg-red-600',
  ]
  const color = colors[(name.charCodeAt(0) || 0) % colors.length]
  const letter = name.charAt(0).toUpperCase()
  return (
    <div className={`${color} rounded-full w-10 h-10 flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
      {letter}
    </div>
  )
}

export default function CompanyInfoPanel({ symbol, market }: Props) {
  const [expanded, setExpanded] = useState(false)      // 모바일 아코디언
  const [logoError, setLogoError] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)

  const isCrypto = (market ?? '') === 'CRYPTO'
  const isUS = (market ?? '') === 'US'
  const effectiveMarket = market || 'US'

  const { data, isLoading, isError } = useQuery({
    queryKey: ['company-info', symbol, effectiveMarket],
    queryFn: () => fetchCompanyInfo(symbol, effectiveMarket),
    enabled: !isCrypto && !!symbol,
    staleTime: 3600000,
    retry: 1,
  })

  if (isCrypto) return null
  if (isLoading) return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 md:p-3 mb-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[var(--border)]" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-[var(--border)] rounded w-1/3" />
          <div className="h-2 bg-[var(--border)] rounded w-1/4" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="h-2 bg-[var(--border)] rounded w-full" />
        <div className="h-2 bg-[var(--border)] rounded w-5/6" />
        <div className="h-2 bg-[var(--border)] rounded w-4/6" />
      </div>
    </div>
  )
  if (isError || !data?.company) return null

  const c = data.company

  const content = (
    <div>
      {/* 헤더: 로고 + 회사명 + 업종 */}
      <div className="flex items-center gap-3 mb-3">
        {c.logo_url && !logoError ? (
          <img
            src={c.logo_url}
            alt={c.name}
            className="w-10 h-10 rounded-full object-contain bg-white flex-shrink-0"
            onError={() => setLogoError(true)}
          />
        ) : (
          <AvatarFallback name={c.name} />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">{c.name}</div>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {c.industry && (
              <span className="text-[10px] text-[var(--muted)] bg-[var(--bg)] px-2 py-0.5 rounded">
                {koLabel(c.industry)}
              </span>
            )}
            {c.sector && c.sector !== c.industry && (
              <span className="text-[10px] text-[var(--muted)] bg-[var(--bg)] px-2 py-0.5 rounded">
                {koLabel(c.sector)}
              </span>
            )}
          </div>
        </div>
        {c.country && (
          <span className="text-[10px] text-[var(--muted)] flex-shrink-0">{koLabel(c.country)}</span>
        )}
      </div>

      {/* 사업 개요 */}
      {c.description && (
        <div className="mb-3">
          <p className={`text-[11px] text-white font-bold leading-relaxed ${descExpanded ? 'line-clamp-none' : 'line-clamp-4'}`}>
            {c.description}
          </p>
          {c.description.length > 200 && (
            <button
              onClick={() => setDescExpanded(v => !v)}
              className="text-[10px] text-blue-400 mt-1 hover:text-blue-300"
            >
              {descExpanded ? '접기' : '더 보기'}
            </button>
          )}
        </div>
      )}

      {/* 직원 수 + 웹사이트 (US only) */}
      {isUS && (c.employees || c.website) && (
        <div className="flex items-center gap-4 text-[10px] text-[var(--muted)] border-t border-[var(--border)] pt-2">
          {c.employees && (
            <span>직원 {c.employees.toLocaleString('ko-KR')}명</span>
          )}
          {c.website && (
            <a
              href={c.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 truncate"
            >
              {c.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* 모바일: 아코디언 */}
      <div className="md:hidden bg-[var(--card)] border border-[var(--border)] rounded-xl mb-4 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-white"
          onClick={() => setExpanded(v => !v)}
        >
          <span>회사 정보</span>
          {expanded ? <ChevronUp size={16} className="text-[var(--muted)]" /> : <ChevronDown size={16} className="text-[var(--muted)]" />}
        </button>
        {expanded && <div className="px-4 pb-4">{content}</div>}
      </div>

      {/* PC: 항상 표시 */}
      <div className="hidden md:block bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 mb-4">
        {content}
      </div>
    </>
  )
}

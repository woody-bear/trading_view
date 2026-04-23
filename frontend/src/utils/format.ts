/**
 * 가격 포맷팅 — 한국 종목은 정수, 미국/암호화폐는 소수점 2자리.
 */
export const fmtPrice = (price: number, market?: string) => {
  if (market === 'KR' || market === 'KOSPI' || market === 'KOSDAQ')
    return price?.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return price?.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export const FRESH_SIGNAL_DAYS = 7
// 영업일 20일 ≈ 캘린더 28일 — 이 초과분은 표시하지 않음
const MAX_SIGNAL_CALENDAR_DAYS = 28

export function fmtSignalAge(dateStr: string | undefined | null): { label: string; fresh: boolean } | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // new Date('YYYY-MM-DD') parses as UTC midnight; .setHours(0,0,0,0) would shift it to local midnight.
  // Parse explicitly as local date to avoid KST/UTC offset bug.
  const [y, m, d] = dateStr.split('-').map(Number)
  const signal = new Date(y, m - 1, d)  // local midnight, no timezone shift
  const days = Math.floor((today.getTime() - signal.getTime()) / 86_400_000)
  if (days < 0 || days > MAX_SIGNAL_CALENDAR_DAYS) return null
  return { label: days === 0 ? '오늘' : `${days}일 전`, fresh: days <= FRESH_SIGNAL_DAYS }
}

/* SQZ Terminal — 디자인 파일 호환 fmt 헬퍼.
   신규 컴포넌트(Spark/MiniCandles/FGGauge 이후)에서 사용. */
export const fmt = {
  num: (n: number, d = 0) =>
    n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }),
  pct: (n: number, d = 2) => (n >= 0 ? '+' : '') + n.toFixed(d) + '%',
  money: (n: number) => n.toLocaleString('en-US'),
  price: (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 }),
}

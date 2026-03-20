/**
 * 가격 포맷팅 — 한국 종목은 정수, 미국/암호화폐는 소수점 2자리.
 */
export const fmtPrice = (price: number, market?: string) => {
  if (market === 'KR' || market === 'KOSPI' || market === 'KOSDAQ')
    return price?.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return price?.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

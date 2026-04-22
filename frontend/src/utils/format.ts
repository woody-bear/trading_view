/**
 * 가격 포맷팅 — 한국 종목은 정수, 미국/암호화폐는 소수점 2자리.
 */
export const fmtPrice = (price: number, market?: string) => {
  if (market === 'KR' || market === 'KOSPI' || market === 'KOSDAQ')
    return price?.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return price?.toLocaleString(undefined, { maximumFractionDigits: 2 })
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

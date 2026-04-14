import type { AssetClass } from '../../api/client'

interface Props {
  assetClass: AssetClass
}

const LABEL: Record<AssetClass, string> = {
  STOCK_KR: '국내 개별주식',
  STOCK_US: '미국 개별주식',
  ETF: 'ETF (상장지수펀드)',
  CRYPTO: '암호화폐',
  INDEX: '지수',
  FX: '외환',
}

export default function UnsupportedNotice({ assetClass }: Props) {
  return (
    <div className="p-6 flex flex-col items-center justify-center text-center gap-3">
      <div className="text-4xl">📊</div>
      <div className="text-sm font-semibold text-white">
        이 자산군({LABEL[assetClass] ?? assetClass})은 가치 분석 대상이 아닙니다
      </div>
      <div className="text-xs text-[var(--muted)] max-w-sm">
        가치 분석은 <strong className="text-white">KR·US 개별 상장 주식</strong>에서만 제공됩니다.
        <br />ETF·암호화폐·지수·외환은 재무 지표 특성상 지원하지 않습니다.
      </div>
    </div>
  )
}

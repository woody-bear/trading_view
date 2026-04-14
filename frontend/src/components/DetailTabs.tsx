import { useToastStore } from '../stores/toastStore'

export type DetailTabKey = 'chart' | 'value'

interface Props {
  activeTab: DetailTabKey
  onChange: (tab: DetailTabKey) => void
  /** value 탭 활성화 여부 — STOCK_KR/STOCK_US에서만 true. undefined면 활성(MVP). */
  valueEnabled?: boolean
}

const UNSUPPORTED_MSG = 'ETF·암호화폐·지수·외환은 가치 분석 미지원입니다'

export default function DetailTabs({ activeTab, onChange, valueEnabled = true }: Props) {
  const { addToast } = useToastStore()

  const handleValueClick = () => {
    if (!valueEnabled) {
      addToast('info', UNSUPPORTED_MSG)
      return
    }
    onChange('value')
  }

  return (
    <div
      className="sticky top-0 z-20 bg-[var(--bg)] border-b border-[var(--border)] flex gap-0"
      role="tablist"
      aria-label="종목 상세 분석 탭"
    >
      <button
        role="tab"
        aria-selected={activeTab === 'chart'}
        onClick={() => onChange('chart')}
        className={`flex-1 md:flex-none md:px-8 py-3 text-sm font-medium transition-colors ${
          activeTab === 'chart'
            ? 'text-white border-b-2 border-blue-500'
            : 'text-[var(--muted)] hover:text-white border-b-2 border-transparent'
        }`}
      >
        차트 분석
      </button>
      <button
        role="tab"
        aria-selected={activeTab === 'value'}
        aria-disabled={!valueEnabled}
        onClick={handleValueClick}
        title={!valueEnabled ? UNSUPPORTED_MSG : undefined}
        className={`flex-1 md:flex-none md:px-8 py-3 text-sm font-medium transition-colors ${
          !valueEnabled
            ? 'text-[var(--muted)] opacity-40 cursor-not-allowed border-b-2 border-transparent'
            : activeTab === 'value'
            ? 'text-white border-b-2 border-blue-500'
            : 'text-[var(--muted)] hover:text-white border-b-2 border-transparent'
        }`}
      >
        가치 분석
      </button>
    </div>
  )
}

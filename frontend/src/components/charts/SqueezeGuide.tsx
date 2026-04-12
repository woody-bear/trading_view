import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

const stages = [
  { label: 'NO SQ', color: '#22c55e', title: '돌파 임박' },
  { label: 'LOW SQ', color: '#eab308', title: '경계 수위' },
  { label: 'MID SQ', color: '#f97316', title: '에너지 축적' },
  { label: 'MAX SQ', color: '#ef4444', title: '폭발 직전' },
]

export default function SqueezeGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3.5 md:px-3 py-2.5 md:py-2 text-left"
      >
        <div className="flex items-center gap-2.5 md:gap-2">
          <span className="text-label md:text-caption text-[var(--muted)] font-semibold">스퀴즈 4단계</span>
          <div className="flex items-center gap-1.5 md:gap-1">
            {stages.map((s) => (
              <div key={s.label} className="w-2.5 h-2.5 md:w-2 md:h-2 rounded-full" style={{ background: s.color }} />
            ))}
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-[var(--muted)] md:w-3.5 md:h-3.5" /> : <ChevronDown size={18} className="text-[var(--muted)] md:w-3.5 md:h-3.5" />}
      </button>
      {open && (
        <div className="px-3.5 md:px-3 pb-3 md:pb-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-1">
            {stages.map((s) => (
              <div key={s.label} className="flex items-center gap-2 md:gap-1.5">
                <div className="w-3 h-3 md:w-2.5 md:h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <div>
                  <div className="text-label md:text-caption font-bold text-white">{s.label}</div>
                  <div className="text-caption md:text-micro text-[var(--muted)]">{s.title}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-caption md:text-micro text-[var(--muted)] mt-2 md:mt-1.5 opacity-60">
            MAX 스퀴즈 해제 시 강한 방향성 움직임 발생
          </div>
          <div className="grid grid-cols-3 gap-3 md:gap-2 mt-3 md:mt-2 pt-3 md:pt-2 border-t border-[var(--border)]">
            <div>
              <div className="text-label md:text-caption font-bold text-white">RSI</div>
              <div className="text-caption md:text-micro text-[var(--muted)] leading-relaxed">과매수/과매도 강도. 30 이하 매수, 70 이상 매도</div>
            </div>
            <div>
              <div className="text-label md:text-caption font-bold text-white">%B</div>
              <div className="text-caption md:text-micro text-[var(--muted)] leading-relaxed">볼린저 밴드 위치. 0% 하단, 100% 상단 돌파</div>
            </div>
            <div>
              <div className="text-label md:text-caption font-bold text-white">Vol</div>
              <div className="text-caption md:text-micro text-[var(--muted)] leading-relaxed">평균 대비 거래량. 1.2x 이상 거래 활발</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

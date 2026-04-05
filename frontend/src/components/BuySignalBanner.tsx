import { generateBuyReason } from '../utils/buyReason'
import type { BuySignalItem } from '../utils/buyReason'

interface BuySignalBannerProps {
  item: BuySignalItem
}

export default function BuySignalBanner({ item }: BuySignalBannerProps) {
  const parts = generateBuyReason(item)

  return (
    <div className="bg-[var(--buy)]/10 border border-[var(--buy)]/30 rounded-xl p-3 mb-3 flex items-start gap-2">
      <span className="text-base shrink-0 mt-0.5">🟢</span>
      <p className="text-sm leading-snug text-[var(--text)]">
        {parts.map((part, i) =>
          part.highlight ? (
            <span key={i} className="text-[var(--buy)] font-bold">{part.text}</span>
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </p>
    </div>
  )
}

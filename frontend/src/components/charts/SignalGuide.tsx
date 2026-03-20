export default function SignalGuide() {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-4">
      <h3 className="text-xs font-semibold text-[var(--muted)] mb-3">매수/매도 신호 구분</h3>
      <div className="grid grid-cols-2 gap-4">
        {/* BUY / SELL */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-sm font-bold">▲ BUY</span>
            <span className="text-red-400 text-sm font-bold">▼ SELL</span>
          </div>
          <p className="text-[11px] text-[var(--muted)] leading-relaxed">
            가격이 볼린저밴드 하단/상단에 터치하고, RSI가 과매도/과매수 구간이며, MACD 모멘텀이 반전될 때 발생.
            <span className="text-slate-400"> 역추세 반등/반락 신호.</span>
          </p>
        </div>

        {/* SQZ BUY / SQZ SELL */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-sm font-bold">▲ SQZ BUY</span>
            <span className="text-red-400 text-sm font-bold">▼ SQZ SELL</span>
          </div>
          <p className="text-[11px] text-[var(--muted)] leading-relaxed">
            스퀴즈(BB가 KC 안으로 수렴) 해제 순간 + 모멘텀 방향으로 발생.
            <span className="text-yellow-400"> 에너지 압축 후 폭발적 방향 전환 — 추세 시작 신호로 신뢰도 높음.</span>
          </p>
        </div>
      </div>
    </div>
  )
}

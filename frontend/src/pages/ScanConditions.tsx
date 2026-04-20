import ConditionsSection from '../components/conditions/ConditionsSection'
import {
  BUY_PIPELINE_STEPS,
  BUY_PIPELINE_MERMAID,
  SELL_FLOWCHART_STEPS,
  SELL_FLOWCHART_MERMAID,
  CONDITION_VALUES,
} from '../constants/conditions'

const SELL_GUIDANCE =
  'SELL 라벨은 추천종목·눌림목 스냅샷 생성에는 사용되지 않습니다. ' +
  '대신 관심종목(Watchlist)에 등록된 종목을 대상으로 (1) 상태 전환 시 즉시 텔레그램 알림, ' +
  '(2) 정기 SELL 알림(KR: 09:00~15:30 KST 30분 주기 / US: 20:00·04:00 KST)으로 사용됩니다.'

export default function ScanConditions() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-[var(--fg)]">조회조건</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          차트 라벨과 추천종목·눌림목 스냅샷이 생성되는 조건을 단계별로 공개합니다.
          PC에서는 흐름도, 모바일에서는 조건표로 표시합니다.
        </p>
      </header>

      <ConditionsSection
        title="매수 통합 파이프라인"
        description="BUY·SQZ BUY 라벨 판정부터 추천종목·눌림목 확정까지의 전체 흐름"
        steps={BUY_PIPELINE_STEPS}
        pcDiagram={BUY_PIPELINE_MERMAID}
        pcDiagramId="buy-pipeline"
      />

      <section>
        <h3 className="text-sm font-semibold text-[var(--fg)] mb-2">RSI 민감도 프리셋</h3>
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg)]">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-[var(--muted)]">프리셋</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-[var(--muted)]">BUY RSI 임계값</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {(Object.entries(CONDITION_VALUES.RSI_BUY_PRESETS) as [string, number][]).map(([name, value]) => (
                <tr key={name}>
                  <td className="px-3 py-2 text-[var(--fg)]">{name}</td>
                  <td className="px-3 py-2 text-[var(--fg)]">RSI &lt; {value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">
          SELL 라벨의 RSI 기준은 민감도 프리셋과 무관하게 항상 60으로 고정됩니다.
        </p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-[var(--fg)] mb-2">추천종목 · 눌림목 선정 조건</h3>
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg)]">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-[var(--muted)]">조건</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-[var(--muted)]">추천종목</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-[var(--muted)]">눌림목</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {[
                {
                  label: 'BUY 또는 SQZ BUY 라벨 발생',
                  sub: 'BB 터치/복귀 + RSI 필터 + 모멘텀 / 스퀴즈 해제',
                  buy: true,
                  pull: true,
                },
                {
                  label: 'EMA 5선 미역배열',
                  sub: 'EMA5 < EMA10 < EMA20 < EMA60 < EMA120 전체 역배열이면 제외',
                  buy: true,
                  pull: true,
                },
                {
                  label: '데이터 소스 신선도',
                  sub: '마지막 봉이 오늘 기준 7 달력일 이내 (거래정지·상장폐지 차단)',
                  buy: true,
                  pull: true,
                },
                {
                  label: '신호 신선도',
                  sub: '신호 발생 봉이 최근 20 거래일 이내',
                  buy: true,
                  pull: true,
                },
                {
                  label: '장기 상승추세',
                  sub: 'EMA20 > EMA60 > EMA120',
                  buy: false,
                  pull: true,
                },
                {
                  label: '단기 눌림',
                  sub: 'EMA5 현재값 < 직전값 (단기 하락 중)',
                  buy: false,
                  pull: true,
                },
                {
                  label: '대형주',
                  sub: 'KR: KOSPI200·KOSDAQ150 포함 종목 / US: S&P500 포함 종목 (ETF 제외)',
                  buy: false,
                  pull: true,
                },
              ].map(({ label, sub, buy, pull }) => (
                <tr key={label}>
                  <td className="px-3 py-2">
                    <div className="text-[var(--fg)]">{label}</div>
                    <div className="text-xs text-[var(--muted)] mt-0.5">{sub}</div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {buy ? <span className="text-green-400 font-bold">✓</span> : <span className="text-[var(--muted)]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {pull ? <span className="text-green-400 font-bold">✓</span> : <span className="text-[var(--muted)]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">
          눌림목은 추천종목 조건을 모두 충족한 뒤 장기 상승추세 + 단기 눌림 + 대형주 조건을 추가로 통과한 종목입니다.
        </p>
      </section>

      <hr className="border-[var(--border)]" />

      <ConditionsSection
        title="SELL 라벨 (별도)"
        description="매도 신호 차트 마커 생성 조건"
        steps={SELL_FLOWCHART_STEPS}
        pcDiagram={SELL_FLOWCHART_MERMAID}
        pcDiagramId="sell-flowchart"
        guidance={SELL_GUIDANCE}
      />
    </div>
  )
}

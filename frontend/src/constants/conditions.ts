// 조회조건 페이지 단일 데이터 소스
// PC(≥768px)는 Mermaid 플로우차트, 모바일(<768px)은 카드형 조건표로 렌더.
// Step[] 배열이 양쪽 렌더링의 단일 소스.

export type StepKind =
  | 'entry'
  | 'condition'
  | 'branch'
  | 'merge'
  | 'success'
  | 'reject'
  | 'note'

export interface StepBranch {
  label: string
  targetId: string
}

export interface Step {
  id: string
  kind: StepKind
  label: string
  description?: string
  branches?: StepBranch[]
  nextId?: string
  note?: string
  group?:
    | 'buy-entry'
    | 'sqz-entry'
    | 'common-filter'
    | 'outcome'
    | 'sell-entry'
    | 'sell-outcome'
}

export const CONDITION_VALUES = {
  RSI_BUY_PRESETS: { strict: 30, normal: 35, sensitive: 40 },
  RSI_SELL: 60,
  COOLDOWN_BARS: 5,
  SIGNAL_LOOKBACK_DAYS: 20,
  DATA_STALENESS_DAYS: 7,
  MIN_CANDLES: 60,
  RESPONSIVE_BREAKPOINT_PX: 768,
} as const

// Step[] → Mermaid flowchart TD DSL 변환
// Why: PC·모바일이 같은 배열에서 파생되어 조건 변경 시 한 곳만 수정하면 됨.
function escapeLabel(text: string): string {
  // Mermaid 라벨 안의 특수문자 이스케이프
  return text
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function nodeShape(step: Step): string {
  const label = `"${escapeLabel(step.label)}"`
  switch (step.kind) {
    case 'entry':
      return `${step.id}([${label}])`
    case 'condition':
    case 'branch':
      return `${step.id}{${label}}`
    case 'merge':
      return `${step.id}[${label}]`
    case 'success':
      return `${step.id}[[${label}]]`
    case 'reject':
      return `${step.id}[${label}]:::reject`
    case 'note':
      return `${step.id}[/${label}/]`
  }
}

export function stepsToMermaidFlowchart(steps: readonly Step[]): string {
  const lines: string[] = ['flowchart TD']

  // 노드 선언
  for (const step of steps) {
    lines.push(`  ${nodeShape(step)}`)
  }

  // 엣지 선언
  for (const step of steps) {
    if (step.branches && step.branches.length > 0) {
      for (const branch of step.branches) {
        // 엣지 라벨에 괄호·특수문자가 있을 수 있으므로 큰따옴표로 감싸 Mermaid 파서가 노드 shape으로 오인하지 않게 한다.
        lines.push(`  ${step.id} -->|"${escapeLabel(branch.label)}"| ${branch.targetId}`)
      }
    } else if (step.nextId) {
      lines.push(`  ${step.id} --> ${step.nextId}`)
    }
  }

  // 스타일 클래스
  lines.push('  classDef reject fill:#7f1d1d,stroke:#ef4444,color:#fecaca')
  lines.push('  classDef success fill:#14532d,stroke:#22c55e,color:#bbf7d0')

  return lines.join('\n')
}

// ── 매수 통합 파이프라인 ────────────────────────────────────────────
// 핵심조건(BUY/SQZ BUY 라벨 판정)이 진입점, 이후 3단 필터(데드크로스 제외 →
// 신호 신선도 → EMA 장기추세)를 거쳐 추천종목 확정, 추가로 눌림목으로 좁혀감.
export const BUY_PIPELINE_STEPS: readonly Step[] = [
  // BUY 판정 진입부 (분기 1: 터치/돌파)
  {
    id: 'buy_bb_touch',
    kind: 'condition',
    label: 'BB 하단 터치/돌파',
    description: 'low ≤ BB하단 또는 close가 BB하단을 위→아래로 관통',
    nextId: 'buy_rsi',
    group: 'buy-entry',
  },
  {
    id: 'buy_rsi',
    kind: 'condition',
    label: 'RSI < 프리셋 임계값',
    description: '민감도별: strict 30 / normal 35 / sensitive 40',
    nextId: 'buy_mom_rise',
    group: 'buy-entry',
  },
  {
    id: 'buy_mom_rise',
    kind: 'condition',
    label: '모멘텀 상승',
    description: 'EMA12-EMA26 > 이전봉',
    nextId: 'buy_label',
    group: 'buy-entry',
  },
  // BUY 판정 진입부 (분기 2: 복귀)
  {
    id: 'buy_bb_reverse',
    kind: 'condition',
    label: 'BB 하단 복귀',
    description: '전봉 close ≤ BB하단, 현봉 close > BB하단',
    nextId: 'buy_rsi_reverse',
    group: 'buy-entry',
  },
  {
    id: 'buy_rsi_reverse',
    kind: 'condition',
    label: 'RSI < 프리셋 임계값',
    description: '동일 RSI 필터 (30/35/40)',
    nextId: 'buy_label',
    group: 'buy-entry',
  },
  {
    id: 'buy_label',
    kind: 'success',
    label: 'BUY 라벨 발생',
    note: '이전 BUY 이후 5봉 쿨다운',
    nextId: 'label_merge',
    group: 'buy-entry',
  },
  // SQZ BUY 판정 진입부
  {
    id: 'sqz_fired',
    kind: 'condition',
    label: '스퀴즈 해제',
    description: '전봉 squeeze ON → 현봉 OFF',
    nextId: 'sqz_mom_bull',
    group: 'sqz-entry',
  },
  {
    id: 'sqz_mom_bull',
    kind: 'condition',
    label: '모멘텀 양수',
    description: 'EMA12-EMA26 > 0',
    nextId: 'sqz_mom_rise',
    group: 'sqz-entry',
  },
  {
    id: 'sqz_mom_rise',
    kind: 'condition',
    label: '모멘텀 상승',
    description: '현재 모멘텀 > 이전봉 모멘텀',
    nextId: 'sqz_buy_label',
    group: 'sqz-entry',
  },
  {
    id: 'sqz_buy_label',
    kind: 'success',
    label: 'SQZ BUY 라벨 발생',
    note: '이전 BUY 이후 5봉 쿨다운',
    nextId: 'label_merge',
    group: 'sqz-entry',
  },
  // 합류 → 공통 필터
  {
    id: 'label_merge',
    kind: 'merge',
    label: '라벨 발생 종목 풀',
    nextId: 'dead_cross',
    group: 'common-filter',
  },
  {
    id: 'dead_cross',
    kind: 'branch',
    label: 'EMA 5선 전체 역배열?',
    description: 'EMA5 < EMA10 < EMA20 < EMA60 < EMA120',
    branches: [
      { label: '역배열 (제외)', targetId: 'dead_cross_reject' },
      { label: '미역배열 (통과)', targetId: 'freshness' },
    ],
    group: 'common-filter',
  },
  {
    id: 'dead_cross_reject',
    kind: 'reject',
    label: '제외 — 데드크로스',
    group: 'common-filter',
  },
  {
    id: 'freshness',
    kind: 'branch',
    label: '데이터 소스 헬스 — 마지막 봉 7일 이내',
    description: '오늘(UTC) − 마지막 봉 날짜 ≤ 7 달력일. yfinance가 정상 갱신 중인지 확인 (거래정지·상장폐지·소스 장애 차단). 정상 휴장(주말·연휴)은 통과.',
    branches: [
      { label: '소스 죽음 (제외)', targetId: 'stale_reject' },
      { label: '소스 살아있음 (통과)', targetId: 'recent_20d' },
    ],
    group: 'common-filter',
  },
  {
    id: 'stale_reject',
    kind: 'reject',
    label: '제외 — 데이터 소스 오래됨',
    description: '마지막 봉이 8일 이상 오래됨 → 데이터 자체가 죽었으므로 신호 분석 의미 없음',
    group: 'common-filter',
  },
  {
    id: 'recent_20d',
    kind: 'branch',
    label: '신호 신선도 — 발생 시점이 최근 20거래일 이내',
    description: 'df 길이 − 신호 봉 인덱스 ≤ 20 거래일. 신호 자체가 매매 가치를 잃지 않았는지 확인. (데이터 소스가 살아있어도 신호가 한참 전이면 제외)',
    branches: [
      { label: '오래된 신호 (제외)', targetId: 'recent_reject' },
      { label: '최근 신호 (통과)', targetId: 'ema_trend' },
    ],
    group: 'common-filter',
  },
  {
    id: 'recent_reject',
    kind: 'reject',
    label: '제외 — 신호가 오래됨',
    description: '20거래일(약 4주) 이상 전의 신호 → 매매 타이밍 지남',
    group: 'common-filter',
  },
  {
    id: 'ema_trend',
    kind: 'branch',
    label: 'EMA 장기추세 — EMA20 > EMA60 > EMA120?',
    description: '세 EMA의 정배열로 장기 상승추세 확인. 역배열이면 추천종목에서 제외.',
    branches: [
      { label: '역배열 또는 수렴 (제외)', targetId: 'ema_trend_reject' },
      { label: '정배열 (통과)', targetId: 'chart_buy_confirmed' },
    ],
    group: 'common-filter',
  },
  {
    id: 'ema_trend_reject',
    kind: 'reject',
    label: '제외 — EMA 장기추세 미충족',
    description: 'EMA20 ≤ EMA60 또는 EMA60 ≤ EMA120 → 장기 상승추세가 아님',
    group: 'common-filter',
  },
  // 결과 분기
  {
    id: 'chart_buy_confirmed',
    kind: 'success',
    label: '추천종목 확정',
    description: '20거래일 이내 BUY/SQZ BUY + 데드크로스 없음 + EMA20>60>120 모두 충족',
    nextId: 'pullback_branch',
    group: 'outcome',
  },
  {
    id: 'pullback_branch',
    kind: 'branch',
    label: '눌림목 필터 통과?',
    description: 'EMA5 현재 < 직전 (단기 눌림) + 대형주(KOSPI200·KOSDAQ150·S&P500)',
    branches: [
      { label: '통과', targetId: 'pullback_confirmed' },
      { label: '미통과', targetId: 'chart_buy_only' },
    ],
    group: 'outcome',
  },
  {
    id: 'pullback_confirmed',
    kind: 'success',
    label: '눌림목 확정',
    description: '추천종목 + 눌림목 목록에 포함',
    group: 'outcome',
  },
  {
    id: 'chart_buy_only',
    kind: 'note',
    label: '추천종목으로만 분류',
    description: '눌림목 미포함',
    group: 'outcome',
  },
]

// ── SELL 별도 플로우차트 ────────────────────────────────────────────
// 차트 표시 전용, 추천종목/눌림목 선정에 사용되지 않음.
export const SELL_FLOWCHART_STEPS: readonly Step[] = [
  // SELL 분기 1: 상단 터치/돌파
  {
    id: 'sell_bb_touch',
    kind: 'condition',
    label: 'BB 상단 터치/돌파',
    description: 'high ≥ BB상단 또는 close가 BB상단을 아래→위로 관통',
    nextId: 'sell_rsi',
    group: 'sell-entry',
  },
  {
    id: 'sell_rsi',
    kind: 'condition',
    label: 'RSI > 60 (고정값)',
    description: '민감도 프리셋 미반영, 항상 60',
    nextId: 'sell_mom_fall',
    group: 'sell-entry',
  },
  {
    id: 'sell_mom_fall',
    kind: 'condition',
    label: '모멘텀 하락',
    description: 'EMA12-EMA26 < 이전봉',
    nextId: 'sell_label',
    group: 'sell-entry',
  },
  // SELL 분기 2: 상단 복귀
  {
    id: 'sell_bb_reverse',
    kind: 'condition',
    label: 'BB 상단 복귀',
    description: '전봉 close ≥ BB상단, 현봉 close < BB상단',
    nextId: 'sell_rsi_reverse',
    group: 'sell-entry',
  },
  {
    id: 'sell_rsi_reverse',
    kind: 'condition',
    label: 'RSI > 60 (고정값)',
    description: '동일 RSI 필터',
    nextId: 'sell_label',
    group: 'sell-entry',
  },
  {
    id: 'sell_label',
    kind: 'success',
    label: 'SELL 라벨 발생',
    note: '이전 SELL 이후 5봉 쿨다운',
    nextId: 'sell_watchlist_check',
    group: 'sell-outcome',
  },
  {
    id: 'sell_watchlist_check',
    kind: 'branch',
    label: '관심종목(Watchlist)에 등록된 종목인가?',
    description: 'backend/services/scanner.py가 활성 watchlist 종목만 모니터링',
    branches: [
      { label: '미등록 (차트 표시만)', targetId: 'sell_chart_only' },
      { label: '등록됨 (알림 진입)', targetId: 'sell_realtime_alert' },
    ],
    group: 'sell-outcome',
  },
  {
    id: 'sell_chart_only',
    kind: 'note',
    label: '차트 마커 표시만',
    description: '추천종목·눌림목 선정·알림에 사용되지 않음',
    group: 'sell-outcome',
  },
  {
    id: 'sell_realtime_alert',
    kind: 'success',
    label: '즉시 텔레그램 알림',
    description: 'CurrentSignal 상태가 prev → SELL로 전환된 순간 telegram.send_signal_alert() 호출',
    note: '소스: backend/services/scanner.py:89-104',
    branches: [
      { label: 'KR 스케줄', targetId: 'sell_scheduled_kr' },
      { label: 'US 스케줄', targetId: 'sell_scheduled_us' },
    ],
    group: 'sell-outcome',
  },
  {
    id: 'sell_scheduled_kr',
    kind: 'success',
    label: 'KR 정기 알림 — 30분 주기',
    description: '평일 09:00~15:30 KST, 30분 간격. CurrentSignal.signal_state="SELL" 종목 일괄 발송. 2분 이내 중복 발송 방지.',
    note: '소스: backend/services/sell_signal_alert.py + scheduler.py:144-186',
    group: 'sell-outcome',
  },
  {
    id: 'sell_scheduled_us',
    kind: 'success',
    label: 'US 정기 알림 — 1일 2회',
    description: '20:00 KST (장 전) · 04:00 KST (장 후). CurrentSignal.signal_state="SELL" 종목 일괄 발송. 2분 이내 중복 발송 방지.',
    note: '소스: backend/services/sell_signal_alert.py + scheduler.py:144-186',
    group: 'sell-outcome',
  },
]

// 모듈 로드 시 1회 계산
export const BUY_PIPELINE_MERMAID: string = stepsToMermaidFlowchart(BUY_PIPELINE_STEPS)
export const SELL_FLOWCHART_MERMAID: string = stepsToMermaidFlowchart(SELL_FLOWCHART_STEPS)

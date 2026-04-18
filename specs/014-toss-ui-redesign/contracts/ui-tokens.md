# UI Contracts: 색상 토큰 & 컴포넌트 인터페이스 (014)

## 색상 토큰 계약 (CSS Custom Properties)

모든 컴포넌트는 아래 CSS 변수를 통해 색상을 참조해야 한다. hex 값 직접 사용 금지 (차트 라이브러리 제외).

```css
/* 배경 계층 */
--bg:      #000000   /* 페이지 배경 */
--card:    #1c1c1e   /* 카드/패널 배경 */
--border:  #2c2c2e   /* 구분선 */

/* 텍스트 계층 */
--text:    #ffffff   /* 주 텍스트 */
--muted:   #8e8e93   /* 보조/레이블 텍스트 */
--neutral: #636366   /* 비활성 탭/아이콘 */

/* 신호 색상 */
--buy:     #ff4b6a   /* 상승/BUY/활성 강조 */
--sell:    #4285f4   /* 하락/SELL */
```

## 컴포넌트 색상 사용 규칙

### 상승/하락 표기
```
상승(양수): text-[var(--buy)]
하락(음수): text-[var(--sell)]
중립: text-[var(--muted)]
```

### 카드 컨테이너
```
배경: bg-[var(--card)]
테두리: border border-[var(--border)]
모서리: rounded-xl (12px)
패딩: p-4 (16px)
```

### 정보 행 패턴
```tsx
<div className="flex justify-between items-center">
  <span className="text-[var(--muted)] text-sm">{label}</span>
  <span className="text-[var(--text)] font-mono font-semibold">{value}</span>
</div>
```

### 차트 (lightweight-charts v5) — hex 직접 사용
```ts
// CandlestickSeries 옵션
upColor:        '#ff4b6a'
downColor:      '#4285f4'
wickUpColor:    '#ff4b6a'
wickDownColor:  '#4285f4'

// 차트 레이아웃
layout.background.color:   '#000000'
grid.vertLines.color:      '#2c2c2e'
grid.horzLines.color:      'rgba(44,44,46,0.5)'
textColor:                 '#8e8e93'
```

### BottomNav 활성 탭
```
활성: text-[var(--buy)]  (아이콘 + 텍스트)
비활성: text-[var(--neutral)]
탭바 배경: bg-black/85 backdrop-blur-md
```

## 타이포그래피 계약

| 용도 | Tailwind 클래스 |
|------|----------------|
| 섹션 제목 | `text-base md:text-sm font-semibold text-[var(--text)]` |
| 종목명 | `text-[15px] md:text-sm font-semibold text-[var(--text)]` |
| 현재가(숫자) | `text-lg md:text-sm font-bold font-mono text-[var(--text)]` |
| 보조(등락률 등) | `text-[13px] md:text-[10px] font-mono` |
| 레이블 | `text-sm md:text-[10px] text-[var(--muted)]` |

# Data Model: Toss UI Redesign (014)

**Note**: 이 기능은 순수 프론트엔드 UI 변경이며 DB 스키마 변경 없음. 데이터 모델은 UI 상태 및 색상 토큰 구조를 정의한다.

---

## UI 색상 토큰 (CSS Custom Properties)

파일: `frontend/src/index.css`

| 토큰 변수 | 기존 값 | 신규 값 (Toss) | 용도 |
|-----------|---------|----------------|------|
| `--bg` | `#1B2B42` | `#000000` | 전체 배경 |
| `--card` | `#243556` | `#1c1c1e` | 카드/모달 배경 |
| `--border` | `#374F72` | `#2c2c2e` | 구분선, 테두리 |
| `--text` | `#e2e8f0` | `#ffffff` | 주 텍스트 |
| `--muted` | `#A4B8CE` | `#8e8e93` | 보조 텍스트 |
| `--buy` | `#E53935` | `#ff4b6a` | 상승/BUY 강조 |
| `--sell` | `#1E88E5` | `#4285f4` | 하락/SELL 강조 |
| `--neutral` | `#64748b` | `#636366` | 중립/비활성 |
| `--navy` | `#2C4472` | *(제거)* | 더 이상 사용 안 함 |
| `--gold` | `#D4A843` | *(제거)* | BottomNav 활성 색 → --buy로 대체 |

---

## 타이포그래피 스케일

| 레벨 | 용도 | 모바일 크기 | PC 크기 | 굵기 |
|------|------|-------------|---------|------|
| H1 | 섹션 제목 | 16px | 14px | 600 (semi-bold) |
| H2 | 카드 종목명 | 15px | 13px | 600 |
| Body | 현재가/수치 | 18px | 14px | 700 (bold) |
| Sub | 보조 정보(등락률 등) | 12-13px | 9-10px | 400 |
| Mono | 가격/퍼센트 숫자 | font-mono | font-mono | 600-700 |

---

## 카드 레이아웃 패턴

```
┌─────────────────────────────────┐  border-radius: 12px (rounded-xl)
│  [종목명]          [현재가]      │  padding: 16px (p-4)
│  [심볼/시장]       [등락률]      │  background: var(--card)
│  ─────────────────────────────  │  border: 1px solid var(--border)
│  레이블(left) ...  값(right)    │
│  레이블(left) ...  값(right)    │
└─────────────────────────────────┘
```

**정보 행 패턴 (label-left / value-right)**:
- 레이블: `text-[var(--muted)]` + 왼쪽 정렬
- 값: `text-[var(--text)]` or `text-[var(--buy/sell)]` + 오른쪽 정렬 (font-mono)

---

## 차트 색상 설정

파일: `frontend/src/components/charts/IndicatorChart.tsx`, `frontend/src/pages/Forex.tsx`, `frontend/src/components/SentimentPanel.tsx`

| 설정 항목 | 기존 값 | 신규 값 |
|-----------|---------|---------|
| 캔들 upColor | `#26a69a` | `#ff4b6a` |
| 캔들 downColor | `#ef5350` | `#4285f4` |
| 캔들 wickUpColor | `#26a69a` | `#ff4b6a` |
| 캔들 wickDownColor | `#ef5350` | `#4285f4` |
| 차트 배경 | `#1e293b` | `#000000` |
| 수직 격자선 | `#1e293b` | `#2c2c2e` |
| 수평 격자선 | `#262f3d` | `rgba(44,44,46,0.5)` |
| 텍스트 색상 | `#94a3b8` | `#8e8e93` |

---

## BottomNav 상태 모델

| 상태 | 아이콘 색 | 텍스트 색 | 굵기 |
|------|-----------|-----------|------|
| 활성(active) | `var(--buy)` = `#ff4b6a` | `var(--buy)` | 600 |
| 비활성 | `var(--neutral)` = `#636366` | `var(--neutral)` | 400 |

**탭바 배경**: `rgba(0,0,0,0.85)` + `backdrop-blur-md`

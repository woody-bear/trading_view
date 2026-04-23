# Research: PC 스캔 화면 최상단 BUY 신호 5개 스트립

**Feature**: 032-scan-buy-strip-pc  
**Date**: 2026-04-23

## Summary

프론트엔드 전용 작업이므로 신규 기술 조사 불필요. 기존 컴포넌트/API 재사용 결정만 문서화.

---

## Decision 1: 데이터 소스

- **Decision**: 기존 `fetchFullScanLatest()` + queryKey `'quick-buy-strip'` 재사용
- **Rationale**: `QuickBuyStrip`(모바일 홈)이 이미 동일 쿼리를 사용 중이므로 React Query 캐시가 자동 공유됨. 추가 API 호출 없음.
- **Alternatives considered**:
  - 신규 엔드포인트 → 불필요, 기존 `/signals/latest-buy` 응답에 `chart_buy.items` 포함
  - 별도 queryKey → 캐시 공유 불가, 중복 fetch 발생

## Decision 2: 컴포넌트 위치

- **Decision**: `Dashboard.tsx` 내 `PcBuyStrip` 컴포넌트로 선언, `PcScanPanel` 최상단(ScanStatusPanel 위)에 삽입
- **Rationale**: `BuyCard`, `livePrices`, `fetchFullScanLatest`가 동일 파일에 존재하므로 import 불필요, 파일 수 최소화
- **Alternatives considered**:
  - 별도 파일 `PcBuyStrip.tsx` → 오버엔지니어링, 범용성 없는 단일 용도 컴포넌트

## Decision 3: 카드 형식

- **Decision**: 기존 `BuyCard` 컴포넌트 그대로 재사용 (MiniWatchCard 형식)
- **Rationale**: 사용자 명시 요청. 모바일 스캔 탭과 동일한 형식으로 일관성 확보
- **Alternatives considered**:
  - `QuickBuyStrip`의 기존 작은 카드 형식 → 사용자가 명시적으로 거부

## Decision 4: 반응형 처리

- **Decision**: `hidden md:flex` Tailwind 클래스로 모바일 숨김
- **Rationale**: 프로젝트 전반에 걸친 기존 반응형 패턴과 일치
- **Alternatives considered**:
  - CSS media query → Tailwind 프로젝트에서 불일관적

## Decision 5: 그리드 레이아웃

- **Decision**: `grid-cols-5` 고정, 카드가 5개 미만이어도 레이아웃 고정
- **Rationale**: 항상 1행으로 표시, 일관된 시각적 구조 유지
- **Alternatives considered**:
  - `grid-cols-[items.length]` 동적 열 수 → 카드 수에 따라 레이아웃이 달라져 불안정

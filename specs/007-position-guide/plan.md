# Implementation Plan: 분할매수/매도 포지션 가이드

**Branch**: `007-position-guide` | **Date**: 2026-03-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-position-guide/spec.md`

## Summary

종목 상세화면에서 현재 신호 상태(BUY/SELL/NEUTRAL)와 지표(RSI, BB %B, EMA)를 기반으로 단계별 분할매수/매도 가이드를 표시한다. 프론트엔드 전용 컴포넌트로, 백엔드 변경 없이 기존 차트 데이터(`current` 객체)에서 지표를 읽어 판정한다.

## Technical Context

**Language/Version**: TypeScript 5.x (React 18) — 프론트엔드 전용
**Primary Dependencies**: React 18, Tailwind CSS
**Storage**: N/A (DB 변경 없음, 상태 저장 없음)
**Testing**: tsc --noEmit + pnpm build
**Target Platform**: Web (브라우저)
**Project Type**: Web application — 프론트엔드 컴포넌트 추가
**Performance Goals**: 가이드 표시 즉시 (<100ms, 별도 API 호출 없음)
**Constraints**: 기존 SignalDetail 페이지의 지표 데이터(`s` 객체)에서 직접 참조
**Scale/Scope**: 1개 컴포넌트 신규 + SignalDetail.tsx 통합

## Constitution Check

*Constitution is in template state (not configured). PASS.*

## Project Structure

### Source Code

```text
frontend/
├── src/
│   ├── components/
│   │   └── PositionGuide.tsx    # 신규: 분할매수/매도 가이드 컴포넌트
│   └── pages/
│       └── SignalDetail.tsx      # 수정: PositionGuide 통합
```

**구조 결정**: 단일 컴포넌트(`PositionGuide.tsx`)로 구현. BUY/SELL/NEUTRAL 3가지 상태를 내부에서 분기. 별도 파일 분리 불필요한 규모.

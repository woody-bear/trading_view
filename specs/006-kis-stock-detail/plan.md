# Implementation Plan: 종목 상세화면 업그레이드 (KIS API)

**Branch**: `006-kis-stock-detail` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-kis-stock-detail/spec.md`

## Summary

한국투자증권 API(pykis)에서 이미 제공되지만 미활용 중인 데이터(투자지표, 52주 고/저, 호가, 위험경고, 가격제한)를 종목 상세화면에 추가 표시한다. 기존 `kis_client.py`의 `get_quote()` 확장 + 신규 `get_orderbook()` 메서드로 백엔드 API를 구성하고, 프론트엔드에 3개 정보 패널을 추가한다.

## Technical Context

**Language/Version**: Python 3.12 (backend) + TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, pykis (한투 API), React 18, Tailwind CSS
**Storage**: SQLite WAL (aiosqlite) — 투자지표 캐시용 메모리 캐시 (dict + TTL)
**Testing**: ruff (lint) + TypeScript tsc
**Target Platform**: Web (macOS/Linux 서버, 브라우저)
**Project Type**: Web application (단일 서버, FastAPI + React SPA)
**Performance Goals**: 투자지표 1초 이내 표시, 호가 5초 이내 갱신
**Constraints**: KIS API 초당 20회 제한, WebSocket 40종목 제한
**Scale/Scope**: 1인 사용 시스템, 한국 주식 3,700+ 종목

## Constitution Check

*GATE: Constitution is in template state (not configured). No violations to check. PASS.*

## Project Structure

### Documentation (this feature)

```text
specs/006-kis-stock-detail/
├── plan.md              # This file
├── research.md          # Phase 0: KIS API 필드 조사 결과
├── data-model.md        # Phase 1: 데이터 모델
├── quickstart.md        # Phase 1: 빠른 시작 가이드
├── contracts/           # Phase 1: API 계약
│   └── stock-detail-api.md
└── tasks.md             # Phase 2: 태스크 목록 (별도 명령)
```

### Source Code (repository root)

```text
backend/
├── services/
│   └── kis_client.py          # 수정: get_stock_detail(), get_orderbook() 추가
├── routes/
│   └── prices.py              # 수정: /api/stocks/{symbol}/detail, /api/stocks/{symbol}/orderbook 추가
└── (기존 파일 변경 없음)

frontend/
├── src/
│   ├── api/
│   │   └── client.ts          # 수정: fetchStockDetail(), fetchOrderbook() 추가
│   ├── components/
│   │   ├── StockFundamentals.tsx  # 신규: 투자지표 + 52주 범위 패널
│   │   ├── OrderbookPanel.tsx     # 신규: 호가창 패널
│   │   └── RiskWarningBanner.tsx  # 신규: 위험경고 배너
│   └── pages/
│       └── SignalDetail.tsx    # 수정: 위 3개 컴포넌트 통합
```

**Structure Decision**: 기존 웹 앱 구조(backend/ + frontend/) 유지. 백엔드 2개 파일 수정 + 프론트엔드 3개 컴포넌트 신규.

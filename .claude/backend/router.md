---
purpose: backend/routes/ 하위 모든 FastAPI 라우터의 엔드포인트·태그·의존성·응답 스키마 설명.
reader: Claude가 새 API 엔드포인트를 추가·수정하거나 기존 라우터 구조를 파악할 때.
update-trigger: backend/routes/ 하위 파일 추가·제거; 엔드포인트 path/method 변경; 전역 미들웨어·prefix 변경.
last-audit: 2026-04-18
---

# Backend — 라우터 (routes/)

> 소스: `backend/routes/__init__.py` + 각 라우터 파일  
> 모든 라우트는 `prefix="/api"` 하위에 등록됨

## 라우터 등록 순서 (`routes/__init__.py`)

```
auth → position → signals → watchlist → charts → system →
webhook → market_scan → search → quick_chart → forex →
settings → prices → financials → alerts → sentiment →
pattern_cases → company
```

---

## 라우터별 엔드포인트 목록

### /api/auth — 인증
| Method | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/sync` | 로그인 후 user_profiles upsert |
| GET | `/api/me` | 현재 사용자 프로필 조회 |

### /api/watchlist — 관심종목
| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/watchlist` | 전체 관심종목 목록 |
| POST | `/api/watchlist` | 관심종목 추가 |
| PATCH | `/api/watchlist/{id}` | 종목 수정 (timeframe 등) |
| DELETE | `/api/watchlist/{id}` | 관심종목 삭제 |

### /api/signals — 신호 조회
| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/signals` | 관심종목 신호 목록 |
| GET | `/api/signals/{id}/chart` | 종목 ID 기준 차트 데이터 |
| GET | `/api/signals/by-symbol/{symbol}` | 심볼 기준 신호 조회 |
| GET | `/api/signals/latest-buy` | 최신 BUY 신호 종목 |
| POST | `/api/signals/latest-buy/refresh` | BUY 신호 갱신 |

### /api/scan — 시장 스캔
| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/scan/unified` | 통합 스캔 캐시 조회 |
| POST | `/api/scan/unified` | 통합 스캔 실행 (인메모리) |
| GET | `/api/scan/status` | 스캔 진행 상태 |
| POST | `/api/scan/trigger` | 수동 스캔 트리거 |
| GET | `/api/scan/full/latest` | 최신 완료 스냅샷 (~30ms) |
| GET | `/api/scan/full/status` | 전체 스캔 진행률 |
| POST | `/api/scan/full/trigger` | 전체 스캔 수동 실행 |
| GET | `/api/scan/full/history` | 최근 스냅샷 이력 (기본 10개) |
| GET | `/api/scan/full/snapshot/{id}/buy-items` | 특정 스냅샷 BUY 종목 |
| GET | `/api/scan/symbols` | 스캔 대상 종목 목록 (인증 불필요) |

### /api/chart — 차트
| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/chart/by-symbol/{symbol}` | 심볼 기준 차트 |
| GET | `/api/chart/quick` | 퀵 차트 (params: symbol, market, timeframe) |
| GET | `/api/chart/indicators-at` | 특정 날짜 지표값 |

### /api/forex — 환율
| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/forex/analysis` | 적정환율 분석 (params: period=3M) |
| GET | `/api/forex/chart` | 환율 추이 차트 데이터 |

### /api/settings — 앱 설정
| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/settings/sensitivity` | 신호 민감도 조회 |
| PUT | `/api/settings/sensitivity` | 신호 민감도 변경 |
| GET | `/api/settings/telegram` | 텔레그램 설정 조회 |
| PUT | `/api/settings/telegram` | 텔레그램 설정 저장 |
| POST | `/api/settings/telegram/test` | 텔레그램 테스트 발송 |
| GET | `/api/settings/kis` | 한투 API 설정 조회 |
| PUT | `/api/settings/kis` | 한투 API 설정 저장 |
| POST | `/api/settings/kis/test` | 한투 연결 테스트 |

### /api/alerts — 알림 이력
| Method | 경로 | 설명 |
|--------|------|------|
| POST | `/api/alerts/buy-signal/test` | BUY 알림 테스트 발송 |
| GET | `/api/alerts/history` | 알림 이력 (params: alert_type, limit) |

### /api/prices — 실시간 가격
| Method | 경로 | 설명 |
|--------|------|------|
| POST | `/api/prices/batch` | 배치 가격 조회 |

### /api/search — 종목 검색
| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/search` | 종목명/심볼 검색 (params: q, market) |

### /api/sentiment — 시장 심리
| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/sentiment/overview` | 시장 심리 개요 |
| GET | `/api/sentiment/history` | 심리 이력 (params: days) |
| GET | `/api/sentiment/vix-history` | VIX 이력 (params: days) |

### /api/financials — 재무 데이터
| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/financials/{symbol}` | 재무 지표 (params: market) |

### /api/company — 회사 정보
| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/company/{symbol}` | 회사 정보 + 투자 지표 (params: market) |

### /api/stocks — 종목 상세 (KIS)
| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/stocks/{symbol}/detail` | 종목 상세 (params: market) |
| GET | `/api/stocks/{symbol}/orderbook` | 호가창 (params: market) |

### /api/position — 포지션 가이드
| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/position/{symbol}` | 포지션 가이드 상태 |
| PUT | `/api/position/{symbol}` | 분할매수 단계 업데이트 |

### /api/pattern-cases — 패턴 케이스 스크랩
| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/pattern-cases` | 스크랩 목록 |
| POST | `/api/pattern-cases` | 스크랩 추가 |
| PATCH | `/api/pattern-cases/{id}` | 스크랩 수정 |
| DELETE | `/api/pattern-cases/{id}` | 스크랩 삭제 |
| GET | `/api/pattern-cases/check` | 중복 확인 (params: symbol, signal_date) |

### /api/system — 시스템 상태
| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/health` | 서버 상태 확인 |
| GET | `/api/system/status` | 시스템 상세 상태 |

### /api/webhook — TradingView 웹훅
| Method | 경로 | 설명 |
|--------|------|------|
| POST | `/api/webhook/tradingview` | TradingView 알림 수신 |

### WebSocket
| 경로 | 설명 |
|------|------|
| `/ws` | 실시간 가격/신호 WebSocket |

---

## 인증 처리 패턴

```python
# 로그인 필수
from auth import get_current_user
@router.get("/protected")
async def endpoint(user: dict = Depends(get_current_user)):
    user_id = user.get("sub")  # Supabase UUID

# 로그인 선택 (비로그인도 허용)
from auth import get_optional_user
@router.get("/optional")
async def endpoint(user: Optional[dict] = Depends(get_optional_user)):
    ...
```

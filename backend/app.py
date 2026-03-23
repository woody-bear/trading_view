import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from config import get_settings

settings = get_settings()

# 로깅 설정
logger.remove()
logger.add(sys.stderr, level="INFO", format="{time:HH:mm:ss} | {level:<7} | {message}")
logger.add(
    str(Path(__file__).parent.parent / "logs" / "ubb_pro.log"),
    rotation="10 MB",
    retention="7 days",
    level="DEBUG",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level:<7} | {name}:{function}:{line} | {message}",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from scheduler import scheduler, setup_scheduler
    from services.price_feed import start_price_feed, stop_price_feed
    from services import kis_websocket

    logger.info("UBB Pro Signal System 시작")
    if not settings.telegram_configured:
        logger.warning("TELEGRAM_BOT_TOKEN 미설정 — 텔레그램 알림 비활성화")

    # 한투 실시간 WebSocket 연결 (설정 시)
    if settings.kis_configured:
        # 워치리스트에서 KR 종목 심볼 목록 조회
        kr_symbols = await _get_kr_watchlist_symbols()
        await kis_websocket.connect(kr_symbols)
        logger.info(f"한투 실시간 WebSocket 연결됨 ({len(kr_symbols)}개 종목)")
    else:
        logger.warning("KIS_APP_KEY 미설정 — 한투 실시간 비활성화 (pykrx fallback)")

    # 종목 마스터 로드
    from services.stock_master import refresh_stock_master
    try:
        await refresh_stock_master()
    except Exception as e:
        logger.warning(f"종목 마스터 초기 로드 실패: {e}")

    # 차트 캐시 무결성 검증 (오염된 캐시 자동 삭제)
    from services.chart_cache import validate_all_caches
    await validate_all_caches()

    setup_scheduler()
    scheduler.start()
    logger.info("스케줄러 시작됨")
    start_price_feed()
    logger.info("실시간 가격 피드 시작됨")
    yield
    stop_price_feed()
    await kis_websocket.disconnect()
    scheduler.shutdown()
    logger.info("UBB Pro Signal System 종료")


async def _get_kr_watchlist_symbols() -> list[str]:
    """DB에서 활성 KR 워치리스트 종목 심볼 조회."""
    try:
        from sqlalchemy import select
        from database import async_session
        from models import Watchlist

        async with async_session() as session:
            result = await session.execute(
                select(Watchlist.symbol).where(
                    Watchlist.market == "KR",
                    Watchlist.is_active.is_(True),
                )
            )
            return [row[0] for row in result.all()]
    except Exception as e:
        logger.warning(f"KR 워치리스트 조회 실패: {e}")
        return []


app = FastAPI(
    title="UBB Pro Signal System",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from routes import api_router
from routes.websocket import router as ws_router

app.include_router(api_router)
app.include_router(ws_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Admin 페이지 (API 서버 상태 확인용)
@app.get("/")
async def admin_page():
    from starlette.responses import HTMLResponse
    return HTMLResponse("""
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>UBB Pro API Server</title>
    <style>body{font-family:system-ui;background:#0f172a;color:#e2e8f0;padding:40px;max-width:600px;margin:0 auto}
    h1{color:#f59e0b}a{color:#38bdf8}.ok{color:#22c55e}code{background:#1e293b;padding:2px 6px;border-radius:4px}</style>
    </head><body>
    <h1>UBB Pro Signal System</h1>
    <p class="ok">API Server Running</p>
    <hr style="border-color:#334155">
    <p>API Docs: <a href="/docs">/docs</a></p>
    <p>Health: <a href="/api/health">/api/health</a></p>
    <p>Frontend: <a href="http://localhost:3000">localhost:3000</a></p>
    <hr style="border-color:#334155">
    <p style="color:#64748b;font-size:13px">이 서버는 API 전용입니다. 화면은 <code>localhost:3000</code>에서 확인하세요.</p>
    </body></html>
    """)

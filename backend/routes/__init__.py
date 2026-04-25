from fastapi import APIRouter

from routes.charts import router as charts_router
from routes.forex import router as forex_router
from routes.prices import router as prices_router
from routes.market_scan import router as market_scan_router
from routes.quick_chart import router as quick_chart_router
from routes.search import router as search_router
from routes.financials import router as financials_router
from routes.settings import router as settings_router
from routes.signals import router as signals_router
from routes.system import router as system_router
from routes.watchlist import router as watchlist_router
from routes.webhook import router as webhook_router
from routes.alerts import router as alerts_router
from routes.sentiment import router as sentiment_router
from routes.auth import router as auth_router
from routes.position import router as position_router
from routes.pattern_cases import router as pattern_cases_router
from routes.company import router as company_router
from routes.market_status import router as market_status_router
from routes.trend_analysis import router as trend_analysis_router
from routes.trendline_channels import router as trendline_channels_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(position_router)
api_router.include_router(signals_router)
api_router.include_router(watchlist_router)
api_router.include_router(charts_router)
api_router.include_router(system_router)
api_router.include_router(webhook_router)
api_router.include_router(market_scan_router)
api_router.include_router(search_router)
api_router.include_router(quick_chart_router)
api_router.include_router(forex_router)
api_router.include_router(settings_router)
api_router.include_router(prices_router)
api_router.include_router(financials_router)
api_router.include_router(alerts_router)
api_router.include_router(sentiment_router)
api_router.include_router(pattern_cases_router)
api_router.include_router(company_router)
api_router.include_router(market_status_router)
api_router.include_router(trend_analysis_router)
api_router.include_router(trendline_channels_router)

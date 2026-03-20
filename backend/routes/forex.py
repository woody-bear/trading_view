from dataclasses import asdict

from fastapi import APIRouter

from services.forex_analyzer import analyze, get_chart_data

router = APIRouter(tags=["forex"])


@router.get("/forex/analysis")
async def forex_analysis(period: str = "3M"):
    """달러리치 스타일 환율 분석."""
    if period not in ("1M", "3M", "6M", "1Y"):
        period = "3M"
    result = await analyze(period)
    return asdict(result)


@router.get("/forex/chart")
async def forex_chart():
    """환율 + DXY 차트 데이터."""
    return await get_chart_data()

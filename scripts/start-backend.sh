#!/bin/bash
# 기존 uvicorn 프로세스 전부 종료 후 1개만 실행
pkill -9 -f "uvicorn app:app" 2>/dev/null
sleep 1

cd /Users/woody/workflow/trading_view/backend
source .venv/bin/activate
exec python -m uvicorn app:app --host 0.0.0.0 --port 8000

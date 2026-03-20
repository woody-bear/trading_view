#!/bin/bash
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# 프론트엔드 빌드 (변경 있을 때만)
if [ "$1" = "--build" ] || [ ! -d "$PROJECT_DIR/frontend/dist" ]; then
  echo "📦 프론트엔드 빌드 중..."
  cd "$PROJECT_DIR/frontend" && pnpm build
fi

# 백엔드 실행
cd "$PROJECT_DIR/backend"
source .venv/bin/activate
echo "🚀 UBB Pro Signal System 시작 → http://localhost:8000"
uvicorn app:app --host 0.0.0.0 --port 8000

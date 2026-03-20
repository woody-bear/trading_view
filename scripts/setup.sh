#!/bin/bash
set -e
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== UBB Pro Signal System 초기 설정 ==="

# 백엔드
echo "📦 백엔드 설정 중..."
cd "$PROJECT_DIR/backend"
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
mkdir -p data

# DB 초기화
echo "🗄️ DB 마이그레이션..."
alembic upgrade head

# 프론트엔드
echo "📦 프론트엔드 설정 중..."
cd "$PROJECT_DIR/frontend"
pnpm install

# 환경변수
if [ ! -f "$PROJECT_DIR/.env" ]; then
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  echo "⚠️  .env 파일이 생성되었습니다. 텔레그램 토큰 등을 입력해주세요."
fi

echo "✅ 설정 완료!"
echo "   실행: ./scripts/start.sh --build"

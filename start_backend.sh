#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KSP Crime Analytics Platform — Backend Startup Script
# Kills any existing process on port 8000 before starting fresh.
# Usage: ./start_backend.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

PORT=8000
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="$PROJECT_ROOT/.venv/bin/python3"

echo "🔍 Checking for processes on port $PORT..."
if lsof -t -i:$PORT > /dev/null 2>&1; then
    echo "⚠️  Killing existing process on port $PORT..."
    kill -9 $(lsof -t -i:$PORT) 2>/dev/null || true
    sleep 1
    echo "✅ Port $PORT cleared."
else
    echo "✅ Port $PORT is free."
fi

# Activate virtual environment if it exists
if [ -f "$VENV_PYTHON" ]; then
    PYTHON="$VENV_PYTHON"
    echo "🐍 Using virtual environment: $PYTHON"
else
    PYTHON="python3"
    echo "🐍 Using system python3"
fi

echo ""
echo "🚀 Starting KSP Crime Analytics Backend..."
echo "   API will be available at: http://localhost:$PORT"
echo "   Swagger docs:             http://localhost:$PORT/docs"
echo "   Press Ctrl+C to stop."
echo ""

cd "$PROJECT_ROOT/backend"
exec "$PYTHON" app.py

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KSP Crime Analytics Platform — Unified Local Startup Script
# Starts both Backend and Frontend using Zoho Catalyst Cloud Datastore.
# ─────────────────────────────────────────────────────────────────────────────
set -e

BACKEND_PORT=8000
FRONTEND_PORT=3000
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="$PROJECT_ROOT/.venv/bin/python3"

# Configure Zoho Catalyst Live Cloud Datastore credentials
export CATALYST_PROJECT_ID="55341000000016001"
export CATALYST_ENVIRONMENT="Development"
export CATALYST_AUTH='{"client_id": "1000.R6VFC8TUZJWAD7AQLMCDV4ZDONJKRC", "client_secret": "41326b7868906dbc921e6f4c9dcde423fb2bc8ada2", "refresh_token": "1000.c938097a8398ac388df0d687ce23ffac.852d19dc1e05cdfe8950b98e7beda802"}'
export X_ZOHO_CATALYST_CONSOLE_URL="https://api.catalyst.zoho.in"
export X_ZOHO_CATALYST_ACCOUNTS_URL="https://accounts.zoho.in"
export X_ZOHO_CATALYST_IS_LOCAL="true"
export PYTHONUNBUFFERED=1






echo "🔍 Checking ports..."
if lsof -t -i:$BACKEND_PORT > /dev/null 2>&1; then
    echo "⚠️  Killing existing process on port $BACKEND_PORT..."
    kill -9 $(lsof -t -i:$BACKEND_PORT) 2>/dev/null || true
fi
if lsof -t -i:$FRONTEND_PORT > /dev/null 2>&1; then
    echo "⚠️  Killing existing process on port $FRONTEND_PORT..."
    kill -9 $(lsof -t -i:$FRONTEND_PORT) 2>/dev/null || true
fi
sleep 1

# Activate virtual environment if it exists
if [ -f "$VENV_PYTHON" ]; then
    PYTHON="$VENV_PYTHON"
    echo "🐍 Using virtual environment: $PYTHON"
else
    PYTHON="python3"
    echo "🐍 Using system python3"
fi

echo ""
echo "🚀 Starting KSP Crime Analytics Application Stack (Connected to Cloud Datastore)..."
echo ""

# Cleanup trap to kill background processes on exit
trap 'kill $(jobs -p) 2>/dev/null || true; echo -e "\n🛑 Application stack stopped successfully."; exit' SIGINT SIGTERM EXIT

# Start Backend
echo "📡 Launching backend API..."
cd "$PROJECT_ROOT/backend"
"$PYTHON" app.py > "$PROJECT_ROOT/backend.log" 2>&1 &
BACKEND_PID=$!

# Start Frontend
echo "💻 Launching frontend app..."
cd "$PROJECT_ROOT/frontend"
npm run dev > "$PROJECT_ROOT/frontend.log" 2>&1 &
FRONTEND_PID=$!

sleep 3

echo "✨ UNIFIED LOCAL SERVERS RUNNING:"
echo "--------------------------------------------------------"
echo "🖥️  Frontend:        http://localhost:$FRONTEND_PORT"
echo "📡 Backend API:      http://localhost:$BACKEND_PORT"
echo "📚 Swagger API Docs: http://localhost:$BACKEND_PORT/api/docs"
echo "🩺 Health Check:     http://localhost:$BACKEND_PORT/health"
echo "--------------------------------------------------------"
echo "📖 Logs are redirected to:"
echo "   - Backend:  $PROJECT_ROOT/backend.log"
echo "   - Frontend: $PROJECT_ROOT/frontend.log"
echo ""
echo "💡 Press [Ctrl+C] to stop both servers."
echo ""

# Keep running to tail logs and keep trap active
tail -f "$PROJECT_ROOT/backend.log"

#!/usr/bin/env bash
# Local development launcher for point-labeling-web.
#
#   PLW_DATA_ROOT=/path/to/SemanticKITTI ./run.sh
#   PLW_PORT=18090 ./run.sh
#
# It starts the open-format C++ backend and the Vite development server. Ctrl+C
# in this terminal stops both processes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$ROOT/logs"
SERVER_BUILD_DIR="$ROOT/server/build_linux_open"
mkdir -p "$LOGS"

DATA_ROOT="${PLW_DATA_ROOT:-$ROOT/clips}"
ASSETS="$ROOT/server/assets"
PORT="${PLW_PORT:-8090}"

if [[ ! -x "$SERVER_BUILD_DIR/point_labeler_server" ]]; then
  echo "[run] building open-format backend..."
  cmake -S "$ROOT/server" -B "$SERVER_BUILD_DIR" -DCMAKE_BUILD_TYPE=Release
  cmake --build "$SERVER_BUILD_DIR" -j"$(nproc)"
fi

if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
  (cd "$ROOT/frontend" && npm install)
fi

echo "[run] backend  -> http://localhost:$PORT"
"$SERVER_BUILD_DIR/point_labeler_server" \
  --root "$DATA_ROOT" --assets "$ASSETS" --port "$PORT" \
  >"$LOGS/backend.log" 2>&1 &
BACKEND_PID=$!

echo "[run] frontend -> http://localhost:5173"
(cd "$ROOT/frontend" && npm run dev) >"$LOGS/frontend.log" 2>&1 &
FRONTEND_PID=$!

cleanup() {
  echo
  echo "[run] stopping backend ($BACKEND_PID) and frontend ($FRONTEND_PID)"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
  wait "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[run] ready — open http://localhost:5173"
wait

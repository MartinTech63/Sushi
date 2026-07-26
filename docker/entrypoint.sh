#!/bin/sh
set -eu

DB_PATH="${DATABASE_URL:-/data/sushi.db}"
DB_DIR="$(dirname "$DB_PATH")"
PORT="${PORT:-8000}"

mkdir -p "$DB_DIR"

run_as_app() {
  if [ "$(id -u)" = "0" ]; then
    chown -R app:app "$DB_DIR" || true
    exec runuser -u app -- "$@"
  fi
  exec "$@"
}

# Default / compose CMD: always honor $PORT
if [ "$#" -eq 0 ] || { [ "$1" = "uvicorn" ] && [ "${2:-}" = "backend.main:app" ]; }; then
  run_as_app uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"
fi

run_as_app "$@"

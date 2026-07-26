#!/bin/bash
# Déploiement Sushi sur une VM Docker.
# Usage (sur la VM) :
#   chmod +x deploy.sh
#   ./deploy.sh              # pull + rebuild
#   FORCE_CLEAN=1 ./deploy.sh  # wipe du dossier code puis clone frais (.env conservé)
#   BRANCH_NAME=main PORT=8000 ./deploy.sh

set -euo pipefail

TARGET_DIR="${TARGET_DIR:-/root/Sushi}"
REPO_URL="${REPO_URL:-https://github.com/MartinTech63/Sushi.git}"
BRANCH_NAME="${BRANCH_NAME:-main}"
FORCE_CLEAN="${FORCE_CLEAN:-0}"
COMPOSE_CMD=""

log()  { echo "[deploy] $*"; }
fail() { echo "[deploy] ERREUR: $*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "commande requise introuvable: $1"
}

detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
  else
    fail "Docker Compose introuvable (docker compose ou docker-compose)"
  fi
}

preserve_env() {
  if [ -f "$TARGET_DIR/.env" ]; then
    cp "$TARGET_DIR/.env" /tmp/sushi.env.bak
    log ".env sauvegardé → /tmp/sushi.env.bak"
  fi
}

restore_env() {
  if [ -f /tmp/sushi.env.bak ]; then
    mv /tmp/sushi.env.bak "$TARGET_DIR/.env"
    log ".env restauré"
  elif [ -f "$TARGET_DIR/.env.example" ] && [ ! -f "$TARGET_DIR/.env" ]; then
    cp "$TARGET_DIR/.env.example" "$TARGET_DIR/.env"
    log ".env créé depuis .env.example"
  fi
}

sync_repo() {
  if [ "$FORCE_CLEAN" = "1" ] && [ -d "$TARGET_DIR" ]; then
    log "FORCE_CLEAN=1 → suppression de $TARGET_DIR"
    preserve_env
    rm -rf "$TARGET_DIR"
  fi

  if [ -d "$TARGET_DIR/.git" ]; then
    log "Mise à jour existante dans $TARGET_DIR"
    cd "$TARGET_DIR"
    git fetch origin "$BRANCH_NAME"
    git checkout "$BRANCH_NAME"
    git pull --ff-only origin "$BRANCH_NAME"
  else
    if [ -d "$TARGET_DIR" ]; then
      preserve_env
      rm -rf "$TARGET_DIR"
    fi
    log "Clonage $REPO_URL (branche: $BRANCH_NAME)"
    git clone --branch "$BRANCH_NAME" --single-branch "$REPO_URL" "$TARGET_DIR"
    cd "$TARGET_DIR"
  fi

  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  log "Branche: $CURRENT_BRANCH @ $(git rev-parse --short HEAD)"
  if [ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]; then
    fail "branche attendue '$BRANCH_NAME', obtenue '$CURRENT_BRANCH'"
  fi

  restore_env
}

deploy_stack() {
  cd "$TARGET_DIR"
  log "Build + démarrage ($COMPOSE_CMD up -d --build)"
  $COMPOSE_CMD up -d --build

  log "Attente healthcheck…"
  local i
  for i in $(seq 1 30); do
    if $COMPOSE_CMD ps --format json 2>/dev/null | grep -q '"Health":"healthy"'; then
      log "Conteneur healthy"
      break
    fi
    # Fallback si le format json n'est pas dispo
    if curl -fsS "http://127.0.0.1:${PORT:-8000}/health" >/dev/null 2>&1; then
      log "Endpoint /health OK"
      break
    fi
    if [ "$i" -eq 30 ]; then
      log "Timeout health — statut compose :"
      $COMPOSE_CMD ps || true
      fail "le service ne répond pas à /health"
    fi
    sleep 2
  done

  log "Statut :"
  $COMPOSE_CMD ps
  log "Déploiement terminé. App : http://$(hostname -I 2>/dev/null | awk '{print $1}'):${PORT:-8000}/"
}

# --- main ---
need_cmd git
need_cmd docker
detect_compose

# Charge PORT depuis .env s'il existe déjà
if [ -f "$TARGET_DIR/.env" ]; then
  # shellcheck disable=SC1090
  set -a
  # Ne source que les KEY=VALUE simples
  # shellcheck disable=SC1091
  . "$TARGET_DIR/.env"
  set +a
fi
PORT="${PORT:-8000}"

sync_repo
deploy_stack

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/deploy/docker-compose.local.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/deploy/.env}"
MAX_RECOVERY_SECONDS="${MAX_RECOVERY_SECONDS:-180}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/docs/uat-evidence}"

mkdir -p "$OUT_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT_MD="$OUT_DIR/failure-drill-$TS.md"

iso_now() {
  date +"%Y-%m-%dT%H:%M:%S%z"
}

wait_health() {
  local label="$1"
  local start
  start="$(date +%s)"
  while true; do
    local code
    code="$(curl -sS -m 5 -o /dev/null -w "%{http_code}" "$BASE_URL/health" || true)"
    if [[ "$code" == "200" ]]; then
      local end elapsed
      end="$(date +%s)"
      elapsed="$((end - start))"
      echo "$elapsed"
      return 0
    fi
    local now
    now="$(date +%s)"
    if (( now - start >= MAX_RECOVERY_SECONDS )); then
      echo "timeout waiting health after $label" >&2
      return 1
    fi
    sleep 2
  done
}

{
  echo "# Live Failure Drill"
  echo "- timestamp: $(iso_now)"
  echo "- base_url: $BASE_URL"
  echo "- compose_file: $COMPOSE_FILE"
  echo "- env_file: $ENV_FILE"
  echo "- max_recovery_seconds: $MAX_RECOVERY_SECONDS"
  echo
} > "$OUT_MD"

if ! command -v curl >/dev/null 2>&1; then
  {
    echo "## UAT-R-PREFLIGHT"
    echo "- status: FAIL"
    echo "- detail: missing command curl"
    echo
  } >> "$OUT_MD"
  echo "missing command: curl" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  {
    echo "## UAT-R-PREFLIGHT"
    echo "- status: FAIL"
    echo "- detail: missing command docker"
    echo
  } >> "$OUT_MD"
  echo "missing command: docker" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  {
    echo "## UAT-R-PREFLIGHT"
    echo "- status: FAIL"
    echo "- detail: compose file not found ($COMPOSE_FILE)"
    echo
  } >> "$OUT_MD"
  echo "compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  {
    echo "## UAT-R-PREFLIGHT"
    echo "- status: FAIL"
    echo "- detail: env file not found ($ENV_FILE)"
    echo
  } >> "$OUT_MD"
  echo "env file not found: $ENV_FILE" >&2
  exit 1
fi

baseline_code="$(curl -sS -m 5 -o /dev/null -w "%{http_code}" "$BASE_URL/health" || true)"
if [[ "$baseline_code" != "200" ]]; then
  {
    echo "## UAT-R-BASELINE"
    echo "- status: FAIL"
    echo "- detail: baseline health returned $baseline_code"
    echo
  } >> "$OUT_MD"
  echo "failure drill aborted: baseline health is not 200"
  echo "evidence: $OUT_MD"
  exit 1
fi

{
  echo "## UAT-R-BASELINE"
  echo "- status: PASS"
  echo "- detail: baseline health returned 200"
  echo
} >> "$OUT_MD"

restart_and_measure() {
  local service="$1"
  local case_id="$2"
  if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" restart "$service" >/tmp/uat-restart-"$service".log 2>&1; then
    {
      echo "## $case_id"
      echo "- status: FAIL"
      echo "- detail: restart $service failed"
      echo
    } >> "$OUT_MD"
    return 1
  fi

  local elapsed
  if ! elapsed="$(wait_health "$service")"; then
    {
      echo "## $case_id"
      echo "- status: FAIL"
      echo "- detail: health did not recover within ${MAX_RECOVERY_SECONDS}s after restarting $service"
      echo
    } >> "$OUT_MD"
    return 1
  fi

  {
    echo "## $case_id"
    echo "- status: PASS"
    echo "- detail: health recovered ${elapsed}s after restarting $service"
    echo
  } >> "$OUT_MD"
  return 0
}

ok=true
restart_and_measure "redis" "UAT-R-REDIS-RESTART" || ok=false
restart_and_measure "postgres" "UAT-R-POSTGRES-RESTART" || ok=false

if [[ -n "${DRILL_API_KEY:-}" ]]; then
  model_code="$(curl -sS -m 20 -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $DRILL_API_KEY" "$BASE_URL/v1/models" || true)"
  {
    echo "## UAT-R-UPSTREAM-SMOKE"
    if [[ "$model_code" == "200" || "$model_code" == "402" || "$model_code" == "403" ]]; then
      echo "- status: PASS"
      echo "- detail: /v1/models returned $model_code after drills"
    else
      echo "- status: WARN"
      echo "- detail: /v1/models returned $model_code after drills"
    fi
    echo
  } >> "$OUT_MD"
fi

if [[ "$ok" == "true" ]]; then
  echo "failure drill completed"
  echo "evidence: $OUT_MD"
  exit 0
fi

echo "failure drill failed"
echo "evidence: $OUT_MD"
exit 1

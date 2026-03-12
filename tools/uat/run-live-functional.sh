#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
UAT_USER_EMAIL="${UAT_USER_EMAIL:-uat-$(date +%Y%m%d%H%M%S)@test.local}"
UAT_USER_PASSWORD="${UAT_USER_PASSWORD:-UatUser@123456}"
UAT_USER_NAME="${UAT_USER_NAME:-uat-user}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/docs/uat-evidence}"

mkdir -p "$OUT_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT_MD="$OUT_DIR/functional-$TS.md"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

iso_now() {
  date +"%Y-%m-%dT%H:%M:%S%z"
}

log_step() {
  local case_id="$1"
  local status="$2"
  local detail="$3"
  {
    echo "## $case_id"
    echo "- status: $status"
    echo "- detail: $detail"
    echo
  } >> "$OUT_MD"
}

call_api() {
  local method="$1"
  local path="$2"
  local token="${3:-}"
  local body_file="${4:-}"
  local body_out="$TMP_DIR/body.out"
  local code
  local args=(-sS -m 30 -o "$body_out" -w "%{http_code}" -X "$method" "$BASE_URL$path")
  if [[ -n "$body_file" ]]; then
    args+=(-H "Content-Type: application/json" --data @"$body_file")
  fi
  if [[ -n "$token" ]]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  code="$(curl "${args[@]}" || true)"
  echo "$code"
  cat "$body_out"
}

extract_access_token() {
  local json_file="$1"
  node -e '
const fs = require("fs");
const p = process.argv[1];
try {
  const obj = JSON.parse(fs.readFileSync(p, "utf8"));
  const token = obj.access_token || (obj.data && obj.data.access_token) || "";
  process.stdout.write(token);
} catch {
  process.stdout.write("");
}
' "$json_file"
}

extract_api_key() {
  local json_file="$1"
  node -e '
const fs = require("fs");
const p = process.argv[1];
try {
  const obj = JSON.parse(fs.readFileSync(p, "utf8"));
  const key = obj.key || (obj.data && obj.data.key) || "";
  process.stdout.write(key);
} catch {
  process.stdout.write("");
}
' "$json_file"
}

{
  echo "# Live Functional Walkthrough"
  echo "- timestamp: $(iso_now)"
  echo "- base_url: $BASE_URL"
  echo
} > "$OUT_MD"

# UAT-F-HEALTH
health_code="$(curl -sS -m 10 -o "$TMP_DIR/health.out" -w "%{http_code}" "$BASE_URL/health" || true)"
if [[ "$health_code" == "200" ]]; then
  log_step "UAT-F-HEALTH" "PASS" "GET /health returned 200"
else
  log_step "UAT-F-HEALTH" "FAIL" "GET /health returned $health_code"
  echo "functional walkthrough failed: health check failed (code=$health_code)"
  echo "evidence: $OUT_MD"
  exit 1
fi

# UAT-F-REGISTER
register_body="$TMP_DIR/register.json"
cat > "$register_body" <<EOF
{"email":"$UAT_USER_EMAIL","password":"$UAT_USER_PASSWORD","username":"$UAT_USER_NAME"}
EOF
register_resp="$TMP_DIR/register.out"
call_api "POST" "/api/v1/auth/register" "" "$register_body" > "$register_resp"
register_code="$(sed -n '1p' "$register_resp")"
if [[ "$register_code" == "200" || "$register_code" == "400" || "$register_code" == "403" ]]; then
  log_step "UAT-F-REGISTER" "PASS" "POST /api/v1/auth/register returned $register_code"
else
  log_step "UAT-F-REGISTER" "WARN" "POST /api/v1/auth/register returned $register_code"
fi

# UAT-F-LOGIN
login_body="$TMP_DIR/login.json"
cat > "$login_body" <<EOF
{"email":"$UAT_USER_EMAIL","password":"$UAT_USER_PASSWORD"}
EOF
login_resp="$TMP_DIR/login.out"
call_api "POST" "/api/v1/auth/login" "" "$login_body" > "$login_resp"
login_code="$(head -n1 "$login_resp")"
tail -n +2 "$login_resp" > "$TMP_DIR/login.json.out"
access_token="$(extract_access_token "$TMP_DIR/login.json.out")"
if [[ "$login_code" != "200" || -z "$access_token" ]]; then
  log_step "UAT-F-LOGIN" "FAIL" "POST /api/v1/auth/login returned $login_code (token missing)"
  echo "functional walkthrough failed: login failed"
  echo "evidence: $OUT_MD"
  exit 1
fi
log_step "UAT-F-LOGIN" "PASS" "POST /api/v1/auth/login returned 200 (token length=${#access_token})"

# UAT-F-ME
me_resp="$TMP_DIR/me.out"
call_api "GET" "/api/v1/auth/me" "$access_token" > "$me_resp"
me_code="$(head -n1 "$me_resp")"
if [[ "$me_code" != "200" ]]; then
  log_step "UAT-F-ME" "FAIL" "GET /api/v1/auth/me returned $me_code"
  echo "functional walkthrough failed: /api/v1/auth/me failed"
  echo "evidence: $OUT_MD"
  exit 1
fi
log_step "UAT-F-ME" "PASS" "GET /api/v1/auth/me returned 200"

# UAT-F-CREATE-KEY
key_body="$TMP_DIR/key.json"
cat > "$key_body" <<EOF
{"name":"uat-key-$(date +%s)"}
EOF
key_resp="$TMP_DIR/key.out"
call_api "POST" "/api/v1/keys" "$access_token" "$key_body" > "$key_resp"
key_code="$(head -n1 "$key_resp")"
tail -n +2 "$key_resp" > "$TMP_DIR/key.json.out"
api_key="$(extract_api_key "$TMP_DIR/key.json.out")"
if [[ "$key_code" != "200" || -z "$api_key" ]]; then
  log_step "UAT-F-CREATE-KEY" "FAIL" "POST /api/v1/keys returned $key_code (key missing)"
  echo "functional walkthrough failed: api key creation failed"
  echo "evidence: $OUT_MD"
  exit 1
fi
log_step "UAT-F-CREATE-KEY" "PASS" "POST /api/v1/keys returned 200 (key length=${#api_key})"

# UAT-F-MODELS
models_resp="$TMP_DIR/models.out"
call_api "GET" "/v1/models" "$api_key" "" > "$models_resp"
models_code="$(sed -n '1p' "$models_resp")"
if [[ "$models_code" == "200" || "$models_code" == "402" || "$models_code" == "403" ]]; then
  log_step "UAT-F-MODELS" "PASS" "GET /v1/models returned $models_code"
else
  log_step "UAT-F-MODELS" "WARN" "GET /v1/models returned $models_code"
fi

# UAT-F-USAGE
usage_resp="$TMP_DIR/usage.out"
call_api "GET" "/api/v1/usage/dashboard/stats" "$access_token" "" > "$usage_resp"
usage_code="$(sed -n '1p' "$usage_resp")"
if [[ "$usage_code" == "200" ]]; then
  log_step "UAT-F-USAGE" "PASS" "GET /api/v1/usage/dashboard/stats returned 200"
else
  log_step "UAT-F-USAGE" "WARN" "GET /api/v1/usage/dashboard/stats returned $usage_code"
fi

echo "functional walkthrough completed"
echo "evidence: $OUT_MD"

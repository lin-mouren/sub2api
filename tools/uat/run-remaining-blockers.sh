#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FUNCTIONAL_SCRIPT="$ROOT_DIR/tools/uat/run-live-functional.sh"
FAILURE_SCRIPT="$ROOT_DIR/tools/uat/run-live-failure-drill.sh"

if [[ ! -x "$FUNCTIONAL_SCRIPT" || ! -x "$FAILURE_SCRIPT" ]]; then
  echo "expected executable scripts are missing:"
  echo "  - $FUNCTIONAL_SCRIPT"
  echo "  - $FAILURE_SCRIPT"
  exit 1
fi

echo "[1/2] running live functional walkthrough..."
if "$FUNCTIONAL_SCRIPT"; then
  echo "[1/2] functional walkthrough: PASS"
else
  echo "[1/2] functional walkthrough: FAIL"
  exit 1
fi

echo "[2/2] running live failure drill..."
if "$FAILURE_SCRIPT"; then
  echo "[2/2] failure drill: PASS"
else
  echo "[2/2] failure drill: FAIL"
  exit 1
fi

echo "all remaining blockers executed successfully"

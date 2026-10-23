#!/bin/sh
# Run every end-to-end suite against a running API.
#
# A suite passes only if it exits 0 AND prints an "N/N passed" line whose two numbers match.
# Anything else — a crash, a missing module, a suite that dies before its summary — is a
# failure. Silence must never read as success, because a suite that printed nothing has told
# you nothing.
#
#   ./run-all.sh                 every suite
#   ./run-all.sh visitor         only suites whose filename contains "visitor"
#
# Point it elsewhere with QA_API_URL / QA_WEB_URL. Browser suites (*-ui.js) also need a web
# app running and Chrome installed; skip them with QA_SKIP_UI=1.
cd "$(dirname "$0")" || exit 1

filter="$1"
pass=0
fail=0
failed=""

for suite in suites/*.js; do
  [ -e "$suite" ] || continue
  name=$(basename "$suite")

  case "$name" in
    *-ui.js) [ "$QA_SKIP_UI" = "1" ] && { printf 'skip    %-26s browser suite (QA_SKIP_UI=1)\n' "$name"; continue; };;
  esac

  if [ -n "$filter" ]; then
    case "$name" in *"$filter"*) ;; *) continue;; esac
  fi

  output=$(node "$suite" 2>&1)
  code=$?
  summary=$(printf '%s' "$output" | grep -E "^[0-9]+/[0-9]+ passed" | tail -1)
  got=${summary%%/*}
  want=$(printf '%s' "$summary" | sed -n 's|^[0-9]*/\([0-9]*\) passed.*|\1|p')

  if [ "$code" -eq 0 ] && [ -n "$summary" ] && [ "$got" = "$want" ]; then
    pass=$((pass + 1))
    printf 'ok      %-26s %s\n' "$name" "$summary"
  else
    fail=$((fail + 1))
    failed="$failed $name"
    printf 'FAILED  %-26s %s\n' "$name" "${summary:-no summary printed (exit $code)}"
    printf '%s\n' "$output" | grep -E "^FAIL|Error:|error:" | head -5 | sed 's/^/          /'
  fi
done

echo ""
echo "suites: $pass ok, $fail failed"
[ -n "$failed" ] && echo "failing:$failed"
[ "$fail" -gt 0 ] && exit 1
exit 0

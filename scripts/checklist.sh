#!/usr/bin/env bash
set -euo pipefail

API="${API_ORIGIN:-http://127.0.0.1:5000}"
KEY="${AXIA_API_KEY:-ak_3d7c2e9e32282cd5905f7c8ed47b53ea}"
ADMIN="${ADMIN_PASSWORD:-AxiaTempAdmin123!}"
ROOT="${ROOT_PUBKEY:-0xDEADBEEF000000000000000000000000000000000000000000000000000000}"

node -e 'console.log("== Totem + Axia — Automated Checks ==")'

if [ -z "$KEY" ]; then
  echo "!! Set AXIA_API_KEY in environment (Replit Secrets)."; exit 1;
fi
if [ -z "$ADMIN" ]; then
  echo "!! Set ADMIN_PASSWORD in environment (Replit Secrets)."; exit 1;
fi

echo "-- Preflight: /sandbox"
curl -sS "$API/sandbox" >/dev/null && echo "OK /sandbox served" || { echo "!! /sandbox not served"; exit 1; }

echo "-- Watermark"
curl -sS -H "x-api-key: $KEY" "$API/v1/wots-hardened/watermark?root=$ROOT" | node scripts/jprint.mjs

echo "-- Prepare (lease + JWT)"
PREP=$(curl -sS -X POST "$API/v1/wots-hardened/prepare" \
  -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d "{\"txId\":\"preview\",\"rootPublicKey\":\"$ROOT\",\"to\":\"$ROOT\",\"amount\":\"0.0001\"}" )
echo "$PREP" | node scripts/jprint.mjs
LTK=$(node -e "const j=JSON.parse(process.argv[1]); console.log(j.leaseToken||'');" "$PREP")
if [ -z "$LTK" ]; then echo "!! No leaseToken"; exit 1; fi

echo "-- Finalize with bogus HEX (should 502 and NOT consume lease)"
RES=$(curl -sS -w "\n%{http_code}\n" -X POST "$API/v1/wots-hardened/finalize" \
  -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d "{\"txId\":\"preview\",\"leaseToken\":\"$LTK\",\"signedHex\":\"0xdeadbeef\"}" )
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | head -n -1)
echo "$BODY" | node scripts/jprint.mjs; echo "HTTP $CODE"
if [ "$CODE" -eq 200 ]; then echo "!! Unexpected success with bogus HEX"; exit 1; fi

echo "-- Rate limit probe (expect some 429s if rps_limit is low)"
HITS="${RPS_HITS:-8}"
for i in $(seq 1 $HITS); do
  curl -s -o /dev/null -w "%{http_code} " -H "x-api-key: $KEY" "$API/v1/wots-hardened/watermark?root=$ROOT" || true
done
echo

echo "-- Serializer goldens"
cd packages/totem-extension && npx vitest run test/serializer.golden.test.ts || { echo "!! Serializer tests failed"; exit 1; }

echo "== Automated checks complete =="
echo "Next: open $API/sandbox in a real browser with the extension loaded and follow docs/EXTENSION_TEST_CHECKLIST.md"
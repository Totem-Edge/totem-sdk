#!/usr/bin/env bash
set -euo pipefail

API="${API_ORIGIN:-http://127.0.0.1:5000}"
KEY="${API_KEY:-ak_4891c048f63fc878bf8a524423c6d261}"

echo "== Axia /prepare (build simple tx, get digest + plan) =="
prep=$(curl -sS -X POST "$API/v1/wots-hardened/prepare" \
  -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"txId":"preview","rootPublicKey":"0xDEADBEEF","to":"0xDEADBEEF","amount":"0.0001"}')

echo "$prep"

token=$(echo "$prep" | grep -o '"leaseToken":"[^"]*"' | cut -d'"' -f4 || echo "")
if [ -z "$token" ]; then echo "No leaseToken; check server logs"; exit 1; fi

echo "== NOTE =="
echo "This script does NOT produce real signatures; extension does."
echo "Open the extension, approve a test send so it hits /finalize with HEX."
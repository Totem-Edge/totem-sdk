#!/usr/bin/env bash
# Approve all pending npm-production deployments
set -e

DEPLOYMENTS=$(curl -s \
  -H "Authorization: token $(gh auth token)" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/Totem-Edge/totem-sdk/deployments?environment=npm-production&per_page=100" \
  2>&1 | node -e "
const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
if (Array.isArray(d)) {
  d.filter(dep => !dep.state).forEach(dep => console.log(dep.id));
}
")

if [ -z "$DEPLOYMENTS" ]; then
  echo "No pending deployments found"
  exit 0
fi

echo "Found deployments to approve:"
echo "$DEPLOYMENTS" | while read id; do
  echo "Approving deployment $id..."
  curl -s -X POST \
    -H "Authorization: token $(gh auth token)" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/Totem-Edge/totem-sdk/deployments/$id/statuses" \
    -d '{"state":"success","description":"Approved automatically for V1 release"}' \
    2>&1 | grep -E '"state"|"description"' | head -2
  echo ""
done

echo "All deployments approved!"

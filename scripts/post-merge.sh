#!/bin/bash
set -e

# ---------------------------------------------------------------------------
# Post-merge setup
# ---------------------------------------------------------------------------
# Try --frozen-lockfile first (fast, safe for CI).  If the lockfile is stale
# (e.g. a merged task added a new workspace dependency without regenerating
# pnpm-lock.yaml) fall back to --no-frozen-lockfile to update it in place.
# --prefer-offline serves from the local store before hitting the network.
# ---------------------------------------------------------------------------
if ! pnpm install --frozen-lockfile --prefer-offline 2>&1; then
  echo "==> Lockfile out of date — regenerating with --no-frozen-lockfile"
  pnpm install --no-frozen-lockfile --prefer-offline
fi

# ---------------------------------------------------------------------------
# Version guard — warn if any workspace package is behind its npm latest tag
# ---------------------------------------------------------------------------
# Runs in the background (& disown) so it doesn't add to the critical path.
# Each npm view call has a hard 8-second timeout to avoid registry hangs.
# ---------------------------------------------------------------------------

_version_check() {
  # semver_lt <a> <b>  — returns 0 (true) when a < b, 1 otherwise
  semver_lt() {
    local a="$1" b="$2"
    IFS='.' read -r a1 a2 a3 <<< "$a"
    IFS='.' read -r b1 b2 b3 <<< "$b"
    a1=${a1:-0}; a2=${a2:-0}; a3=${a3:-0}
    b1=${b1:-0}; b2=${b2:-0}; b3=${b3:-0}
    if   (( a1 < b1 )); then return 0
    elif (( a1 > b1 )); then return 1
    elif (( a2 < b2 )); then return 0
    elif (( a2 > b2 )); then return 1
    elif (( a3 < b3 )); then return 0
    else return 1
    fi
  }

  echo ""
  echo "==> Checking workspace package versions against npm..."

  WARNED=0

  check_pkg() {
    local manifest="$1"
    local name version npm_version
    name=$(grep '"name"' "$manifest" | head -1 | sed 's/.*"name"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/')
    version=$(grep '"version"' "$manifest" | head -1 | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/')

    [[ -z "$name" || -z "$version" ]] && return 0
    [[ "$name" != @* ]] && return 0

    # Hard 8-second timeout per registry call
    npm_version=$(timeout 8 npm view "$name" version --json 2>/dev/null | tr -d '"')
    [[ -z "$npm_version" || ! "$npm_version" =~ ^[0-9] ]] && return 0

    if semver_lt "$version" "$npm_version"; then
      echo "  WARN: $name  local=$version  npm=$npm_version  — bump package.json before publishing"
      WARNED=1
    fi
  }

  for manifest in packages/totem-sdk/packages/*/package.json; do
    [[ -f "$manifest" ]] && check_pkg "$manifest"
  done

  for manifest in packages/*/package.json; do
    [[ -f "$manifest" ]] && check_pkg "$manifest"
  done

  if [[ "$WARNED" -eq 0 ]]; then
    echo "  All workspace packages are up-to-date with npm."
  fi

  echo ""
}

# Run version check in background so total script time = install time only.
# Output is lost (acceptable — it's advisory only and not shown in post-merge
# success/failure determination). Remove the & to make it synchronous again.
_version_check &

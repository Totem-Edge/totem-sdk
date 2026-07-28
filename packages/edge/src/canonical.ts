/**
 * Plain hex encoder (no 0x prefix) for use in ID URIs and deterministic identifiers.
 * bytesToHex from @totemsdk/core adds a 0x prefix — use this for URI-safe hex IDs.
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Local canonical JSON helper for @totemsdk/edge.
 *
 * Identical in behaviour to the one in @totemsdk/identity, but kept local
 * so both packages remain independently deployable. If a shared helper is
 * extracted to a low-level package in a future task it can replace both copies.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

// packages/totem-extension/src/telemetry_token.ts
// Browser-safe: fetches a short-lived JWT from the Axia gateway and caches it in-memory.
const TOKEN_URL = (globalThis as any).__AXIA_TOKEN_URL__ || 'https://api.axia.to/v1/tlm/token';
const TTL_SAFE_MS = 30 * 1000; // refresh 30s before expiry

type TokenState = { token: string; exp: number };
let STATE: TokenState | null = null;

export async function getTelemetryToken(projectId: string): Promise<string> {
  const now = Date.now();
  if (STATE && now < STATE.exp - TTL_SAFE_MS) return STATE.token;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId })
  });
  if (!res.ok) throw new Error('token fetch failed');
  const { token, expires_in } = await res.json();
  STATE = { token, exp: now + (expires_in * 1000) };
  return token;
}

// Example integration with telemetry flush():
// const jwt = await getTelemetryToken(projectId);
// await fetch('https://telemetry.axia.to/v1/telemetry', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
//   body: JSON.stringify({ events: batch })
// });
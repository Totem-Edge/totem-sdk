/**
 * Local Hawk node auto-detection (RFC-062).
 *
 * The pairing daemon is loopback-only. Detection is intentionally limited to
 * its default endpoint; custom ports remain a manual pairing flow.
 */

export const HAWK_INVITATION_KEY = 'hawk_pairing_invitation';

export interface HawkInvitation {
  endpoint: string;
  code: string;
  nodeId: string;
  fingerprint: string;
  network: string;
  scopes: string[];
  capabilities?: Record<string, unknown>;
  expiresAt: number;
}

const DEFAULT_CANDIDATES = [
  'http://127.0.0.1:7789',
  'http://localhost:7789',
];

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function isInvitation(value: unknown): value is HawkInvitation {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.endpoint === 'string'
    && typeof v.code === 'string'
    && typeof v.nodeId === 'string'
    && typeof v.fingerprint === 'string'
    && typeof v.network === 'string'
    && Array.isArray(v.scopes);
}

/** Probe the default local pairing endpoints and ask for a fresh invitation. */
export async function detectHawkPairing(
  candidates: string[] = DEFAULT_CANDIDATES,
): Promise<HawkInvitation> {
  let lastError: unknown;
  for (const rawBase of candidates) {
    const base = rawBase.replace(/\/$/, '');
    const health = withTimeout(900);
    try {
      const response = await fetch(`${base}/healthz`, {
        method: 'GET',
        cache: 'no-store',
        signal: health.signal,
      });
      if (!response.ok) continue;
      const body = await response.json().catch(() => null);
      if (!body || body.ok !== true) continue;
    } catch (error) {
      lastError = error;
      continue;
    } finally {
      health.clear();
    }

    const invite = withTimeout(1500);
    try {
      const response = await fetch(`${base}/pair/v1/detect`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: '{}',
        signal: invite.signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        lastError = new Error(body?.error || `Hawk returned ${response.status}`);
        continue;
      }
      if (!isInvitation(body)) {
        lastError = new Error('Hawk returned an invalid pairing invitation');
        continue;
      }
      return { ...body, endpoint: base };
    } catch (error) {
      lastError = error;
    } finally {
      invite.clear();
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('No local Hawk pairing service found');
}

export async function storeHawkInvitation(invitation: HawkInvitation): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome?.storage?.local) return;
  await chrome.storage.local.set({ [HAWK_INVITATION_KEY]: invitation });
}

export async function takeHawkInvitation(): Promise<HawkInvitation | null> {
  if (typeof chrome === 'undefined' || !chrome?.storage?.local) return null;
  const stored = await chrome.storage.local.get(HAWK_INVITATION_KEY);
  const value = stored?.[HAWK_INVITATION_KEY];
  if (value) await chrome.storage.local.remove(HAWK_INVITATION_KEY);
  return isInvitation(value) ? value : null;
}

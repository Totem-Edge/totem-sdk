/**
 * API + bootstrap-schema version for diagnostics.
 *
 * Two different versions are easy to confuse:
 *  - API version       — the Axia service build (`/info` → buildInfo.ts)
 *  - config schema     — the /totem.json contract consumed by bootstrap.ts
 *
 * This helper resolves both and formats them as:
 *   `API 1.1.2 · config schema 1.0.0`
 */

export interface ServiceVersionInfo {
  /** Axia API service version, e.g. "1.1.2". */
  api: string;
  /** Bootstrap config schema version, e.g. "1.0.0". */
  schema: string;
  /** API base URL the versions were read from. */
  base: string;
}

const DEFAULT_BASE = 'https://api.axia.to';
const UNKNOWN = 'unknown';

async function resolveBase(): Promise<string> {
  try {
    const stored = (await chrome.storage.local.get('AXIA_BASE')) as { AXIA_BASE?: string };
    return (stored.AXIA_BASE || DEFAULT_BASE).replace(/\/$/, '');
  } catch {
    return DEFAULT_BASE;
  }
}

async function readApiVersion(base: string): Promise<string> {
  try {
    const res = await fetch(`${base}/info`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return UNKNOWN;
    const info = await res.json();
    return typeof info?.version === 'string' && info.version ? info.version : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

async function readSchemaVersion(base: string): Promise<string> {
  // Preferred: the schema version persisted with the last bootstrap config.
  try {
    const stored = (await chrome.storage.local.get('totem_config')) as {
      totem_config?: { config?: { version?: string } };
    };
    const version = stored?.totem_config?.config?.version;
    if (typeof version === 'string' && version) return version;
  } catch {
    /* storage unavailable — fall through to the network */
  }

  // Fallback: read the explicit schema header/body from /totem.json.
  try {
    const res = await fetch(`${base}/totem.json`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return UNKNOWN;
    const header = res.headers.get('x-config-version');
    if (header) return header;
    const body = await res.json();
    return typeof body?.version === 'string' && body.version ? body.version : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

export function formatVersionLine(info: Pick<ServiceVersionInfo, 'api' | 'schema'>): string {
  return `API ${info.api || UNKNOWN} · config schema ${info.schema || UNKNOWN}`;
}

export async function getServiceVersionInfo(): Promise<ServiceVersionInfo> {
  const base = await resolveBase();
  const [api, schema] = await Promise.all([
    readApiVersion(base),
    readSchemaVersion(base),
  ]);
  return { api, schema, base };
}

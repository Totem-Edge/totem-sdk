/**
 * @totemsdk/tx-builder/node-transport
 *
 * Minimal raw command transport for Minima/Hawk nodes.
 *
 * The typed minima-rpc transport rejects whitespace in parameter values as a
 * command-injection guard. `txnscript`/script values legitimately contain
 * spaces, so tx-builder's node assembler needs a transport that preserves them.
 */

export interface RawNodeConfig {
  /** Node RPC URL, e.g. `http://127.0.0.1:9005`. */
  url: string;
  username?: string;
  password?: string;
  timeoutMs?: number;
}

export interface RawNodeCommandClient {
  command(name: string, params?: Record<string, unknown>): Promise<any>;
}

function encodeValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return JSON.stringify(value);
}

function buildCommand(name: string, params?: Record<string, unknown>): string {
  const parts = [name];
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    parts.push(`${key}:${encodeValue(value)}`);
  }
  return parts.join(' ');
}

/** Create a command client that posts the node's text/plain command grammar. */
export function createRawNodeCommandClient(config: RawNodeConfig): RawNodeCommandClient {
  const url = config.url.replace(/\/$/, '');
  const timeoutMs = config.timeoutMs ?? 30_000;
  const auth =
    config.password !== undefined
      ? `Basic ${btoa(`${config.username ?? 'minima'}:${config.password}`)}`
      : undefined;

  return {
    async command(name, params) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            ...(auth ? { Authorization: auth } : {}),
          },
          body: buildCommand(name, params),
          signal: controller.signal,
        });
        const text = await response.text();
        let envelope: any;
        try {
          envelope = JSON.parse(text);
        } catch {
          throw new Error(`${name} returned non-JSON: ${text.slice(0, 200)}`);
        }
        if (envelope?.status === false) {
          throw new Error(`${name} failed: ${envelope.error ?? 'unknown error'}`);
        }
        return envelope?.response ?? envelope;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

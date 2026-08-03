import { createHash } from 'node:crypto';

/**
 * Jest-only pure-JS stand-in for the Rust/WASM `edge_mqtt_wasm` bindings.
 *
 * The real bindings are ESM + `.wasm`, which the CJS jest runtime cannot load.
 * Implementations mirror the documented Rust behavior closely enough for the
 * test suite (canonical JSON, topic wildcards, scaled fixed-point arithmetic,
 * message codec round-trip).
 */

function hexBytes(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

function sha3Hex(input: string): string {
  return createHash('sha3-256').update(input).digest('hex');
}

function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).filter(
      (k) => (value as Record<string, unknown>)[k] !== undefined,
    ).sort();
    return '{' + keys.map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`).join(',') + '}';
  }
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

const SCALE = 100_000_000n;

function toScaledImpl(s: string): string {
  const str = s.trim();
  const dot = str.indexOf('.');
  let intPart = str;
  let fracPart = '';
  if (dot !== -1) {
    intPart = str.slice(0, dot);
    fracPart = str.slice(dot + 1);
  }
  const fracPadded = (fracPart + '00000000').slice(0, 8);
  const int = BigInt(intPart === '' ? '0' : intPart);
  const frac = BigInt(fracPadded === '' ? '0' : fracPadded);
  return (int * SCALE + frac).toString();
}

function fromScaledImpl(s: string): string {
  let n = BigInt(s.trim());
  const neg = n < 0n;
  if (neg) n = -n;
  const whole = n / SCALE;
  const frac = n % SCALE;
  let fracStr = frac.toString().padStart(8, '0').replace(/0+$/, '');
  let out = whole.toString();
  if (fracStr.length > 0) out += '.' + fracStr;
  return neg ? '-' + out : out;
}

export function to_hex(bytes: Uint8Array): string {
  return hexBytes(bytes);
}

export function canonical_json(value: unknown): string {
  return canonicalize(value);
}

export function compute_mqtt_event_id(event: unknown): string {
  return 'mqtt:event:' + sha3Hex(canonicalize(event));
}

export function encode_mqtt_edge_message(
  topic: string,
  payloadStr: string | null,
  payloadBytes: Uint8Array | null,
  receivedAt: number,
  qos: number | null,
  retain: boolean | null,
  properties: Record<string, unknown> | null,
): Uint8Array {
  const rec = {
    topic,
    payload: payloadStr !== null ? { kind: 's', value: payloadStr } : { kind: 'b', value: hexBytes(payloadBytes ?? new Uint8Array(0)) },
    receivedAt,
    qos,
    retain,
    properties,
  };
  return new TextEncoder().encode(JSON.stringify({ m: 'mqtt-edge', rec }));
}

export function decode_mqtt_edge_message(bytes: Uint8Array): any {
  let parsed: any;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('invalid JSON in mqtt edge message');
  }
  const rec = parsed?.rec;
  if (!rec || typeof rec.topic !== 'string') {
    throw new Error('missing topic in mqtt edge message');
  }
  const payload =
    rec.payload?.kind === 'b'
      ? new Uint8Array((rec.payload.value.match(/.{2}/g) ?? []).map((h: string) => parseInt(h, 16)))
      : rec.payload?.value ?? '';
  return {
    topic: rec.topic,
    payload,
    receivedAt: rec.receivedAt,
    qos: rec.qos,
    retain: rec.retain,
    properties: rec.properties,
  };
}

export function create_default_mqtt_topics(deviceId: string): Record<string, string> {
  const names = ['status', 'manifest', 'proofs', 'receipts', 'payments', 'commands', 'errors'];
  const out: Record<string, string> = {};
  for (const n of names) out[n] = `totem/${deviceId}/${n}`;
  return out;
}

export function create_sensor_topic(deviceId: string, sensorId: string, kind: string): string {
  return `sensors/${deviceId}/${sensorId}/${kind}`;
}

export function match_mqtt_topic(pattern: string, topic: string): { matched: boolean; params?: Record<string, string> } {
  const pp = pattern.split('/');
  const tp = topic.split('/');

  if (pattern.includes('#')) {
    const hashIndex = pp.indexOf('#');
    const prefix = pp.slice(0, hashIndex);
    if (tp.length < prefix.length || prefix.some((p, i) => p !== '+' && p !== tp[i])) {
      return { matched: false };
    }
    const suffix = tp.slice(prefix.length).join('/');
    return { matched: true, params: { '#': suffix } };
  }

  if (pp.length !== tp.length) return { matched: false };
  for (let i = 0; i < pp.length; i++) {
    if (pp[i] !== '+' && pp[i] !== tp[i]) return { matched: false };
  }
  return { matched: true };
}

export function to_scaled(s: string): string {
  return toScaledImpl(s);
}

export function from_scaled(s: string): string {
  return fromScaledImpl(s);
}

export function add_decimal(a: string, b: string): string {
  return fromScaledImpl((BigInt(toScaledImpl(a)) + BigInt(toScaledImpl(b))).toString());
}

export function compare_decimal(a: string, b: string): number {
  const x = BigInt(toScaledImpl(a));
  const y = BigInt(toScaledImpl(b));
  return x < y ? -1 : x > y ? 1 : 0;
}

export function is_over_limit(current: string, limit: string): boolean {
  return BigInt(toScaledImpl(current)) > BigInt(toScaledImpl(limit));
}

export function init(): void {}

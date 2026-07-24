import { sha3_256 } from '@totemsdk/core'

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']'
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
  return '{' + pairs.join(',') + '}'
}

export function hashCanonical(domain: string, value: unknown): string {
  const input = domain + canonicalJson(value)
  return toHex(sha3_256(new TextEncoder().encode(input)))
}

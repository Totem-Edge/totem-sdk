/**
 * Canonical, domain-separated digests for entity views (RFC-056 §4.5).
 */
import { hashCanonical } from '@totemsdk/core';
import type { EntityView } from './types.js';

export const ENTITY_DIGEST_DOMAINS = {
  ref: 'entity:ref:v1',
  view: 'entity:view:v1',
} as const;

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) out[key] = stripUndefined(entry);
    }
    return out;
  }
  return value;
}

function digest(domain: string, value: unknown): string {
  return '0x' + hashCanonical(domain, stripUndefined(value));
}

/** Opaque, stable reference to a root address. */
export function computeEntityRef(rootAddress: string): string {
  return digest(ENTITY_DIGEST_DOMAINS.ref, rootAddress);
}

/** Canonical digest of an entity view, excluding `digest` itself. */
export function computeEntityViewDigest(view: EntityView | Omit<EntityView, 'digest'>): string {
  const body: Record<string, unknown> = { ...(view as EntityView) };
  delete body.digest;
  return digest(ENTITY_DIGEST_DOMAINS.view, body);
}

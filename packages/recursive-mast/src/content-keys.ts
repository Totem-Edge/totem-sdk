/**
 * Content-addressed key scheme for recursive MAST policy storage.
 *
 * Every object is addressed by its cryptographic hash, enabling
 * storage-agnostic retrieval across Hypercore, HTTP, filesystem,
 * or any other content-addressed backend.
 *
 * Key formats:
 *   policy:<policyId>:manifest:<version>
 *   script:<scriptHash>
 *   proof:<policyRoot>:<scriptHash>
 *   bundle:<bundleHash>
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';

export const KEY_PREFIX = {
  POLICY_MANIFEST: 'policy',
  MANIFEST_DIGEST: 'manifest',
  SCRIPT: 'script',
  PROOF: 'proof',
  BUNDLE: 'bundle',
} as const;

export interface ContentKey {
  prefix: string;
  parts: string[];
  key: string;
}

export function policyManifestKey(policyId: string, version: number): ContentKey {
  const parts = [KEY_PREFIX.POLICY_MANIFEST, policyId, 'manifest', String(version)];
  return { prefix: KEY_PREFIX.POLICY_MANIFEST, parts, key: parts.join(':') };
}

export function manifestDigestKey(digest: string): ContentKey {
  const parts = [KEY_PREFIX.MANIFEST_DIGEST, digest];
  return { prefix: KEY_PREFIX.MANIFEST_DIGEST, parts, key: parts.join(':') };
}

export function scriptKey(scriptHash: string): ContentKey {
  const parts = [KEY_PREFIX.SCRIPT, scriptHash];
  return { prefix: KEY_PREFIX.SCRIPT, parts, key: parts.join(':') };
}

export function proofKey(policyRoot: string, scriptHash: string): ContentKey {
  const parts = [KEY_PREFIX.PROOF, policyRoot, scriptHash];
  return { prefix: KEY_PREFIX.PROOF, parts, key: parts.join(':') };
}

export function bundleKey(bundleHash: string): ContentKey {
  const parts = [KEY_PREFIX.BUNDLE, bundleHash];
  return { prefix: KEY_PREFIX.BUNDLE, parts, key: parts.join(':') };
}

export function parseContentKey(key: string): ContentKey | null {
  const parts = key.split(':');
  if (parts.length < 2) return null;
  const prefix = parts[0];
  if (!Object.values(KEY_PREFIX).includes(prefix as typeof KEY_PREFIX[keyof typeof KEY_PREFIX])) {
    return null;
  }
  return { prefix, parts, key };
}

export function computeManifestDigest(manifestBytes: Uint8Array): string {
  return bytesToHex(sha3_256(manifestBytes));
}

export function computeBundleHash(manifest: Uint8Array, branches: Uint8Array[]): string {
  const parts: Uint8Array[] = [manifest];
  for (const b of branches) parts.push(b);
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    combined.set(p, offset);
    offset += p.length;
  }
  return bytesToHex(sha3_256(combined));
}

export function computeScriptHash(script: string): string {
  return bytesToHex(sha3_256(new TextEncoder().encode(script)));
}

/**
 * computeManifestId — deterministic stable ID for any manifest.
 *
 * The ID is SHA3-256 over a type-specific stable key string.
 * It must be stable across version bumps (version is NOT part of the input).
 *
 * Stable key rules:
 *   AppManifest        → "app"        + authorAddress + pearTopicKey
 *   CapabilityManifest → "capability" + agentAddress  + capabilityName
 *   DAppManifest       → "dapp"       + authorAddress + contractHash
 *   EdgeServiceManifest → "edge-service" + operatorAddress + serviceType + name
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import type { Manifest } from './types.js';

function bytesToHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

export function computeManifestId(manifest: Manifest): string {
  let stableKey: string;

  switch (manifest.type) {
    case 'app':
      stableKey = `app\0${manifest.authorAddress}\0${manifest.pearTopicKey}`;
      break;
    case 'capability':
      stableKey = `capability\0${manifest.agentAddress}\0${manifest.capabilityName}`;
      break;
    case 'dapp':
      stableKey = `dapp\0${manifest.authorAddress}\0${manifest.contractHash}`;
      break;
    case 'edge-service':
      stableKey = `edge-service\0${manifest.operatorAddress}\0${manifest.serviceType}\0${manifest.name}`;
      break;
    default: {
      const _exhaustive: never = manifest;
      throw new Error(`computeManifestId: unknown manifest type: ${JSON.stringify(_exhaustive)}`);
    }
  }

  return bytesToHex(sha3_256(new TextEncoder().encode(stableKey)));
}

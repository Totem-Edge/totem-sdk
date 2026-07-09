/**
 * Edge device factory.
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import { toHex } from './canonical.js';
import type { EdgeDevice, EdgeDeviceKind } from './types.js';

export function createEdgeDevice(opts: {
  kind: EdgeDeviceKind;
  identityId?: string;
  address?: string;
  metadata?: Record<string, unknown>;
}): EdgeDevice {
  const { kind, identityId, address, metadata } = opts;

  const ts = Date.now();
  const nonce = Math.random().toString(36).slice(2, 10);
  const raw = `edge-device\0${kind}\0${identityId ?? ''}\0${address ?? ''}\0${ts}\0${nonce}`;
  const hash = sha3_256(new TextEncoder().encode(raw));
  const deviceId = `edge:device:${toHex(hash)}`;

  return {
    deviceId,
    kind,
    ...(identityId !== undefined ? { identityId } : {}),
    ...(address !== undefined ? { address } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    createdAt: ts,
  };
}

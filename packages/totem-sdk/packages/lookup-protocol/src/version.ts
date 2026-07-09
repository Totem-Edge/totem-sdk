/**
 * Protocol version negotiation
 */

import { PROTOCOL_VERSION } from './messages.js';
import type { VersionMismatchMessage } from './messages.js';

export interface VersionCheckResult {
  compatible: boolean;
  mismatch?: VersionMismatchMessage;
}

/**
 * Check whether a received message's version is compatible with this build.
 * Returns compatible=true if versions match, or a structured VERSION_MISMATCH
 * error message otherwise.
 */
export function checkVersion(incomingVersion: number): VersionCheckResult {
  if (incomingVersion === PROTOCOL_VERSION) {
    return { compatible: true };
  }

  const mismatch: VersionMismatchMessage = {
    type: 'VERSION_MISMATCH',
    version: PROTOCOL_VERSION,
    payload: {
      serverVersion: PROTOCOL_VERSION,
      clientVersion: incomingVersion,
      message: `Protocol version mismatch: server=${PROTOCOL_VERSION}, client=${incomingVersion}`,
    },
  };

  return { compatible: false, mismatch };
}

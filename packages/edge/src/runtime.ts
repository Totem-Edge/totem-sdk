/**
 * Edge runtime factory.
 */

import { EDGE_VERSION } from './constants.js';
import {
  EdgeCapabilitySet,
  EdgeCapability,
  hasCapability,
  assertCapability,
} from './capabilities.js';
import type { EdgeRuntimePorts } from './ports.js';
import type { EdgeRuntime } from './types.js';

export function createEdgeRuntime(opts: {
  deviceId: string;
  capabilities: EdgeCapabilitySet;
  ports: EdgeRuntimePorts;
}): EdgeRuntime {
  const { deviceId, capabilities, ports } = opts;
  return {
    version: EDGE_VERSION,
    deviceId,
    capabilities,
    ports,
    hasCapability(cap: EdgeCapability): boolean {
      return hasCapability(capabilities, cap);
    },
    assertCapability(cap: EdgeCapability): void {
      assertCapability(capabilities, cap);
    },
  };
}

/**
 * Typed errors for @totemsdk/edge.
 */

export class EdgeCapabilityError extends Error {
  readonly code: string;
  readonly capability: string;

  constructor(capability: string, message?: string) {
    super(message ?? `Capability not available: ${capability}`);
    this.name = 'EdgeCapabilityError';
    this.code = 'EDGE_CAPABILITY_MISSING';
    this.capability = capability;
  }
}

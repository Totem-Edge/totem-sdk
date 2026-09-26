import type { SigningIndices } from './types.js';

export class WatermarkMonotonicityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WatermarkMonotonicityError';
  }
}

/**
 * Raised when seeding would move the local watermark cursor backwards. This is
 * the fail-closed guard against restoring a wallet below its true high-water
 * mark and reusing a WOTS leaf (RFC-013 §9).
 */
export class WatermarkSeedRegressionError extends Error {
  constructor(public readonly treeId: string, public readonly currentCursor: number, public readonly seedCursor: number) {
    super(
      `Refusing to seed watermark for ${treeId} below the current cursor ` +
        `(${seedCursor} < ${currentCursor}); this would re-expose used WOTS leaves.`,
    );
    this.name = 'WatermarkSeedRegressionError';
  }
}

/**
 * Raised when a restore/import has no usable watermark source and the caller has
 * not declared the keyspace fresh. Failing closed is required: starting at 0
 * would reissue spent leaves (RFC-013 §9).
 */
export class WatermarkSeedRequiredError extends Error {
  constructor(public readonly treeId: string) {
    super(
      `No watermark source available for ${treeId}. Provide an on-chain cursor, an ` +
        'exported watermark, or an operator high-water mark — or declare the keyspace fresh. ' +
        'Refusing to start at 0.',
    );
    this.name = 'WatermarkSeedRequiredError';
  }
}


export class WatermarkExhaustedError extends Error {
  constructor(public readonly treeId: string) {
    super(`WOTS keyspace exhausted for tree: ${treeId}`);
    this.name = 'WatermarkExhaustedError';
  }
}

export class LeaseNotFoundError extends Error {
  constructor(public readonly reservationId: string) {
    super(`Lease reservation not found: ${reservationId}`);
    this.name = 'LeaseNotFoundError';
  }
}

export class InvalidLeaseTransitionError extends Error {
  constructor(
    public readonly reservationId: string,
    public readonly currentStatus: string,
    public readonly requestedStatus: string,
  ) {
    super(`Cannot transition lease ${reservationId} from ${currentStatus} to ${requestedStatus}`);
    this.name = 'InvalidLeaseTransitionError';
  }
}

export class IndicesUnavailableError extends Error {
  constructor(public readonly treeId: string, public readonly indices: SigningIndices) {
    super(
      `Indices (${indices.addressIndex}, ${indices.l1}, ${indices.l2}) are already unavailable for tree: ${treeId}`,
    );
    this.name = 'IndicesUnavailableError';
  }
}

export class PersonalLeaseNodeNotConfiguredError extends Error {
  constructor() {
    super(
      'PersonalLeaseNodeProvider requires a running lookup node. ' +
        'Deploy @totemsdk/lookup-node and configure { nodeUrl, nodePubkey }.',
    );
    this.name = 'PersonalLeaseNodeNotConfiguredError';
  }
}

export class P2PQuorumNotImplementedError extends Error {
  constructor() {
    super('P2PQuorumLeaseProvider is not yet implemented.');
    this.name = 'P2PQuorumNotImplementedError';
  }
}

export class OnchainWatermarkNotImplementedError extends Error {
  constructor() {
    super('OnchainWatermarkProvider is not yet implemented.');
    this.name = 'OnchainWatermarkNotImplementedError';
  }
}

export class QuorumUnavailableError extends Error {
  constructor(public readonly required: number, public readonly available: number) {
    super(
      `Quorum not reached: ${available}/${required} peers attested. ` +
        'The reservation was burned locally — retry when more peers are reachable.',
    );
    this.name = 'QuorumUnavailableError';
  }
}

export class QuorumConflictError extends Error {
  constructor(public readonly treeId: string, public readonly indices: SigningIndices) {
    super(
      `Quorum conflict for tree ${treeId} at (${indices.addressIndex}, ${indices.l1}, ${indices.l2}): ` +
        'a peer already holds a reservation for these indices.',
    );
    this.name = 'QuorumConflictError';
  }
}

export class OnchainWatermarkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OnchainWatermarkError';
  }
}

export class DeviceRangeViolationError extends Error {
  constructor(
    public readonly addressIndex: number,
    public readonly allowedStart: number,
    public readonly allowedEnd: number,
  ) {
    super(
      `Address index ${addressIndex} is outside device range [${allowedStart}, ${allowedEnd}]`,
    );
    this.name = 'DeviceRangeViolationError';
  }
}

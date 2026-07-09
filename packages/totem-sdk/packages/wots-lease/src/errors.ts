export class WatermarkMonotonicityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WatermarkMonotonicityError';
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

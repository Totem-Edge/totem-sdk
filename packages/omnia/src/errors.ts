export class ChannelCapacityError extends Error {
  constructor(public readonly used: number, public readonly capacity: number) {
    super(`Channel WOTS capacity exhausted: ${used}/${capacity} signing slots used`);
    this.name = 'ChannelCapacityError';
  }
}

export class DoubleSignError extends Error {
  constructor(public readonly sequence: number) {
    super(`Double-sign detected: sequence ${sequence} already signed with a different payload`);
    this.name = 'DoubleSignError';
  }
}

/**
 * OMN-109: a signer refused before producing anything. The signing guard may be
 * released and the same payload retried.
 */
export class SignerRefusalError extends Error {
  /** Marks the outcome as definite: no signature escaped the signer. */
  readonly definite = true;
  constructor(message: string) {
    super(message);
    this.name = 'SignerRefusalError';
  }
}

/**
 * OMN-109: the signer may have produced a signature (timeout, transport loss,
 * interrupted response). The signing guard stays sealed and the intent stays
 * ambiguous until it is reconciled explicitly.
 */
export class SignerOutcomeUnknownError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'SignerOutcomeUnknownError';
  }
}

export class BalanceConservationError extends Error {
  constructor(public readonly expected: bigint, public readonly got: bigint) {
    super(`Balance conservation violated: totalValue=${expected}, sum(balances+htlcs)=${got}`);
    this.name = 'BalanceConservationError';
  }
}

export class SequenceError extends Error {
  constructor(public readonly current: number, public readonly proposed: number) {
    super(`Sequence must be strictly greater than current: current=${current}, proposed=${proposed}`);
    this.name = 'SequenceError';
  }
}

export class SigningIndexMonotonicityError extends Error {
  constructor(public readonly partyId: string, public readonly flatIndex: number, public readonly previousFlatIndex: number) {
    super(`Signing index reuse for party ${partyId}: flatIndex=${flatIndex} <= previous=${previousFlatIndex}`);
    this.name = 'SigningIndexMonotonicityError';
  }
}

export class ChannelStatusError extends Error {
  constructor(public readonly expected: string | string[], public readonly actual: string) {
    const exp = Array.isArray(expected) ? expected.join('|') : expected;
    super(`Channel status mismatch: expected ${exp}, got ${actual}`);
    this.name = 'ChannelStatusError';
  }
}

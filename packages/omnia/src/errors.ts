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

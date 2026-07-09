export class SpliceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SpliceError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PendingHTLCError extends SpliceError {
  constructor(pendingCount: number) {
    super(
      'PENDING_HTLC',
      `Cannot splice: ${pendingCount} HTLC(s) still pending. Fulfill or timeout all HTLCs before splicing.`,
    );
    this.name = 'PendingHTLCError';
  }
}

export class SpliceChannelStatusError extends SpliceError {
  constructor(required: string, actual: string) {
    super(
      'INVALID_CHANNEL_STATUS',
      `Splice requires channel status '${required}', got '${actual}'.`,
    );
    this.name = 'SpliceChannelStatusError';
  }
}

export class SpliceBalanceConservationError extends SpliceError {
  constructor(expected: bigint, actual: bigint) {
    super(
      'BALANCE_CONSERVATION',
      `Splice balance conservation failed: expected ${expected}, got ${actual}.`,
    );
    this.name = 'SpliceBalanceConservationError';
  }
}

export class SpliceSignatureMismatchError extends SpliceError {
  constructor(detail: string) {
    super('SIGNATURE_MISMATCH', `Splice signature mismatch: ${detail}`);
    this.name = 'SpliceSignatureMismatchError';
  }
}

export class SpliceMissingPartyError extends SpliceError {
  constructor(partyId: string) {
    super('MISSING_PARTY', `Party '${partyId}' not found in channel.`);
    this.name = 'SpliceMissingPartyError';
  }
}

export class SpliceInsufficientFundsError extends SpliceError {
  constructor(available: bigint, requested: bigint) {
    super(
      'INSUFFICIENT_FUNDS',
      `Splice-out withdraws ${requested} but channel only holds ${available}.`,
    );
    this.name = 'SpliceInsufficientFundsError';
  }
}

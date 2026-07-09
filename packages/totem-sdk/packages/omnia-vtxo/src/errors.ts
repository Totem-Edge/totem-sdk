export class OmniaVtxoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OmniaVtxoError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class VtxoAmountError extends OmniaVtxoError {
  constructor(message: string) {
    super(message);
    this.name = 'VtxoAmountError';
  }
}

export class VtxoStatusError extends OmniaVtxoError {
  readonly currentStatus: string;
  constructor(message: string, currentStatus: string) {
    super(message);
    this.name = 'VtxoStatusError';
    this.currentStatus = currentStatus;
  }
}

export class VtxoOwnershipError extends OmniaVtxoError {
  constructor(message: string) {
    super(message);
    this.name = 'VtxoOwnershipError';
  }
}

export class VtxoProofError extends OmniaVtxoError {
  constructor(message: string) {
    super(message);
    this.name = 'VtxoProofError';
  }
}

export class VtxoPoolCapacityError extends OmniaVtxoError {
  readonly requested: bigint;
  readonly available: bigint;
  constructor(message: string, requested: bigint, available: bigint) {
    super(message);
    this.name = 'VtxoPoolCapacityError';
    this.requested = requested;
    this.available = available;
  }
}

export class VtxoPolicyError extends OmniaVtxoError {
  constructor(message: string) {
    super(message);
    this.name = 'VtxoPolicyError';
  }
}

export class VtxoMergeError extends OmniaVtxoError {
  constructor(message: string) {
    super(message);
    this.name = 'VtxoMergeError';
  }
}

export class VtxoSplitError extends OmniaVtxoError {
  constructor(message: string) {
    super(message);
    this.name = 'VtxoSplitError';
  }
}

export class VtxoExitError extends OmniaVtxoError {
  constructor(message: string) {
    super(message);
    this.name = 'VtxoExitError';
  }
}

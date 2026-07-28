export class LiquidityBondError extends Error {
  code?: string;
  details?: unknown;
  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'LiquidityBondError';
    this.code = code;
    this.details = details;
  }
}

export class LiquidityPoolManifestError extends LiquidityBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'LiquidityPoolManifestError';
  }
}

export class LiquidityIdentityError extends LiquidityBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'LiquidityIdentityError';
  }
}

export class LiquidityCommitmentError extends LiquidityBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'LiquidityCommitmentError';
  }
}

export class LiquidityPositionError extends LiquidityBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'LiquidityPositionError';
  }
}

export class LiquidityReceiptError extends LiquidityBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'LiquidityReceiptError';
  }
}

export class LiquidityAllocationError extends LiquidityBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'LiquidityAllocationError';
  }
}

export class LiquidityFeeError extends LiquidityBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'LiquidityFeeError';
  }
}

export class LiquidityWithdrawalError extends LiquidityBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'LiquidityWithdrawalError';
  }
}

export class LiquidityRiskError extends LiquidityBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'LiquidityRiskError';
  }
}

export class LiquidityPolicyError extends LiquidityBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'LiquidityPolicyError';
  }
}

export class LiquidityRegistryError extends LiquidityBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'LiquidityRegistryError';
  }
}

export class LiquiditySerializationError extends LiquidityBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'LiquiditySerializationError';
  }
}

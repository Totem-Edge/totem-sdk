export class ProviderBondError extends Error {
  code?: string;
  details?: unknown;
  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ProviderBondError';
    this.code = code;
    this.details = details;
  }
}

export class ProviderManifestError extends ProviderBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'ProviderManifestError';
  }
}

export class ProviderIdentityError extends ProviderBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'ProviderIdentityError';
  }
}

export class BondProofError extends ProviderBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'BondProofError';
  }
}

export class ProbeError extends ProviderBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'ProbeError';
  }
}

export class IncidentError extends ProviderBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'IncidentError';
  }
}

export class ProviderScoreError extends ProviderBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'ProviderScoreError';
  }
}

export class ProviderPolicyError extends ProviderBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'ProviderPolicyError';
  }
}

export class ProviderRegistryError extends ProviderBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'ProviderRegistryError';
  }
}

export class ProviderSerializationError extends ProviderBondError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, details);
    this.name = 'ProviderSerializationError';
  }
}

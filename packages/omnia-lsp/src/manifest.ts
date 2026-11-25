export const OMNIA_LSP_VERSION = 'omnia-lsp/v1' as const;
export const NATIVE_TOKEN_ID = '0x00' as const;

export type OmniaLspCustodyMode = 'self' | 'trust-minimised' | 'hosted';
export type OmniaLspClosePolicy = 'cooperative' | 'unilateral' | 'either';

export interface OmniaLspAsset {
  tokenId: string;
  scale: number;
  inboundCapacity: string;
  outboundCapacity: string;
  minChannel: string;
  maxChannel: string;
}

export interface OmniaLspFees {
  openBps?: number;
  openFlat?: string;
  leaseBps?: number;
  routingBps?: number;
  swapSpreadBps?: number;
}

export interface OmniaLspTerms {
  lease: boolean;
  jit: boolean;
  closePolicy: OmniaLspClosePolicy;
  minLockBlocks?: number;
  maxLockBlocks?: number;
}

export interface OmniaLspCustody {
  mode: OmniaLspCustodyMode;
  canMoveFunds: boolean;
  disclosureHash?: string;
}

export interface OmniaLspBond {
  providerBondId: string;
  asset: string;
  amount: string;
  proofRef?: string;
}

export interface OmniaLspManifest {
  version: typeof OMNIA_LSP_VERSION;
  providerId: string;
  identity: {
    address: string;
    publicKey?: string;
    proofRef?: string;
  };
  service: {
    type: 'omnia-lsp';
    name: string;
    version: string;
    relayUrl: string;
  };
  channel: {
    partyId: string;
    publicKeyDigest: string;
    settlementAddress: string;
    addressIndex?: number;
  };
  assets: OmniaLspAsset[];
  fees: OmniaLspFees;
  terms: OmniaLspTerms;
  custody: OmniaLspCustody;
  bond?: OmniaLspBond;
  publishedAt: number;
  expiresAt: number;
  sequence: number;
  topics?: string[];
}

export interface ManifestValidationOptions {
  /** Unix epoch ms. Defaults to Date.now(). */
  now?: number;
  /** Reject hosted custody manifests. Default false. */
  rejectHostedCustody?: boolean;
}

export interface ManifestValidationResult {
  ok: boolean;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDecimal(value: unknown): value is string {
  return typeof value === 'string' && /^\d+(\.\d+)?$/.test(value);
}

function isPositiveDecimal(value: unknown): value is string {
  if (!isDecimal(value)) return false;
  return Number(value) > 0;
}

function isHex64(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function isWsUrl(value: unknown): value is string {
  return typeof value === 'string' && /^wss?:\/\//.test(value);
}

function isBps(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10_000;
}

function isTokenId(value: unknown): value is string {
  return value === NATIVE_TOKEN_ID || isHex64(value);
}

function push(errors: string[], condition: boolean, message: string): void {
  if (!condition) errors.push(message);
}

export function validateManifest(
  value: unknown,
  options: ManifestValidationOptions = {},
): ManifestValidationResult {
  const errors: string[] = [];
  const now = options.now ?? Date.now();

  if (!isRecord(value)) {
    return { ok: false, errors: ['manifest must be an object'] };
  }

  push(errors, value.version === OMNIA_LSP_VERSION, `version must be ${OMNIA_LSP_VERSION}`);
  push(errors, isNonEmptyString(value.providerId), 'providerId must be a non-empty string');

  const identity = isRecord(value.identity) ? value.identity : null;
  push(errors, identity !== null, 'identity must be an object');
  if (identity) {
    push(errors, isNonEmptyString(identity.address), 'identity.address must be a non-empty string');
    if (identity.publicKey !== undefined) {
      push(errors, isHex64(identity.publicKey), 'identity.publicKey must be a 32-byte hex string');
    }
  }

  const service = isRecord(value.service) ? value.service : null;
  push(errors, service !== null, 'service must be an object');
  if (service) {
    push(errors, service.type === 'omnia-lsp', 'service.type must be omnia-lsp');
    push(errors, isNonEmptyString(service.name), 'service.name must be a non-empty string');
    push(errors, isNonEmptyString(service.version), 'service.version must be a non-empty string');
    push(errors, isWsUrl(service.relayUrl), 'service.relayUrl must be a ws:// or wss:// URL');
  }

  const channel = isRecord(value.channel) ? value.channel : null;
  push(errors, channel !== null, 'channel must be an object');
  if (channel) {
    push(errors, isNonEmptyString(channel.partyId), 'channel.partyId must be a non-empty string');
    push(errors, isHex64(channel.publicKeyDigest), 'channel.publicKeyDigest must be a 32-byte hex string');
    push(errors, isNonEmptyString(channel.settlementAddress), 'channel.settlementAddress must be a non-empty string');
    if (channel.addressIndex !== undefined) {
      push(
        errors,
        Number.isInteger(channel.addressIndex) && Number(channel.addressIndex) >= 0,
        'channel.addressIndex must be a non-negative integer',
      );
    }
  }

  if (!Array.isArray(value.assets) || value.assets.length === 0) {
    errors.push('assets must be a non-empty array');
  } else {
    value.assets.forEach((asset, index) => {
      if (!isRecord(asset)) {
        errors.push(`assets[${index}] must be an object`);
        return;
      }
      push(errors, isTokenId(asset.tokenId), `assets[${index}].tokenId must be 0x00 or a 32-byte token id`);
      push(
        errors,
        Number.isInteger(asset.scale) && Number(asset.scale) >= 0 && Number(asset.scale) <= 44,
        `assets[${index}].scale must be an integer from 0 to 44`,
      );
      for (const field of ['inboundCapacity', 'outboundCapacity', 'minChannel', 'maxChannel'] as const) {
        push(errors, isDecimal(asset[field]), `assets[${index}].${field} must be a decimal string`);
      }
      if (isDecimal(asset.minChannel) && isDecimal(asset.maxChannel)) {
        push(
          errors,
          Number(asset.minChannel) <= Number(asset.maxChannel),
          `assets[${index}].minChannel must be <= maxChannel`,
        );
      }
    });
  }

  const fees = isRecord(value.fees) ? value.fees : null;
  push(errors, fees !== null, 'fees must be an object');
  if (fees) {
    for (const field of ['openBps', 'leaseBps', 'routingBps', 'swapSpreadBps'] as const) {
      if (fees[field] !== undefined) push(errors, isBps(fees[field]), `fees.${field} must be 0..10000`);
    }
    if (fees.openFlat !== undefined) push(errors, isDecimal(fees.openFlat), 'fees.openFlat must be a decimal string');
  }

  const terms = isRecord(value.terms) ? value.terms : null;
  push(errors, terms !== null, 'terms must be an object');
  if (terms) {
    push(errors, typeof terms.lease === 'boolean', 'terms.lease must be a boolean');
    push(errors, typeof terms.jit === 'boolean', 'terms.jit must be a boolean');
    push(
      errors,
      terms.closePolicy === 'cooperative' || terms.closePolicy === 'unilateral' || terms.closePolicy === 'either',
      'terms.closePolicy must be cooperative, unilateral or either',
    );
    if (terms.minLockBlocks !== undefined) {
      push(errors, Number.isInteger(terms.minLockBlocks) && Number(terms.minLockBlocks) >= 0, 'terms.minLockBlocks must be a non-negative integer');
    }
    if (terms.maxLockBlocks !== undefined) {
      push(errors, Number.isInteger(terms.maxLockBlocks) && Number(terms.maxLockBlocks) >= 0, 'terms.maxLockBlocks must be a non-negative integer');
    }
    if (
      Number.isInteger(terms.minLockBlocks) &&
      Number.isInteger(terms.maxLockBlocks) &&
      Number(terms.minLockBlocks) > Number(terms.maxLockBlocks)
    ) {
      errors.push('terms.minLockBlocks must be <= maxLockBlocks');
    }
  }

  const custody = isRecord(value.custody) ? value.custody : null;
  push(errors, custody !== null, 'custody must be an object');
  if (custody) {
    push(
      errors,
      custody.mode === 'self' || custody.mode === 'trust-minimised' || custody.mode === 'hosted',
      'custody.mode must be self, trust-minimised or hosted',
    );
    push(errors, typeof custody.canMoveFunds === 'boolean', 'custody.canMoveFunds must be a boolean');
    if (custody.canMoveFunds === true) {
      push(errors, isHex64(custody.disclosureHash), 'custody.disclosureHash is required when canMoveFunds is true');
    }
    if (options.rejectHostedCustody === true) {
      push(errors, custody.mode !== 'hosted', 'hosted custody is not allowed by this policy');
    }
  }

  if (value.bond !== undefined) {
    const bond = isRecord(value.bond) ? value.bond : null;
    push(errors, bond !== null, 'bond must be an object');
    if (bond) {
      push(errors, isNonEmptyString(bond.providerBondId), 'bond.providerBondId must be a non-empty string');
      push(errors, isNonEmptyString(bond.asset), 'bond.asset must be a non-empty string');
      push(errors, isPositiveDecimal(bond.amount), 'bond.amount must be a positive decimal string');
    }
  }

  push(
    errors,
    typeof value.publishedAt === 'number' && Number.isFinite(value.publishedAt) && value.publishedAt >= 0,
    'publishedAt must be a unix epoch ms number',
  );
  push(
    errors,
    typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt) && value.expiresAt > now,
    'expiresAt must be a future unix epoch ms number',
  );
  push(
    errors,
    Number.isInteger(value.sequence) && Number(value.sequence) >= 0,
    'sequence must be a non-negative integer',
  );

  if (value.topics !== undefined) {
    if (!Array.isArray(value.topics)) {
      errors.push('topics must be an array');
    } else {
      value.topics.forEach((topic, index) => {
        push(errors, isNonEmptyString(topic), `topics[${index}] must be a non-empty string`);
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidManifest(
  value: unknown,
  options: ManifestValidationOptions = {},
): asserts value is OmniaLspManifest {
  const result = validateManifest(value, options);
  if (!result.ok) {
    throw new Error(`Invalid Omnia LSP manifest: ${result.errors.join('; ')}`);
  }
}

export function manifestIsFresh(manifest: OmniaLspManifest, now = Date.now()): boolean {
  return manifest.expiresAt > now;
}

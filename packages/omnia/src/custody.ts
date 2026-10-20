/**
 * Custody modes, sign requests and the signer port (RFC-058 P1).
 *
 * This is the shared foundation for both deployment modes:
 *   - self-custody (default): the user wallet holds keys and signs;
 *   - hosted custody (explicit): an operator signer/policy engine signs.
 *
 * A sign request binds the payload digest to the domain and the custody
 * disclosure hash, so a signature cannot be replayed under different terms.
 */

import { sha3_256 } from '@totemsdk/core';

export type CustodyMode = 'self' | 'trust-minimised' | 'hosted';

export type SignDomain =
  | 'channel'
  | 'factory'
  | 'settlement'
  | 'splice'
  | 'vtxo'
  | 'pool'
  | 'manifest';

export interface CustodyContext {
  mode: CustodyMode;
  /** Hosted only: stable operator id (public key / service id). */
  operatorId?: string;
  /** Hosted only: legal entity responsible for custody. */
  legalEntity?: string;
  /** Hosted only: jurisdiction of the legal entity. */
  jurisdiction?: string;
  /** Hosted only: licence/registration reference, if any. */
  license?: string;
  keyManagement?: 'wallet' | 'kms' | 'hsm' | 'mpc' | 'host';
  canMoveFunds?: boolean;
  canFreeze?: boolean;
  operatorDiscretion?: boolean;
  withdrawalTerms?: string;
  receiptTransferability?: 'none' | 'restricted' | 'transferable';
  /** Hash of the operator's disclosure/terms; bound into the signed payload. */
  disclosureHash?: string;
  disclosureVersion?: string;
  policySummary?: string;
  /** Trust-minimised: why it is trust-minimised and how it is mitigated. */
  reason?: string;
  mitigation?: string;
}

export interface SignContext {
  /** Human-readable intent shown by the wallet, e.g. "Open channel 100 MIN". */
  summary: string;
  asset?: string;
  amount?: string;
  /** Lockup, withdrawal and exit terms. */
  terms?: string;
  warnings?: string[];
}

export interface SignRequest {
  /** Idempotency key; reusing it with a different payload is rejected. */
  requestId: string;
  domain: SignDomain;
  /** The canonical payload digest to sign (before domain separation). */
  digest: Uint8Array;
  context: SignContext;
  /** Required signer public-key digests. */
  signers: string[];
  custody: CustodyContext;
  expiresAt?: number;
  chainId?: string;
}

export interface SignerPort {
  readonly publicKeyDigest: string;
  /** Sign the domain-separated payload (see `signRequestPayload`). */
  sign(request: SignRequest): Promise<Uint8Array>;
}

const DOMAIN_PREFIX = 'totemsdk/sign-request/v1';
const SIGN_DOMAINS: ReadonlySet<SignDomain> = new Set([
  'channel',
  'factory',
  'settlement',
  'splice',
  'vtxo',
  'pool',
  'manifest',
]);

/** Default custody context for a self-custody deployment. */
export function makeSelfCustody(overrides: Partial<CustodyContext> = {}): CustodyContext {
  return {
    mode: 'self',
    keyManagement: 'wallet',
    canMoveFunds: false,
    canFreeze: false,
    operatorDiscretion: false,
    receiptTransferability: 'none',
    ...overrides,
  };
}

/**
 * Validate custody metadata. Hosted custody must be explicit and complete;
 * self-custody cannot claim operator movement/freeze/discretion powers.
 */
export function validateCustodyContext(custody: CustodyContext): void {
  if (!custody || typeof custody !== 'object') throw new Error('custody context is required');
  if (custody.mode !== 'self' && custody.mode !== 'trust-minimised' && custody.mode !== 'hosted') {
    throw new Error(`invalid custody mode: ${String(custody.mode)}`);
  }

  if (custody.mode === 'self') {
    if (custody.keyManagement && custody.keyManagement !== 'wallet') {
      throw new Error('self custody must use wallet key management');
    }
    if (custody.canMoveFunds === true || custody.canFreeze === true || custody.operatorDiscretion === true) {
      throw new Error('self custody cannot grant operator movement, freeze or discretion');
    }
    return;
  }

  if (custody.mode === 'trust-minimised') {
    if (!custody.reason) throw new Error('trust-minimised custody requires reason');
    if (!custody.mitigation) throw new Error('trust-minimised custody requires mitigation');
    return;
  }

  // hosted
  const required: Array<[keyof CustodyContext, string]> = [
    ['operatorId', 'operatorId'],
    ['legalEntity', 'legalEntity'],
    ['jurisdiction', 'jurisdiction'],
    ['disclosureHash', 'disclosureHash'],
    ['disclosureVersion', 'disclosureVersion'],
    ['policySummary', 'policySummary'],
    ['withdrawalTerms', 'withdrawalTerms'],
  ];
  for (const [key, label] of required) {
    if (!custody[key]) throw new Error(`hosted custody requires ${label}`);
  }
  if (custody.keyManagement === 'wallet') {
    throw new Error('hosted custody cannot use wallet-only key management');
  }
  for (const key of ['canMoveFunds', 'canFreeze', 'operatorDiscretion'] as const) {
    if (typeof custody[key] !== 'boolean') {
      throw new Error(`hosted custody requires ${key} to be explicit`);
    }
  }
}

/** Validate a sign request before handing it to a signer. */
export function assertSignRequest(request: SignRequest, now = Date.now()): void {
  if (!request || typeof request !== 'object') throw new Error('sign request is required');
  if (!request.requestId) throw new Error('sign request requires requestId');
  if (!SIGN_DOMAINS.has(request.domain)) throw new Error(`invalid sign domain: ${String(request.domain)}`);
  if (!(request.digest instanceof Uint8Array) || request.digest.length !== 32) {
    throw new Error('sign request digest must be 32 bytes');
  }
  if (!request.context || !request.context.summary) throw new Error('sign request requires a context summary');
  if (!Array.isArray(request.signers) || request.signers.length === 0) {
    throw new Error('sign request requires at least one signer');
  }
  validateCustodyContext(request.custody);
  if (request.expiresAt !== undefined && request.expiresAt <= now) {
    throw new Error('sign request has expired');
  }
}

/**
 * Domain-separated payload a signer signs.
 *
 * Binds the payload digest to the domain and the custody disclosure hash, so a
 * signature produced under disclosure A is invalid under disclosure B.
 */
export function signRequestPayload(request: SignRequest): Uint8Array {
  const prefix = new TextEncoder().encode(
    `${DOMAIN_PREFIX}|${request.domain}|${request.custody.disclosureHash ?? ''}|`,
  );
  const out = new Uint8Array(prefix.length + request.digest.length);
  out.set(prefix, 0);
  out.set(request.digest, prefix.length);
  return sha3_256(out);
}

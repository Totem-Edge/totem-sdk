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

import { bytesToHex, sha3_256 } from '@totemsdk/core';
import type { SigningIndices } from '@totemsdk/wots-lease';

export type CustodyMode = 'self' | 'trust-minimised' | 'hosted';

/**
 * - `intent`: authorization signature over domain + disclosure + digest.
 * - `chain`: raw chain signature over `digest` (the intent/approval layer binds
 *   the disclosure; the chain signature itself must remain the exact bytes the
 *   chain/peer verifies).
 */
export type SignRequestKind = 'intent' | 'chain';

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
  /** Hosted only: public URL of the full disclosure/terms. */
  disclosureUrl?: string;
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
  /** Defaults to `intent`. */
  kind?: SignRequestKind;
  domain: SignDomain;
  /** The canonical payload digest to sign (before domain separation). */
  digest: Uint8Array;
  context: SignContext;
  /** Required signer public-key digests. */
  signers: string[];
  /**
   * Pre-reserved lease indices. When supplied, the signer must use them and the
   * caller owns reserve/commit (used by channel/factory tx signing).
   */
  signingIndices?: SigningIndices;
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

/** Constructor input for an explicit hosted-custody deployment. */
export interface HostedCustodyConfig {
  operatorId: string;
  legalEntity: string;
  jurisdiction: string;
  disclosureHash: string;
  disclosureVersion: string;
  policySummary: string;
  withdrawalTerms: string;
  /** Defaults to `host` (operator-held key material). */
  keyManagement?: 'kms' | 'hsm' | 'mpc' | 'host';
  /** Defaults to false: the disclosure must opt in explicitly. */
  canMoveFunds?: boolean;
  canFreeze?: boolean;
  operatorDiscretion?: boolean;
  license?: string;
  disclosureUrl?: string;
  receiptTransferability?: 'none' | 'restricted' | 'transferable';
}

/**
 * Build and validate an explicit hosted-custody context. Callers must opt in
 * and provide a complete disclosure; there is no implicit hosted mode.
 */
export function makeHostedCustody(config: HostedCustodyConfig): CustodyContext {
  const custody: CustodyContext = {
    mode: 'hosted',
    keyManagement: config.keyManagement ?? 'host',
    canMoveFunds: config.canMoveFunds ?? false,
    canFreeze: config.canFreeze ?? false,
    operatorDiscretion: config.operatorDiscretion ?? false,
    receiptTransferability: config.receiptTransferability ?? 'none',
    ...config,
  };
  validateCustodyContext(custody);
  return custody;
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
  if (request.kind !== undefined && request.kind !== 'intent' && request.kind !== 'chain') {
    throw new Error(`invalid sign request kind: ${String(request.kind)}`);
  }
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
 * Portable acknowledgement of one exact disclosure (RFC-061 D2).
 * The host must verify this against its configured disclosure; it must never
 * trust a caller-supplied boolean.
 */
export interface CustodyAcknowledgement {
  disclosureId: string;
  disclosureHash: string;
  disclosureVersion: string;
  subjectId: string;
  acknowledgedAt: number;
  expiresAt?: number;
  /** Optional proof; required when the ack crosses a trust boundary. */
  signature?: Uint8Array;
  signerPublicKeyDigest?: string;
}

/**
 * Stable id over the material custody terms. A change to any term (or to the
 * disclosure hash/version) invalidates every acknowledgement bound to it.
 */
export function custodyDisclosureId(custody: CustodyContext): string {
  const canonical = {
    mode: custody.mode,
    operatorId: custody.operatorId ?? null,
    legalEntity: custody.legalEntity ?? null,
    jurisdiction: custody.jurisdiction ?? null,
    license: custody.license ?? null,
    keyManagement: custody.keyManagement ?? null,
    canMoveFunds: custody.canMoveFunds ?? false,
    canFreeze: custody.canFreeze ?? false,
    operatorDiscretion: custody.operatorDiscretion ?? false,
    withdrawalTerms: custody.withdrawalTerms ?? null,
    receiptTransferability: custody.receiptTransferability ?? null,
    disclosureHash: custody.disclosureHash ?? null,
    disclosureVersion: custody.disclosureVersion ?? null,
    disclosureUrl: custody.disclosureUrl ?? null,
    policySummary: custody.policySummary ?? null,
    reason: custody.reason ?? null,
    mitigation: custody.mitigation ?? null,
  };
  return bytesToHex(sha3_256(new TextEncoder().encode(JSON.stringify(canonical))));
}

export interface CustodyAcknowledgementCheck {
  ok: boolean;
  reason?: string;
}

export interface CustodyAcknowledgementOptions {
  subjectId?: string;
  now?: number;
  /** Tolerated future clock skew for acknowledgedAt (default 5 minutes). */
  clockSkewMs?: number;
}

/** Verify an acknowledgement against the exact custody terms. */
export function checkCustodyAcknowledgement(
  acknowledgement: CustodyAcknowledgement | undefined,
  custody: CustodyContext,
  options: CustodyAcknowledgementOptions = {},
): CustodyAcknowledgementCheck {
  if (!acknowledgement) return { ok: false, reason: 'custody acknowledgement is required' };
  if (!acknowledgement.disclosureId) return { ok: false, reason: 'custody acknowledgement requires disclosureId' };
  if (acknowledgement.disclosureId !== custodyDisclosureId(custody)) {
    return { ok: false, reason: 'custody acknowledgement disclosureId does not match' };
  }
  if (acknowledgement.disclosureHash !== custody.disclosureHash) {
    return { ok: false, reason: 'custody acknowledgement disclosureHash does not match' };
  }
  if (acknowledgement.disclosureVersion !== custody.disclosureVersion) {
    return { ok: false, reason: 'custody acknowledgement disclosureVersion does not match' };
  }
  if (!acknowledgement.subjectId) return { ok: false, reason: 'custody acknowledgement requires subjectId' };
  if (options.subjectId !== undefined && acknowledgement.subjectId !== options.subjectId) {
    return { ok: false, reason: 'custody acknowledgement subject does not match' };
  }
  const now = options.now ?? Date.now();
  const skew = options.clockSkewMs ?? 5 * 60_000;
  if (!Number.isFinite(acknowledgement.acknowledgedAt) || acknowledgement.acknowledgedAt <= 0) {
    return { ok: false, reason: 'custody acknowledgement has an invalid acknowledgedAt' };
  }
  if (acknowledgement.acknowledgedAt > now + skew) {
    return { ok: false, reason: 'custody acknowledgement is from the future' };
  }
  if (acknowledgement.expiresAt !== undefined && acknowledgement.expiresAt <= now) {
    return { ok: false, reason: 'custody acknowledgement has expired' };
  }
  return { ok: true };
}

export function assertCustodyAcknowledgement(
  acknowledgement: CustodyAcknowledgement | undefined,
  custody: CustodyContext,
  options: CustodyAcknowledgementOptions = {},
): void {
  const result = checkCustodyAcknowledgement(acknowledgement, custody, options);
  if (!result.ok) throw new Error(result.reason ?? 'custody acknowledgement is invalid');
}

export interface CustodySigningOptions extends CustodyAcknowledgementOptions {
  acknowledgement?: CustodyAcknowledgement;
  /** Hosted custody requires a positive policy decision; absent/deny fails closed. */
  policyDecision?: 'allow' | 'deny';
}

/**
 * The signer-side custody gate (RFC-061 D1).
 *
 * - self: allowed, no hosted disclosure.
 * - trust-minimised: valid acknowledgement for the exact terms.
 * - hosted: valid acknowledgement + explicit positive policy decision.
 */
export function assertCustodyAllowsSigning(
  request: SignRequest,
  options: CustodySigningOptions = {},
): void {
  validateCustodyContext(request.custody);
  if (request.custody.mode === 'self') return;
  assertCustodyAcknowledgement(options.acknowledgement, request.custody, options);
  if (request.custody.mode === 'trust-minimised') return;
  if (options.policyDecision !== 'allow') {
    throw new Error('hosted signing requires a positive policy decision');
  }
}

/**
 * Payload a signer signs.
 *
 * - `intent` (default): domain-separated digest binding the custody disclosure
 *   hash, so a signature under disclosure A is invalid under disclosure B.
 * - `chain`: the raw digest; the chain/peer verifies exactly these bytes. The
 *   disclosure is bound by the accompanying intent/approval signature.
 */
export function signRequestPayload(request: SignRequest): Uint8Array {
  if (request.kind === 'chain') return new Uint8Array(request.digest);
  const prefix = new TextEncoder().encode(
    `${DOMAIN_PREFIX}|${request.domain}|${request.custody.disclosureHash ?? ''}|`,
  );
  const out = new Uint8Array(prefix.length + request.digest.length);
  out.set(prefix, 0);
  out.set(request.digest, prefix.length);
  return sha3_256(out);
}

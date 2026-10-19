/**
 * Fail-closed runtime validation for Eefi contracts.
 *
 * Types alone do not protect contracts crossing the wire or storage. These
 * validators check structure, units (atoms / basis points) and — for contracts
 * that carry an identity — that the committed digest matches the body.
 */
import {
  eefiCapitalTermsHash,
  eefiMarketQuoteDigest,
  eefiRiskPolicyId,
} from './digests.js';
import type {
  EefiCapitalAgreement,
  EefiContract,
  EefiExerciseCovenant,
  EefiMarketAgreement,
  EefiRiskPolicyRef,
} from './types.js';

export class EefiValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid Eefi contract: ${issues.join('; ')}`);
    this.name = 'EefiValidationError';
    this.issues = issues;
  }
}

type Issues = string[];

const HEX = /^0x[0-9a-fA-F]+$/;
const ATOMS = /^(0|[1-9][0-9]*)$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHex(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    HEX.test(value) &&
    (value.length - 2) % 2 === 0
  );
}

function isAtom(value: unknown): value is string {
  return typeof value === 'string' && ATOMS.test(value);
}

function isUint(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isBps(value: unknown): value is number {
  return isUint(value) && value <= 10_000;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function hex(issues: Issues, path: string, value: unknown): void {
  if (!isHex(value)) issues.push(`${path} must be 0x-prefixed even-length hex`);
}

function atom(issues: Issues, path: string, value: unknown): void {
  if (!isAtom(value)) {
    issues.push(`${path} must be a non-negative integer string`);
  }
}

function uint(issues: Issues, path: string, value: unknown): void {
  if (!isUint(value)) {
    issues.push(`${path} must be a non-negative safe integer`);
  }
}

function bps(issues: Issues, path: string, value: unknown): void {
  if (!isBps(value)) {
    issues.push(`${path} must be an integer in [0, 10000]`);
  }
}

function text(issues: Issues, path: string, value: unknown): void {
  if (!isNonEmptyString(value)) {
    issues.push(`${path} must be a non-empty string`);
  }
}

function optional(
  issues: Issues,
  path: string,
  value: unknown,
  check: (issues: Issues, path: string, value: unknown) => void,
): void {
  if (value !== undefined) check(issues, path, value);
}

function fail(issues: Issues): void {
  if (issues.length > 0) throw new EefiValidationError(issues);
}

function validateFunding(issues: Issues, value: unknown): void {
  if (!isObject(value)) {
    issues.push('funding must be an object');
    return;
  }
  hex(issues, 'funding.mashPolicyRoot', value.mashPolicyRoot);
  hex(issues, 'funding.allowedProgramHash', value.allowedProgramHash);
  hex(issues, 'funding.assetId', value.assetId);
  atom(issues, 'funding.maxAmountAtoms', value.maxAmountAtoms);
  if (value.counterparties !== undefined) {
    if (!Array.isArray(value.counterparties)) {
      issues.push('funding.counterparties must be an array');
    } else {
      value.counterparties.forEach((entry, i) => {
        text(issues, `funding.counterparties[${i}]`, entry);
      });
    }
  }
}

function validateOperation(issues: Issues, value: unknown): void {
  if (!isObject(value)) {
    issues.push('operation must be an object');
    return;
  }
  text(issues, 'operation.channelProgramId', value.channelProgramId);
  atom(issues, 'operation.maturityBlock', value.maturityBlock);
  hex(issues, 'operation.stateRulesHash', value.stateRulesHash);
  optional(issues, 'operation.conditionPolicyId', value.conditionPolicyId, text);
}

function validateSettlement(issues: Issues, value: unknown): void {
  if (!isObject(value)) {
    issues.push('settlement must be an object');
    return;
  }
  hex(issues, 'settlement.payoutPolicyHash', value.payoutPolicyHash);
  hex(issues, 'settlement.recoveryPolicyHash', value.recoveryPolicyHash);
  optional(
    issues,
    'settlement.collateralCommitment',
    value.collateralCommitment,
    hex,
  );
}

export function validateCapitalAgreement(
  value: unknown,
): asserts value is EefiCapitalAgreement {
  if (!isObject(value)) {
    throw new EefiValidationError(['contract must be an object']);
  }
  const issues: Issues = [];
  if (value.version !== 'eefi-capital/v1') {
    issues.push('version must be eefi-capital/v1');
  }
  hex(issues, 'termsHash', value.termsHash);
  validateFunding(issues, value.funding);
  validateOperation(issues, value.operation);
  validateSettlement(issues, value.settlement);
  if (issues.length === 0) {
    const agreement = value as unknown as EefiCapitalAgreement;
    const expected = eefiCapitalTermsHash(agreement);
    if (agreement.termsHash !== expected) {
      issues.push(`termsHash does not match canonical terms (expected ${expected})`);
    }
  }
  fail(issues);
}

export function validateMarketAgreement(
  value: unknown,
): asserts value is EefiMarketAgreement {
  if (!isObject(value)) {
    throw new EefiValidationError(['contract must be an object']);
  }
  const issues: Issues = [];
  if (value.version !== 'eefi-market/v1') {
    issues.push('version must be eefi-market/v1');
  }
  hex(issues, 'quoteId', value.quoteId);
  text(issues, 'nonce', value.nonce);
  if (value.side !== 'buy' && value.side !== 'sell') {
    issues.push('side must be buy or sell');
  }
  hex(issues, 'baseAssetId', value.baseAssetId);
  hex(issues, 'quoteAssetId', value.quoteAssetId);
  uint(issues, 'baseScale', value.baseScale);
  uint(issues, 'quoteScale', value.quoteScale);
  const hasIn = value.exactIn !== undefined;
  const hasOut = value.exactOut !== undefined;
  if (hasIn === hasOut) {
    issues.push('exactly one of exactIn or exactOut is required');
  }
  optional(issues, 'exactIn', value.exactIn, atom);
  optional(issues, 'exactOut', value.exactOut, atom);
  atom(issues, 'priceAtoms', value.priceAtoms);
  bps(issues, 'feesBps', value.feesBps);
  optional(issues, 'maxSlippageBps', value.maxSlippageBps, bps);
  text(issues, 'venue', value.venue);
  atom(issues, 'deadlineBlock', value.deadlineBlock);
  optional(issues, 'conditionPolicyId', value.conditionPolicyId, text);
  text(issues, 'makerId', value.makerId);
  text(issues, 'takerId', value.takerId);
  text(issues, 'domain', value.domain);
  hex(issues, 'signatureRef', value.signatureRef);
  if (issues.length === 0) {
    const agreement = value as unknown as EefiMarketAgreement;
    const expected = eefiMarketQuoteDigest(agreement);
    if (agreement.quoteId !== expected) {
      issues.push(`quoteId does not match canonical quote (expected ${expected})`);
    }
  }
  fail(issues);
}

export function validateRiskPolicyRef(
  value: unknown,
): asserts value is EefiRiskPolicyRef {
  if (!isObject(value)) {
    throw new EefiValidationError(['contract must be an object']);
  }
  const issues: Issues = [];
  if (value.version !== 'eefi-risk/v1') {
    issues.push('version must be eefi-risk/v1');
  }
  hex(issues, 'policyId', value.policyId);
  atom(issues, 'maxExposureAtoms', value.maxExposureAtoms);
  optional(issues, 'collateralRatioBps', value.collateralRatioBps, bps);
  optional(issues, 'haircutBps', value.haircutBps, bps);
  optional(
    issues,
    'liquidationConditionId',
    value.liquidationConditionId,
    text,
  );
  if (value.oraclePolicyIds !== undefined) {
    if (!Array.isArray(value.oraclePolicyIds)) {
      issues.push('oraclePolicyIds must be an array');
    } else {
      value.oraclePolicyIds.forEach((entry, i) => {
        text(issues, `oraclePolicyIds[${i}]`, entry);
      });
    }
  }
  if (issues.length === 0) {
    const policy = value as unknown as EefiRiskPolicyRef;
    const expected = eefiRiskPolicyId(policy);
    if (policy.policyId !== expected) {
      issues.push(`policyId does not match canonical policy (expected ${expected})`);
    }
  }
  fail(issues);
}

export function validateExerciseCovenant(
  value: unknown,
): asserts value is EefiExerciseCovenant {
  if (!isObject(value)) {
    throw new EefiValidationError(['contract must be an object']);
  }
  const issues: Issues = [];
  if (value.version !== 'eefi-exercise/v1') {
    issues.push('version must be eefi-exercise/v1');
  }
  if (
    value.kind !== 'unilateral-exercise' &&
    value.kind !== 'liquidation' &&
    value.kind !== 'maturity-redemption'
  ) {
    issues.push(
      'kind must be unilateral-exercise, liquidation or maturity-redemption',
    );
  }
  text(issues, 'conditionId', value.conditionId);
  hex(issues, 'beneficiaryPolicyHash', value.beneficiaryPolicyHash);
  hex(issues, 'recoveryPolicyHash', value.recoveryPolicyHash);
  uint(issues, 'timelockBlocks', value.timelockBlocks);
  fail(issues);
}

/** Validate any Eefi contract by its version tag. Returns the narrowed value. */
export function validateEefiContract(value: unknown): EefiContract {
  if (!isObject(value)) {
    throw new EefiValidationError(['contract must be an object']);
  }
  switch (value.version) {
    case 'eefi-capital/v1':
      validateCapitalAgreement(value);
      return value;
    case 'eefi-market/v1':
      validateMarketAgreement(value);
      return value;
    case 'eefi-risk/v1':
      validateRiskPolicyRef(value);
      return value;
    case 'eefi-exercise/v1':
      validateExerciseCovenant(value);
      return value;
    default:
      throw new EefiValidationError([
        `unknown Eefi contract version: ${String(value.version)}`,
      ]);
  }
}

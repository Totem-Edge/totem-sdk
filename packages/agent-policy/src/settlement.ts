/**
 * agent-policy/settlement.ts — RFC-022 Amendment A settlement contracts.
 *
 * A governed operation is settled by three independent facts:
 *   - whether it was dispatched;
 *   - how it terminally ended (or that it is still non-terminal);
 *   - what it actually consumed.
 *
 * Boolean `ok` is never sufficient. The types here are shared by
 * `agent-policy`, `edge` and `act-core` so the accounting model has one owner.
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import type { StepEffects } from './run.js';

export type DispatchState = 'not-dispatched' | 'dispatched' | 'unknown';

export type TerminalOutcome =
  | 'confirmed'
  | 'failed'
  | 'cancelled'
  | 'aborted'
  | 'unknown';

export type NonterminalPhase =
  | 'accepted'
  | 'running'
  | 'cancelling'
  | 'reconciling';

export type SettlementDisposition =
  | 'release-nonexecution'
  | 'commit-reserved'
  | 'settle-actual';

export interface ActualSpend {
  tokenId: string;
  amount: string;
  recipient?: string;
}

export interface ActualComputeConsumption {
  resourceId: string;
  wallSeconds?: string;
  cpuSeconds?: string;
  acceleratorSeconds?: string;
  acceleratorClass?: string;
  peakMemoryBytes?: string;
  bytesWritten?: string;
}

export interface ActualMandateUsage {
  mandateId: string;
  count: number;
  amount?: string;
}

/**
 * A trusted metered account of what an executed operation consumed. This is an
 * accounting claim backed by evidence references, not a raw provider callback.
 */
export interface ActualConsumptionV1 {
  schema: 'totem:act:actual-consumption/v1';
  spends: ActualSpend[];
  fees?: ActualSpend[];
  compute?: ActualComputeConsumption[];
  mandateUsage: ActualMandateUsage[];
  evidenceRefs: string[];
  measuredAt: number;
  measurementStatus: 'verified' | 'partial' | 'unavailable';
}

export interface SettlementInstructionV1 {
  schema: 'totem:act:settlement/v1';
  reservationId: string;
  operationId: string;
  preparedCommandDigest: string;
  dispatchState: DispatchState;
  terminalOutcome: Exclude<TerminalOutcome, 'unknown'>;
  disposition: SettlementDisposition;
  actual?: ActualConsumptionV1;
  evidenceRefs: string[];
  settlementId: string;
}

/** Fields carried by a settled receipt. */
export interface SettlementReceiptFields {
  settlementId?: string;
  dispatchState?: DispatchState;
  terminalOutcome?: TerminalOutcome;
  actualConsumption?: ActualConsumptionV1;
  reservedUsage?: { count: number; amount?: string };
  releasedUsage?: { count: number; amount?: string };
}

export interface ReservedUsageDelta {
  mandateId: string;
  delta: { count: number; amount?: string };
}

const DOMAIN_SETTLEMENT = 'TOTEM_ACT_SETTLEMENT_V1';
const DECIMAL = /^(0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'bigint') return JSON.stringify({ __bigint: value.toString() });
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(',') + '}';
}

/** Canonical digest of everything except the settlement id itself. */
export function computeSettlementId(
  instruction: Omit<SettlementInstructionV1, 'settlementId'> | SettlementInstructionV1,
): string {
  const body = {
    schema: instruction.schema,
    reservationId: instruction.reservationId,
    operationId: instruction.operationId,
    preparedCommandDigest: instruction.preparedCommandDigest,
    dispatchState: instruction.dispatchState,
    terminalOutcome: instruction.terminalOutcome,
    disposition: instruction.disposition,
    actual: instruction.actual ?? null,
    evidenceRefs: instruction.evidenceRefs,
  };
  return toHex(sha3_256(new TextEncoder().encode(DOMAIN_SETTLEMENT + canonicalJson(body))));
}

function assertDecimalString(value: string, field: string): void {
  if (!DECIMAL.test(value)) {
    throw new Error(`settlement: ${field} must be a non-negative decimal string`);
  }
}

function sumAmounts(entries: ReadonlyArray<{ tokenId: string; amount: string }>): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of entries) {
    assertDecimalString(entry.amount, `amount for ${entry.tokenId}`);
    const current = out.get(entry.tokenId);
    out.set(entry.tokenId, current === undefined ? entry.amount : addDecimal(current, entry.amount));
  }
  return out;
}

function addDecimal(a: string, b: string): string {
  const [aWhole, aFrac = ''] = a.split('.');
  const [bWhole, bFrac = ''] = b.split('.');
  const scale = Math.max(aFrac.length, bFrac.length);
  const av = BigInt(aWhole + aFrac.padEnd(scale, '0'));
  const bv = BigInt(bWhole + bFrac.padEnd(scale, '0'));
  const sum = (av + bv).toString().padStart(scale + 1, '0');
  if (scale === 0) return sum;
  return `${sum.slice(0, -scale)}.${sum.slice(-scale)}`.replace(/\.?0+$/, '') || '0';
}

function compareDecimal(a: string, b: string): number {
  const [aWhole, aFrac = ''] = a.split('.');
  const [bWhole, bFrac = ''] = b.split('.');
  const scale = Math.max(aFrac.length, bFrac.length);
  const av = BigInt(aWhole + aFrac.padEnd(scale, '0'));
  const bv = BigInt(bWhole + bFrac.padEnd(scale, '0'));
  return av < bv ? -1 : av > bv ? 1 : 0;
}

function assertActualWithinReserved(
  actual: ActualConsumptionV1,
  reservedEffects?: StepEffects,
  reservedUsageDeltas?: ReservedUsageDelta[],
): void {
  const reservedSpends = sumAmounts(reservedEffects?.spends ?? []);
  for (const [tokenId, amount] of sumAmounts(actual.spends)) {
    const reserved = reservedSpends.get(tokenId);
    if (reserved === undefined) {
      throw new Error(`settlement: actual spend for token ${tokenId} was not reserved`);
    }
    if (compareDecimal(amount, reserved) > 0) {
      throw new Error(`settlement: actual spend ${amount} exceeds reserved ${reserved} for token ${tokenId}`);
    }
  }

  const reservedFees = sumAmounts(reservedEffects?.fees ?? []);
  for (const [tokenId, amount] of sumAmounts(actual.fees ?? [])) {
    const reserved = reservedFees.get(tokenId);
    if (reserved === undefined) {
      throw new Error(`settlement: actual fee for token ${tokenId} was not reserved`);
    }
    if (compareDecimal(amount, reserved) > 0) {
      throw new Error(`settlement: actual fee ${amount} exceeds reserved ${reserved} for token ${tokenId}`);
    }
  }

  if (reservedUsageDeltas) {
    const reservedByMandate = new Map(reservedUsageDeltas.map((u) => [u.mandateId, u.delta]));
    for (const usage of actual.mandateUsage) {
      const reserved = reservedByMandate.get(usage.mandateId);
      if (!reserved) {
        throw new Error(`settlement: mandate ${usage.mandateId} was not reserved`);
      }
      if (!Number.isInteger(usage.count) || usage.count < 0) {
        throw new Error(`settlement: mandate ${usage.mandateId} count must be a non-negative integer`);
      }
      if (usage.count > reserved.count) {
        throw new Error(`settlement: mandate ${usage.mandateId} count ${usage.count} exceeds reserved ${reserved.count}`);
      }
      if (usage.amount !== undefined) {
        assertDecimalString(usage.amount, `mandate ${usage.mandateId} amount`);
        if (reserved.amount === undefined || compareDecimal(usage.amount, reserved.amount) > 0) {
          throw new Error(`settlement: mandate ${usage.mandateId} amount ${usage.amount} exceeds reserved`);
        }
      }
    }
  }
}

/** Validate a settlement instruction against the reservation it settles. */
export function assertSettlementInstruction(
  instruction: SettlementInstructionV1,
  reservedEffects?: StepEffects,
  reservedUsageDeltas?: ReservedUsageDelta[],
): void {
  if (instruction.schema !== 'totem:act:settlement/v1') {
    throw new Error(`settlement: unsupported schema ${String(instruction.schema)}`);
  }
  if (!instruction.reservationId) throw new Error('settlement: reservationId is required');
  if (!instruction.settlementId) throw new Error('settlement: settlementId is required');
  if (instruction.dispatchState === 'unknown') {
    throw new Error('settlement: cannot settle an operation with unknown dispatch state');
  }
  if ((instruction.terminalOutcome as string) === 'unknown') {
    throw new Error('settlement: cannot settle a non-terminal operation');
  }
  if (instruction.disposition === 'release-nonexecution' && instruction.dispatchState !== 'not-dispatched') {
    throw new Error('settlement: release-nonexecution requires not-dispatched evidence');
  }
  if (instruction.disposition === 'commit-reserved' && instruction.actual !== undefined) {
    throw new Error('settlement: commit-reserved cannot carry actual consumption');
  }
  if (instruction.disposition === 'settle-actual') {
    if (!instruction.actual) throw new Error('settlement: settle-actual requires actual consumption');
    if (instruction.actual.measurementStatus === 'unavailable') {
      throw new Error('settlement: unavailable measurements cannot settle as actual usage');
    }
    if (instruction.actual.schema !== 'totem:act:actual-consumption/v1') {
      throw new Error(`settlement: unsupported actual-consumption schema ${String(instruction.actual.schema)}`);
    }
    if (!Number.isInteger(instruction.actual.measuredAt) || instruction.actual.measuredAt < 0) {
      throw new Error('settlement: actual measuredAt must be a non-negative integer');
    }
    assertActualWithinReserved(instruction.actual, reservedEffects, reservedUsageDeltas);
  }
}

/** Sum reserved usage deltas for receipt accounting. */
export function sumReservedUsage(
  usageDeltas?: ReservedUsageDelta[],
): { count: number; amount?: string } {
  let count = 0;
  let amount: string | undefined;
  for (const usage of usageDeltas ?? []) {
    count += usage.delta.count;
    if (usage.delta.amount !== undefined) {
      amount = amount === undefined ? usage.delta.amount : addDecimal(amount, usage.delta.amount);
    }
  }
  return amount === undefined ? { count } : { count, amount };
}

/** Subtract actual from reserved, returning the unused capacity. */
export function releasedUsage(
  reserved: { count: number; amount?: string },
  actual?: { count: number; amount?: string },
): { count: number; amount?: string } {
  const count = Math.max(0, reserved.count - (actual?.count ?? 0));
  if (reserved.amount === undefined) return { count };
  const actualAmount = actual?.amount ?? '0';
  const remaining = compareDecimal(reserved.amount, actualAmount) > 0
    ? subtractDecimal(reserved.amount, actualAmount)
    : '0';
  return { count, amount: remaining };
}

function subtractDecimal(a: string, b: string): string {
  const [aWhole, aFrac = ''] = a.split('.');
  const [bWhole, bFrac = ''] = b.split('.');
  const scale = Math.max(aFrac.length, bFrac.length);
  const av = BigInt(aWhole + aFrac.padEnd(scale, '0'));
  const bv = BigInt(bWhole + bFrac.padEnd(scale, '0'));
  const diff = av > bv ? av - bv : 0n;
  const text = diff.toString().padStart(scale + 1, '0');
  if (scale === 0) return text;
  return `${text.slice(0, -scale)}.${text.slice(-scale)}`.replace(/\.?0+$/, '') || '0';
}

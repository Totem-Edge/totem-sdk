/**
 * RFC-058 — custody disclosure hard gate.
 *
 * Hosted (and trust-minimised) liquidity commitments must not be signed until
 * the user has seen the operator disclosure and explicitly acknowledged it.
 * The acknowledgement is bound to the disclosure hash/version so a different
 * disclosure cannot reuse it.
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';

export type CustodyMode = 'self' | 'trust-minimised' | 'hosted';

export interface CustodyDisclosure {
  mode: CustodyMode;
  operatorId?: string;
  legalEntity?: string;
  jurisdiction?: string;
  license?: string;
  keyManagement?: 'wallet' | 'kms' | 'hsm' | 'mpc' | 'host';
  canMoveFunds?: boolean;
  canFreeze?: boolean;
  operatorDiscretion?: boolean;
  withdrawalTerms?: string;
  receiptTransferability?: 'none' | 'restricted' | 'transferable';
  disclosureHash?: string;
  disclosureVersion?: string;
  disclosureUrl?: string;
  policySummary?: string;
  reason?: string;
  mitigation?: string;
}

export interface CustodyAcknowledgement {
  disclosureId: string;
  disclosureHash: string;
  disclosureVersion: string;
  acknowledgedAt: number;
}

export const CUSTODY_ACK_STORAGE_KEY = 'totem:custodyDisclosureAcks';

/** Hosted custody always requires a gate; self custody never does. */
export function requiresCustodyDisclosure(custody?: CustodyDisclosure | null): boolean {
  return custody?.mode === 'hosted' || custody?.mode === 'trust-minimised';
}

/** Validate the disclosure metadata before it can be acknowledged. */
export function validateCustodyDisclosure(custody: CustodyDisclosure): void {
  if (!custody || typeof custody !== 'object') throw new Error('custody disclosure is required');
  if (custody.mode !== 'self' && custody.mode !== 'trust-minimised' && custody.mode !== 'hosted') {
    throw new Error(`invalid custody mode: ${String(custody.mode)}`);
  }
  if (custody.mode === 'self') {
    if (custody.canMoveFunds || custody.canFreeze || custody.operatorDiscretion) {
      throw new Error('self custody cannot claim operator movement, freeze or discretion');
    }
    return;
  }
  if (custody.mode === 'trust-minimised') {
    if (!custody.reason) throw new Error('trust-minimised custody requires a reason');
    if (!custody.mitigation) throw new Error('trust-minimised custody requires a mitigation');
    return;
  }
  const required: Array<[keyof CustodyDisclosure, string]> = [
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
  if (custody.keyManagement === 'wallet') throw new Error('hosted custody cannot use wallet-only key management');
  for (const key of ['canMoveFunds', 'canFreeze', 'operatorDiscretion'] as const) {
    if (typeof custody[key] !== 'boolean') throw new Error(`hosted custody requires ${key} to be explicit`);
  }
}

/** Stable id binding an acknowledgement to the exact disclosure terms. */
export function custodyDisclosureId(custody: CustodyDisclosure): string {
  const canonical = [
    custody.mode,
    custody.operatorId ?? '',
    custody.legalEntity ?? '',
    custody.jurisdiction ?? '',
    custody.license ?? '',
    custody.keyManagement ?? '',
    custody.canMoveFunds === true ? '1' : '0',
    custody.canFreeze === true ? '1' : '0',
    custody.operatorDiscretion === true ? '1' : '0',
    custody.withdrawalTerms ?? '',
    custody.disclosureHash ?? '',
    custody.disclosureVersion ?? '',
    custody.policySummary ?? '',
    custody.reason ?? '',
    custody.mitigation ?? '',
  ].join('|');
  return '0x' + bytesToHex(sha3_256(new TextEncoder().encode(canonical)));
}

/** Human-readable risk lines shown before signing. */
export function custodyDisclosureWarnings(custody: CustodyDisclosure): string[] {
  if (!requiresCustodyDisclosure(custody)) return [];
  const warnings: string[] = [];
  if (custody.mode === 'hosted') {
    warnings.push('This is a hosted-custody commitment: an operator controls signing and may hold or move funds.');
    if (custody.canMoveFunds) warnings.push('The operator can move funds without your participation.');
    if (custody.canFreeze) warnings.push('The operator can freeze or delay withdrawals.');
    if (custody.operatorDiscretion) warnings.push('The operator has discretion over operations or payouts.');
    warnings.push('No yield, return or investment performance is promised.');
  } else {
    warnings.push('This commitment is trust-minimised, not fully self-custodial.');
  }
  if (custody.withdrawalTerms) warnings.push(`Withdrawal terms: ${custody.withdrawalTerms}`);
  return warnings;
}

type AckMap = Record<string, CustodyAcknowledgement>;

async function readAcks(): Promise<AckMap> {
  const storage = (globalThis as { chrome?: typeof chrome }).chrome?.storage?.local;
  if (!storage) return {};
  const stored = await storage.get(CUSTODY_ACK_STORAGE_KEY);
  return (stored?.[CUSTODY_ACK_STORAGE_KEY] as AckMap | undefined) ?? {};
}

async function writeAcks(acks: AckMap): Promise<void> {
  const storage = (globalThis as { chrome?: typeof chrome }).chrome?.storage?.local;
  if (!storage) return;
  await storage.set({ [CUSTODY_ACK_STORAGE_KEY]: acks });
}

/** Persist an acknowledgement for this exact disclosure. */
export async function acknowledgeCustodyDisclosure(
  custody: CustodyDisclosure,
  now = Date.now(),
): Promise<CustodyAcknowledgement> {
  validateCustodyDisclosure(custody);
  const id = custodyDisclosureId(custody);
  const ack: CustodyAcknowledgement = {
    disclosureId: id,
    disclosureHash: custody.disclosureHash ?? '',
    disclosureVersion: custody.disclosureVersion ?? '',
    acknowledgedAt: now,
  };
  const acks = await readAcks();
  acks[id] = ack;
  await writeAcks(acks);
  return ack;
}

/** True when this exact hosted/trust-minimised disclosure was acknowledged. */
export async function isCustodyDisclosureAcknowledged(custody: CustodyDisclosure): Promise<boolean> {
  if (!requiresCustodyDisclosure(custody)) return true;
  validateCustodyDisclosure(custody);
  const acks = await readAcks();
  return acks[custodyDisclosureId(custody)] !== undefined;
}

/** Fail closed before producing a signature. */
export async function assertCustodyDisclosureAcknowledged(custody: CustodyDisclosure): Promise<void> {
  if (!(await isCustodyDisclosureAcknowledged(custody))) {
    throw new Error('CUSTODY_DISCLOSURE_REQUIRED: the custody disclosure has not been acknowledged');
  }
}

/**
 * OMN-058 checkpoint mode (RFC-079 §4).
 *
 * A checkpoint consumes the current factory coin and recreates it at the same
 * script with the new allocation, an advanced sequence and refreshed
 * commitments. The previous version becomes unspendable, so the unilateral
 * escape always pays the latest checkpointed shares instead of the original
 * funding split.
 *
 * This is the enforceable baseline: it costs one on-chain transaction per
 * allocation change. The contestable off-chain design in RFC-079 §3 remains the
 * target once its remaining preconditions are proven.
 */

import type { OmniaTxDraft, StateValue, TxOutputDraft } from '@totemsdk/omnia';
import { MINIMA_DECIMALS } from '@totemsdk/core';

import {
  computeFactoryBalanceRoot,
  computeFactoryPartyRoot,
  FACTORY_BALANCE_PORT_BASE,
  FACTORY_BALANCE_ROOT_PORT,
  FACTORY_CHECKPOINT_SEQUENCE_PORT,
  FACTORY_ESCAPE_PORT,
  FACTORY_PARTY_ROOT_PORT,
} from './script.js';
import type { FactoryParticipant } from './types.js';

export interface FactoryCheckpointParams {
  participants: FactoryParticipant[];
  /** New per-party allocations in atoms. Must conserve `totalValue`. */
  allocations: Record<string, bigint>;
  tokenId: string;
  tokenScale: number;
  totalValue: bigint;
  /** Address and coin of the factory UTXO being consumed. */
  fundingAddress: string;
  fundingCoinId: string;
  /** Absolute escape block, carried forward from the committed state. */
  escapeBlock: bigint | number;
  /** New sequence; must be strictly greater than `previousSequence`. */
  sequence: bigint | number;
  previousSequence?: bigint | number;
  /** Previous state variables of the spent coin (for PREVSTATE continuity). */
  previousStateVariables?: StateValue[];
}

export interface FactoryCheckpoint {
  draft: OmniaTxDraft;
  output: TxOutputDraft;
  stateVariables: StateValue[];
  sequence: bigint;
  partyRoot: string;
  balanceRoot: string;
}

function toAtoms(value: bigint | number, label: string): bigint {
  const atoms = typeof value === 'bigint' ? value : BigInt(Math.trunc(value));
  if (atoms < 0n) throw new Error(`${label} must be non-negative`);
  return atoms;
}

/**
 * Build the state variables the successor factory coin must carry. Exported so
 * a verifier can recompute the commitment from a candidate transition.
 */
export function factoryCheckpointStateVariables(params: {
  participants: FactoryParticipant[];
  allocations: Record<string, bigint>;
  tokenId: string;
  totalValue: bigint;
  escapeBlock: bigint | number;
  sequence: bigint | number;
}): StateValue[] {
  const { participants, allocations } = params;
  if (participants.length === 0) throw new Error('factory checkpoint requires at least one participant');

  const expected = new Set(participants.map((party) => party.partyId));
  const actual = Object.keys(allocations);
  if (actual.length !== expected.size || actual.some((id) => !expected.has(id))) {
    throw new Error('checkpoint allocations must name exactly the factory participants');
  }

  let sum = 0n;
  const balanceVariables: StateValue[] = participants.map((party, index) => {
    const amount = allocations[party.partyId] ?? 0n;
    if (amount < 0n) throw new Error(`allocation for ${party.partyId} must be non-negative`);
    sum += amount;
    return {
      port: FACTORY_BALANCE_PORT_BASE + index,
      value: amount,
      type: 'number' as const,
      // Exact payout amounts read by the escape branch: scale 44, like a coin.
      scale: MINIMA_DECIMALS,
    };
  });
  if (sum !== params.totalValue) {
    throw new Error(`checkpoint allocations (${sum}) do not conserve the factory total (${params.totalValue})`);
  }

  return [
    ...balanceVariables,
    {
      port: FACTORY_CHECKPOINT_SEQUENCE_PORT,
      value: toAtoms(params.sequence, 'sequence'),
      type: 'number' as const,
    },
    {
      port: FACTORY_ESCAPE_PORT,
      value: toAtoms(params.escapeBlock, 'escapeBlock'),
      type: 'number' as const,
    },
    {
      port: FACTORY_PARTY_ROOT_PORT,
      value: computeFactoryPartyRoot(participants),
      type: 'hex' as const,
    },
    {
      port: FACTORY_BALANCE_ROOT_PORT,
      value: computeFactoryBalanceRoot(allocations),
      type: 'hex' as const,
    },
  ];
}

/**
 * Build the checkpoint transaction: one input (the factory coin), one successor
 * at the same script and value, carrying the new allocation and sequence.
 */
export function buildFactoryCheckpoint(params: FactoryCheckpointParams): FactoryCheckpoint {
  const sequence = toAtoms(params.sequence, 'sequence');
  if (params.previousSequence !== undefined
    && sequence <= toAtoms(params.previousSequence, 'previousSequence')) {
    throw new Error(
      `checkpoint sequence ${sequence} must be greater than ${params.previousSequence}`,
    );
  }

  const stateVariables = factoryCheckpointStateVariables({
    participants: params.participants,
    allocations: params.allocations,
    tokenId: params.tokenId,
    totalValue: params.totalValue,
    escapeBlock: params.escapeBlock,
    sequence,
  });

  const output: TxOutputDraft = {
    address: params.fundingAddress,
    amount: params.totalValue,
    tokenId: params.tokenId,
    storeState: true,
    stateVariables,
  };

  const draft: OmniaTxDraft = {
    type: 'update',
    inputs: [{
      coinId: params.fundingCoinId,
      address: params.fundingAddress,
      amount: params.totalValue,
      tokenId: params.tokenId,
      scriptHex: '',
      storeState: true,
      ...(params.previousStateVariables ? { stateVariables: params.previousStateVariables } : {}),
    }],
    outputs: [output],
    storeState: true,
    stateVariables,
  };

  return {
    draft,
    output,
    stateVariables,
    sequence,
    partyRoot: computeFactoryPartyRoot(params.participants),
    balanceRoot: computeFactoryBalanceRoot(params.allocations),
  };
}

export interface FactoryCheckpointSnapshot {
  address: string;
  tokenId: string;
  totalValue: bigint;
  sequence: bigint;
  partyRoot: string;
  balanceRoot: string;
  allocations: Record<string, bigint>;
}

/**
 * Validate a candidate checkpoint against the state it replaces. This is the
 * rule the covenant enforces on chain; running it here lets the SDK refuse to
 * build a transition the node would reject.
 */
export function assertFactoryCheckpointTransition(
  before: FactoryCheckpointSnapshot,
  after: FactoryCheckpointSnapshot,
): void {
  if (after.address !== before.address) {
    throw new Error('factory checkpoint must stay at the same script address');
  }
  if (after.tokenId !== before.tokenId) {
    throw new Error('factory checkpoint must preserve the token');
  }
  if (after.totalValue !== before.totalValue) {
    throw new Error('factory checkpoint must conserve the factory value');
  }
  if (after.sequence <= before.sequence) {
    throw new Error(`factory checkpoint sequence ${after.sequence} must advance from ${before.sequence}`);
  }
  if (after.partyRoot !== before.partyRoot) {
    throw new Error('factory checkpoint must preserve the committed party set');
  }
  const beforeKeys = Object.keys(before.allocations).sort();
  const afterKeys = Object.keys(after.allocations).sort();
  if (beforeKeys.join(',') !== afterKeys.join(',')) {
    throw new Error('factory checkpoint must preserve the participant set');
  }
  let sum = 0n;
  for (const key of afterKeys) {
    if (after.allocations[key] < 0n) throw new Error(`allocation for ${key} must be non-negative`);
    sum += after.allocations[key];
  }
  if (sum !== after.totalValue) {
    throw new Error(`factory checkpoint allocations (${sum}) do not conserve ${after.totalValue}`);
  }
  if (after.balanceRoot !== computeFactoryBalanceRoot(after.allocations)) {
    throw new Error('factory checkpoint balance root does not commit the new allocations');
  }
}

/** Snapshot helper for the state a checkpoint would produce. */
export function factoryCheckpointSnapshot(
  checkpoint: FactoryCheckpoint,
  participants: FactoryParticipant[],
): FactoryCheckpointSnapshot {
  const allocations: Record<string, bigint> = {};
  participants.forEach((party, index) => {
    const variable = checkpoint.stateVariables.find(
      (entry) => entry.port === FACTORY_BALANCE_PORT_BASE + index,
    );
    allocations[party.partyId] = BigInt((variable?.value ?? 0n) as string | bigint);
  });
  return {
    address: checkpoint.output.address,
    tokenId: checkpoint.output.tokenId,
    totalValue: checkpoint.output.amount,
    sequence: checkpoint.sequence,
    partyRoot: checkpoint.partyRoot,
    balanceRoot: checkpoint.balanceRoot,
    allocations,
  };
}

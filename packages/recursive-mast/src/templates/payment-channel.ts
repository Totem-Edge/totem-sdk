/**
 * Payment Channel Policy Template — policy-gated channel state transitions
 * using PREVSTATE and recursive MAST.
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 *
 * This template provides authorization and covenant helpers for
 * sequence-numbered channel state transitions. The canonical channel
 * update, dispute and settlement protocol remains the responsibility
 * of @totemsdk/omnia.
 *
 * This function does NOT independently implement the full Omnia
 * latest-state-wins (Eltoo/LN-Symmetry) protocol. It is a policy
 * wrapper that Omnia can consume for multi-party authorization.
 *
 * Use case: omnia, omnia-router, omnia-splice, omnia-factory
 *
 * Workflow:
 *   1. Channel state is verified (sequence, balances, HTLCs)
 *   2. Both parties' WOTS signatures are verified
 *   3. PREVSTATE enforces sequence monotonicity
 *   4. Policy root authorizes the channel's governing rules
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PrevStateWorkflow } from '../types.js';
import { buildPrevStateWorkflow, buildStateTransition } from '../prevstate.js';

export interface PaymentChannelConfig {
  /** Channel identifier. */
  channelId: string;
  /** Party A's public key digest. */
  partyAPkd: string;
  /** Party B's public key digest. */
  partyBPkd: string;
  /** STATE port for sequence number. */
  sequencePort: number;
  /** STATE port for settlement flag. */
  settlementPort: number;
  /** The policy root governing this channel. */
  policyRoot: string;
  /** Merkle proof that the channel script is in the policy root. */
  channelProof: string;
}

/**
 * Build a KISSVM policy script for sequence-numbered channel state
 * transitions. This function does NOT independently implement the full
 * Omnia latest-state-wins (Eltoo/LN-Symmetry) protocol.
 *
 * The script:
 *   1. Reads previous sequence from PREVSTATE
 *   2. Validates new sequence > previous sequence
 *   3. Verifies MULTISIG(2) from both parties
 *   4. If settlement flag is set, verifies settlement conditions
 *   5. Delegates to policy root for governance rules
 */
export function buildPaymentChannelScript(config: PaymentChannelConfig): string {
  return [
    `// Payment channel: ${config.channelId}`,
    `LET prevSeq = PREVSTATE(${config.sequencePort})`,
    `LET newSeq = STATE(${config.sequencePort})`,
    `LET settlement = STATE(${config.settlementPort})`,
    `LET partyA = 0x${config.partyAPkd}`,
    `LET partyB = 0x${config.partyBPkd}`,
    ``,
    `// 1. Sequence must increase`,
    `ASSERT newSeq GT prevSeq`,
    ``,
    `// 2. Both parties must sign`,
    `ASSERT MULTISIG(2 partyA partyB)`,
    ``,
    `// 3. Settlement path`,
    `IF settlement THEN`,
    `  ASSERT @BLOCK GTE STATE(102)`,
    `  ASSERT VERIFYOUT(@INPUT partyA STATE(103) @TOKENID TRUE)`,
    `  ASSERT VERIFYOUT(INC(@INPUT) partyB STATE(104) @TOKENID TRUE)`,
    `  RETURN TRUE`,
    `ENDIF`,
    ``,
    `// 4. Update path — delegate to governance policy`,
    `MAST 0x${config.policyRoot}`,
    ``,
    `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
    `RETURN TRUE`,
  ].join('\n');
}

/**
 * Build a PREVSTATE workflow for payment channel state updates.
 */
export function buildPaymentChannelWorkflow(config: PaymentChannelConfig): PrevStateWorkflow {
  return buildPrevStateWorkflow(
    `channel-${config.channelId}`,
    `Payment Channel ${config.channelId}`,
    [
      buildStateTransition(config.sequencePort, 'sequence', 'newSeq', 'prevSeq', 'newSeq'),
      buildStateTransition(config.settlementPort, 'settlement', 'settlement', 'prevSettlement', 'settlement'),
    ],
    buildPaymentChannelScript(config),
  );
}

/**
 * Build a channel factory funding script with recursive MAST.
 * N-of-N MULTISIG with policy-governed channel creation.
 */
export function buildChannelFactoryScript(
  partyPkds: string[],
  policyRoot: string,
  factoryProof: string,
): string {
  const pkList = partyPkds.map(pk => `0x${pk}`).join(' ');
  return [
    `// Channel factory: ${partyPkds.length}-of-${partyPkds.length} MULTISIG`,
    `ASSERT MULTISIG(${partyPkds.length} ${pkList})`,
    ``,
    `// Channel creation governed by factory policy`,
    `ASSERT PROOF(STATE(0) 0 0x${policyRoot} 0 0x${factoryProof})`,
    `MAST 0x0000000000000000000000000000000000000000000000000000000000000000`,
    ``,
    `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
    `RETURN TRUE`,
  ].join('\n');
}

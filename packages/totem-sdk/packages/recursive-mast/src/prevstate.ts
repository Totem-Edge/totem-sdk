/**
 * PREVSTATE workflow builder — constructs state transition workflows
 * using Minima's PREVSTATE opcode. PREVSTATE(port) reads the previous
 * transaction's state variable at the given port, enabling stateful
 * contracts that evolve across transactions.
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { StateTransition, PrevStateWorkflow } from './types.js';

function hashScript(script: string): string {
  return bytesToHex(sha3_256(new TextEncoder().encode(script)));
}

/**
 * Build a single state transition definition.
 *
 * @param port - STATE/PREVSTATE port number.
 * @param name - Human-readable name.
 * @param currentValue - Current state value.
 * @param previousValue - Previous state value (from PREVSTATE).
 * @param transition - Description of the transition function.
 */
export function buildStateTransition(
  port: number,
  name: string,
  currentValue: string,
  previousValue: string,
  transition: string,
): StateTransition {
  return { port, name, currentValue, previousValue, transition, valid: true };
}

/**
 * Build a complete PREVSTATE workflow from a list of transitions.
 *
 * @param id - Workflow identifier.
 * @param name - Human-readable name.
 * @param transitions - Ordered list of state transitions.
 * @param additionalScript - Additional KISSVM script logic (assertions, verifications).
 */
export function buildPrevStateWorkflow(
  id: string,
  name: string,
  transitions: StateTransition[],
  additionalScript: string = '',
): PrevStateWorkflow {
  const scriptLines: string[] = [];

  for (const t of transitions) {
    scriptLines.push(`LET prev_${t.name} = PREVSTATE(${t.port})`);
    scriptLines.push(`LET curr_${t.name} = STATE(${t.port})`);
    scriptLines.push(`ASSERT curr_${t.name} EQ ${t.transition}`);
  }

  if (additionalScript) {
    scriptLines.push(additionalScript);
  }

  const script = scriptLines.join('\n');
  const scriptHash = hashScript(script);

  return { id, name, transitions, script, scriptHash };
}

/**
 * Generate a KISSVM script for a counter that increments on each transaction.
 *
 * @param port - STATE port for the counter.
 * @param maxValue - Optional maximum value (inclusive).
 */
export function counterWorkflow(port: number, maxValue?: number): PrevStateWorkflow {
  const maxCheck = maxValue !== undefined ? `\nASSERT STATE(${port}) LTE ${maxValue}` : '';
  const script = [
    `LET prev = PREVSTATE(${port})`,
    `LET curr = STATE(${port})`,
    `ASSERT curr EQ INC(prev)`,
    maxCheck,
  ].filter(Boolean).join('\n');

  return {
    id: `counter-${port}`,
    name: `Counter at port ${port}`,
    transitions: [buildStateTransition(port, 'counter', 'INC(prev)', 'prev', 'INC(prev)')],
    script,
    scriptHash: hashScript(script),
  };
}

/**
 * Generate a KISSVM script for a vesting schedule.
 *
 * @param startPort - STATE port for vesting start block.
 * @param totalPort - STATE port for total vested amount.
 * @param claimedPort - STATE port for previously claimed amount.
 * @param beneficiaryPk - Public key of the beneficiary.
 */
export function vestingWorkflow(
  startPort: number,
  totalPort: number,
  claimedPort: number,
  beneficiaryPk: string,
): PrevStateWorkflow {
  const script = [
    `LET vestStart = PREVSTATE(${startPort})`,
    `LET total = PREVSTATE(${totalPort})`,
    `LET prevClaimed = PREVSTATE(${claimedPort})`,
    `LET elapsed = SUB(@BLOCK vestStart)`,
    `LET vested = DIV(MUL(total elapsed) total)`,
    `LET claimable = SUB(vested prevClaimed)`,
    `ASSERT @BLOCK GT vestStart`,
    `ASSERT claimable GT 0`,
    `ASSERT SIGNEDBY(0x${beneficiaryPk})`,
    `ASSERT VERIFYOUT(@INPUT 0x${beneficiaryPk} claimable @TOKENID TRUE)`,
  ].join('\n');

  return {
    id: `vesting-${startPort}`,
    name: `Vesting schedule at ports ${startPort}/${totalPort}/${claimedPort}`,
    transitions: [
      buildStateTransition(startPort, 'vestStart', 'vestStart', 'vestStart', 'vestStart'),
      buildStateTransition(totalPort, 'total', 'total', 'total', 'total'),
      buildStateTransition(claimedPort, 'claimed', 'INC(prevClaimed)', 'prevClaimed', 'INC(prevClaimed)'),
    ],
    script,
    scriptHash: hashScript(script),
  };
}

/**
 * Generate a KISSVM script for a round-based game or voting system.
 *
 * @param roundPort - STATE port for the current round number.
 * @param pk1 - First participant's public key.
 * @param pk2 - Second participant's public key.
 */
export function roundBasedWorkflow(
  roundPort: number,
  pk1: string,
  pk2: string,
): PrevStateWorkflow {
  const script = [
    `LET round = STATE(${roundPort})`,
    `LET prevRound = PREVSTATE(${roundPort})`,
    `ASSERT round EQ INC(prevRound)`,
    `ASSERT SIGNEDBY(0x${pk1}) OR SIGNEDBY(0x${pk2})`,
    `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
  ].join('\n');

  return {
    id: `round-${roundPort}`,
    name: `Round-based workflow at port ${roundPort}`,
    transitions: [buildStateTransition(roundPort, 'round', 'INC(prevRound)', 'prevRound', 'INC(prevRound)')],
    script,
    scriptHash: hashScript(script),
  };
}

/**
 * Generate a KISSVM script for a time-locked withdrawal.
 *
 * @param lockPort - STATE port for the lock expiry block.
 * @param ownerPk - Public key of the owner.
 */
export function timelockWorkflow(
  lockPort: number,
  ownerPk: string,
): PrevStateWorkflow {
  const script = [
    `LET lockBlock = PREVSTATE(${lockPort})`,
    `ASSERT @BLOCK GTE lockBlock`,
    `ASSERT SIGNEDBY(0x${ownerPk})`,
    `ASSERT VERIFYOUT(@INPUT 0x${ownerPk} @AMOUNT @TOKENID TRUE)`,
  ].join('\n');

  return {
    id: `timelock-${lockPort}`,
    name: `Time-locked withdrawal at port ${lockPort}`,
    transitions: [buildStateTransition(lockPort, 'lockBlock', 'lockBlock', 'lockBlock', 'lockBlock')],
    script,
    scriptHash: hashScript(script),
  };
}

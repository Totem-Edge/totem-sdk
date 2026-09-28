/**
 * PREVSTATE workflow builder — constructs state transition workflows
 * using Minima's PREVSTATE opcode. PREVSTATE(port) reads the previous
 * transaction's state variable at the given port, enabling stateful
 * contracts that evolve across transactions.
 */

import { computeCanonicalScriptHash } from './mast-compiler.js';
import type { StateTransition, PrevStateWorkflow } from './types.js';

// RFC-016 P2: canonical MMR leaf hash.
function hashScript(script: string): string {
  return computeCanonicalScriptHash(script);
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
  // RFC-018 P2-2: an empty workflow must fail construction, not emit allow-all.
  if (transitions.length === 0 && !additionalScript) {
    throw new Error('buildPrevStateWorkflow: requires at least one transition or an additional script');
  }

  const scriptLines: string[] = [];

  for (const t of transitions) {
    scriptLines.push(`LET prev_${t.name} = PREVSTATE(${t.port})`);
    scriptLines.push(`LET curr_${t.name} = STATE(${t.port})`);
    scriptLines.push(`ASSERT curr_${t.name} EQ ${t.transition}`);
  }

  if (additionalScript) {
    scriptLines.push(additionalScript);
  }

  // RFC-018 P2-2: a workflow script must be a complete, terminal script.
  // Append only if the additional script does not already terminate in RETURN
  // (avoids a double RETURN that would make an appended child MAST unreachable).
  const body = scriptLines.join('\n');
  const script = /(?:^|\n)\s*RETURN\b[^\n]*\s*$/i.test(body) ? body : `${body}\nRETURN TRUE`;

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
    `RETURN TRUE`,
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
  endPort: number,
  totalPort: number,
  claimedPort: number,
  beneficiaryPk: string,
): PrevStateWorkflow {
  // RFC-016 hardening: correct linear vesting. Previously `vested = total *
  // elapsed / total` reduced to `elapsed`, ignored an end/duration, and never
  // enforced the claimed-state transition it advertises.
  const script = [
    `LET vestStart = PREVSTATE(${startPort})`,
    `LET vestEnd = PREVSTATE(${endPort})`,
    `LET total = PREVSTATE(${totalPort})`,
    `ASSERT STATE(${startPort}) EQ vestStart`,
    `ASSERT STATE(${endPort}) EQ vestEnd`,
    `ASSERT STATE(${totalPort}) EQ total`,
    `LET prevClaimed = PREVSTATE(${claimedPort})`,
    `LET elapsed = @BLOCK SUB vestStart`,
    `LET duration = vestEnd SUB vestStart`,
    `IF elapsed GTE duration THEN`,
    `  LET vested = total`,
    `ELSE`,
    `  LET vested = total MUL elapsed DIV duration`,
    `ENDIF`,
    `LET claimable = vested SUB prevClaimed`,
    `ASSERT @BLOCK GT vestStart`,
    `ASSERT claimable GT 0`,
    `ASSERT prevClaimed ADD claimable LTE total`,
    `ASSERT SIGNEDBY(0x${beneficiaryPk})`,
    `ASSERT VERIFYOUT(@INPUT 0x${beneficiaryPk} claimable @TOKENID TRUE)`,
    `ASSERT STATE(${claimedPort}) EQ prevClaimed ADD claimable`,
    `RETURN TRUE`,
  ].join('\n');

  return {
    id: `vesting-${startPort}`,
    name: `Vesting schedule at ports ${startPort}/${endPort}/${totalPort}/${claimedPort}`,
    transitions: [
      buildStateTransition(startPort, 'vestStart', 'vestStart', 'vestStart', 'vestStart'),
      buildStateTransition(endPort, 'vestEnd', 'vestEnd', 'vestEnd', 'vestEnd'),
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
    `RETURN TRUE`,
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
    `RETURN TRUE`,
  ].join('\n');

  return {
    id: `timelock-${lockPort}`,
    name: `Time-locked withdrawal at port ${lockPort}`,
    transitions: [buildStateTransition(lockPort, 'lockBlock', 'lockBlock', 'lockBlock', 'lockBlock')],
    script,
    scriptHash: hashScript(script),
  };
}

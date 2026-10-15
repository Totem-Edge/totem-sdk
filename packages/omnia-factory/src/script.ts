import { computeScriptAddress } from '@totemsdk/core/scripts';
import type { FactoryParticipant } from './types.js';

/**
 * Normalize a hex public key digest to the KISSVM-compatible format:
 * strip leading 0x/0X and render as upper-case hex with leading '0X'.
 */
function kissHex(hex: string): string {
  const raw = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  return '0X' + raw.toUpperCase();
}

/** Default coinage (blocks) after which any party may unilaterally withdraw. */
export const FACTORY_TIMEOUT_BLOCKS = 256;

/** State port base for per-party allocations: party k ⇒ port 200+k. */
export const FACTORY_BALANCE_PORT_BASE = 200;

export interface FactoryScriptOptions {
  /** Coinage threshold for the unilateral per-party escape (default 256). */
  timeoutBlocks?: number;
}

/**
 * Per-party allocation state variables (port 200+k = party k's balance), seeded
 * into the factory funding output so the timeout escape can pay each party its
 * committed share.
 */
export function factoryBalanceStateVariables(
  participants: FactoryParticipant[],
): { port: number; value: bigint; type: 'number' }[] {
  return participants.map((p, k) => ({
    port: FACTORY_BALANCE_PORT_BASE + k,
    value: p.contributionAmount,
    type: 'number' as const,
  }));
}

/**
 * Build the N-of-N MULTISIG MAST funding script for a channel factory
 * (RFC-039, CUSTODY-POLICY §2).
 *
 * Spend paths:
 *   - **Cooperative / update** (any time): `MULTISIG(N …)` — all parties sign.
 *     `SETTLEMENT=true` closes after minimal coinage (1 block).
 *   - **Unilateral escape** (after `@COINAGE GTE timeoutBlocks`): any single
 *     party k may withdraw its allocation `SHARE_k = STATE(200+k)` to its own
 *     settlement address, zero its state (`STATE(200+k) EQ 0`), keep the other
 *     parties' balances unchanged, and return the remainder to the factory
 *     script. Repeated withdrawals cannot double-claim because each zeroes its
 *     own port.
 *
 * Minimum 2 participants required.
 */
export function buildFactoryScript(
  participants: FactoryParticipant[],
  options: FactoryScriptOptions = {},
): string {
  if (participants.length < 2) {
    throw new Error(`Factory requires at least 2 participants, got ${participants.length}`);
  }
  const count = participants.length;
  const timeout = options.timeoutBlocks ?? FACTORY_TIMEOUT_BLOCKS;
  if (!Number.isInteger(timeout) || timeout < 0) {
    throw new Error(`timeoutBlocks must be a non-negative integer, got ${JSON.stringify(timeout)}`);
  }

  const pks = participants.map((p) => kissHex(p.publicKeyDigest));
  const payouts = participants.map((p) => kissHex(p.settlementAddress ?? p.publicKeyDigest));

  const lines: string[] = [
    'LET SETTLEMENT=STATE(100)',
    `IF @COINAGE GTE ${timeout} THEN`,
  ];

  participants.forEach((_, k) => {
    const port = FACTORY_BALANCE_PORT_BASE + k;
    lines.push(`  LET SHARE${k}=STATE(${port})`);
    lines.push(`  IF SIGNEDBY(${pks[k]}) THEN`);
    lines.push(`    IF SHARE${k} GT 0 THEN`);
    lines.push(`      ASSERT VERIFYOUT(0 ${payouts[k]} SHARE${k} @TOKENID FALSE)`);
    for (let j = 0; j < count; j++) {
      if (j === k) continue;
      lines.push(`      ASSERT STATE(${FACTORY_BALANCE_PORT_BASE + j}) EQ PREVSTATE(${FACTORY_BALANCE_PORT_BASE + j})`);
    }
    lines.push(`      ASSERT STATE(${port}) EQ 0`);
    lines.push(`      RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT SUB SHARE${k} @TOKENID TRUE)`);
    lines.push('    ENDIF');
    lines.push('  ENDIF');
  });

  lines.push('ENDIF');
  lines.push(`ASSERT MULTISIG(${count} ${pks.join(' ')})`);
  lines.push('IF SETTLEMENT THEN');
  lines.push('    IF @COINAGE GTE 1 THEN RETURN TRUE ENDIF');
  lines.push('ELSE');
  lines.push('    RETURN TRUE');
  lines.push('ENDIF');

  return lines.join('\n');
}

export function normalizeScript(script: string): string {
  return script.trim().toUpperCase();
}

/** Compute the SHA3-256 script-hash address for a factory script. */
export function scriptAddress(script: string): string {
  return computeScriptAddress(script);
}

/**
 * Build the factory script and compute its canonical address in one step.
 * The address is used as the output address of the factory funding TX.
 */
export function buildAndHashFactoryScript(
  participants: FactoryParticipant[],
  options: FactoryScriptOptions = {},
): {
  script: string;
  address: string;
} {
  const script = buildFactoryScript(participants, options);
  const address = scriptAddress(script);
  return { script, address };
}

/**
 * VTXO pool on-chain script (RFC-038 V3 — per-share non-custodial).
 *
 * The pool is an on-chain state output holding `totalCapacity`. An epoch's batch
 * root is committed as STATE(100), the epoch number in STATE(101), the absolute
 * exit-eligibility block in STATE(102), and each holder's committed share in
 * STATE(200+k).
 *
 * Custody (RFC-039 / CUSTODY-POLICY §2):
 *   - **Per-share unilateral exit.** After `@BLOCK GT PREVSTATE(102)` each holder
 *     may withdraw **only its own committed share** (`PREVSTATE(200+k)`, the spent
 *     coin's share), to its own key, zeroing that share in the successor
 *     (`STATE(200+k) EQ 0`) and returning the remainder to the pool. A holder
 *     cannot pay itself more than its share, so one holder can never rug the others.
 *   - **Cooperative update.** Before the exit window the pool may only move by
 *     `MULTISIG(operator + all holders)`, epoch-monotone (`ASSERT EPOCH GT
 *     PREVSTATE(101)`), with the exit block immutable (`ASSERT SAMESTATE(102
 *     102)`) so no one can push the escape clock, and value confined to the same
 *     script address (`ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`)
 *     so the operator can never pay itself.
 *
 * The operator holds no unilateral path: it cannot move funds, cannot advance the
 * exit block, and cannot stop a holder's exit. It is a liveness-only peer.
 */

import { computeScriptAddress } from '@totemsdk/core';

/** State port base for per-holder shares: holder k ⇒ port 200+k (ports are bytes, ≤255). */
export const POOL_SHARE_PORT_BASE = 200;

export interface PoolScriptParams {
  /** Operator WOTS public-key digest (64 hex). */
  operatorPublicKeyDigest: string;
  /** Holder WOTS public-key digests (64 hex), one per beneficial owner. */
  holders: string[];
  /** Absolute block height after which holders may exit unilaterally. */
  exitBlock: number;
}

function pkHex(digest: string, label: string): string {
  const raw = digest.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(`${label} public key digest must be 64 hex chars, got ${JSON.stringify(digest)}`);
  }
  return '0X' + raw.toUpperCase();
}

/** Per-share-constrained, epoch-monotone, state-carrying pool script. */
export function buildPoolScript(params: PoolScriptParams): string {
  const operator = pkHex(params.operatorPublicKeyDigest, 'operator');
  if (!Array.isArray(params.holders) || params.holders.length < 1) {
    throw new Error('pool requires at least one holder');
  }
  const holders = params.holders.map((h, i) => pkHex(h, `holder[${i}]`));
  if (!Number.isInteger(params.exitBlock) || params.exitBlock < 0) {
    throw new Error(`exitBlock must be a non-negative integer, got ${JSON.stringify(params.exitBlock)}`);
  }

  const lines: string[] = [
    'LET EPOCH=STATE(101)',
    'LET EXITBLOCK=PREVSTATE(102)',
    'IF @BLOCK GT EXITBLOCK THEN',
  ];

  holders.forEach((holder, k) => {
    const port = POOL_SHARE_PORT_BASE + k;
    lines.push(`  LET SHARE${k}=PREVSTATE(${port})`);
    lines.push(`  IF SIGNEDBY(${holder}) THEN`);
    lines.push(`    IF SHARE${k} GT 0 THEN`);
    lines.push(`      ASSERT VERIFYOUT(0 ${holder} SHARE${k} @TOKENID FALSE)`);
    for (let j = 0; j < holders.length; j++) {
      if (j === k) continue;
      lines.push(`      ASSERT STATE(${POOL_SHARE_PORT_BASE + j}) EQ PREVSTATE(${POOL_SHARE_PORT_BASE + j})`);
    }
    lines.push(`      ASSERT STATE(${port}) EQ 0`);
    // Remainder (other holders' shares) stays in the pool; skip it when the
    // withdrawing holder's share is the whole pool (no room for another output).
    lines.push(`      IF @AMOUNT GT SHARE${k} THEN`);
    lines.push(`        RETURN VERIFYOUT(1 @ADDRESS @AMOUNT SUB SHARE${k} @TOKENID TRUE)`);
    lines.push('      ENDIF');
    lines.push('      RETURN TRUE');
    lines.push('    ENDIF');
    lines.push('  ENDIF');
  });

  lines.push('ENDIF');
  lines.push('ASSERT EPOCH GT PREVSTATE(101)');
  lines.push('ASSERT SAMESTATE(102 102)');
  lines.push('ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)');
  lines.push(`RETURN MULTISIG(${holders.length + 1} ${operator} ${holders.join(' ')})`);

  return lines.join('\n');
}

export function poolScriptAddress(script: string): string {
  return computeScriptAddress(script);
}

export function buildAndHashPoolScript(params: PoolScriptParams): { script: string; address: string } {
  const script = buildPoolScript(params);
  return { script, address: poolScriptAddress(script) };
}

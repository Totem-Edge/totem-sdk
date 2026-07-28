import { computeScriptAddress } from '@totemsdk/core';

export const RECLAIM_TIMELOCK = 256;

function kissHex(h: string): string {
  const raw = h.startsWith('0x') || h.startsWith('0X') ? h.slice(2) : h;
  return '0X' + raw.toUpperCase();
}

/**
 * MULTISIG(2) locking script for the state chain UTXO.
 *
 * The owner key is read from STATE(0) of the coin being spent.
 * This allows any current owner to authorize a spend without changing the
 * locking script or address — only the coin's stored state changes on each
 * ownership transfer.
 *
 * Normal path  (any time):   requires MULTISIG(2 STATE(0) SE) signatures.
 * Reclaim path (after COINAGE >= RECLAIM_TIMELOCK): owner can reclaim
 *   unilaterally with just SIGNEDBY(STATE(0)) — no SE signature required.
 *
 * @param sePkd  - SE's WOTS public key digest (hardcoded in script, fixed per SE).
 */
export function buildStatechainScript(sePkd: string): string {
  return [
    `LET OWNER=STATE(0)`,
    `IF @COINAGE GTE ${RECLAIM_TIMELOCK} THEN`,
    `  RETURN SIGNEDBY(OWNER)`,
    `ENDIF`,
    `ASSERT MULTISIG(2 OWNER ${kissHex(sePkd)})`,
    `RETURN TRUE`,
  ].join('\n');
}

export function normalizeScript(script: string): string {
  return script.trim().toUpperCase();
}

export function scriptAddress(script: string): string {
  return computeScriptAddress(script);
}

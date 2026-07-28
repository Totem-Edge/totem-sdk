import { computeScriptAddress } from '@totemsdk/core';
import type { ChannelParticipant } from './types.js';

const COINID_ELTOO = '0x01';

function kissHex(hex: string): string {
  const raw = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  return '0X' + raw.toUpperCase();
}

export function buildEltooScript(parties: ChannelParticipant[]): string {
  if (parties.length !== 2) {
    throw new Error(`v0.1.0 supports exactly 2 parties, got ${parties.length}`);
  }
  const [a, b] = parties;
  const pkA = kissHex(a.publicKeyDigest);
  const pkB = kissHex(b.publicKeyDigest);

  const script = [
    'LET SETTLEMENT=STATE(100)',
    'LET SEQUENCE=STATE(101)',
    'LET PREVSEQUENCE=PREVSTATE(101)',
    `ASSERT MULTISIG(2 ${pkA} ${pkB})`,
    'IF SETTLEMENT THEN',
    '    IF SEQUENCE EQ PREVSEQUENCE AND @COINAGE GTE 256 THEN RETURN TRUE ENDIF',
    'ELSE',
    '    IF SEQUENCE GT PREVSEQUENCE THEN RETURN TRUE ENDIF',
    'ENDIF',
  ].join('\n');

  return script;
}

export function normalizeScript(script: string): string {
  return script.trim().toUpperCase();
}

export function scriptAddress(script: string): string {
  return computeScriptAddress(script);
}

export function buildAndHashEltooScript(parties: ChannelParticipant[]): { script: string; address: string } {
  const script = buildEltooScript(parties);
  const address = scriptAddress(script);
  return { script, address };
}

export { COINID_ELTOO };

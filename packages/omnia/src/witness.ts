import { concat, writeMiniNumber } from '@totemsdk/core';
import type { SignedChannelState } from './types.js';
import { assertBroadcastProofs as assertTxBroadcastProofs, serializeDraftWitness } from '@totemsdk/tx-builder';

export interface OmniaWitnessProofs {
  /** Serialized Minima CoinProof bytes, one per spending input. */
  coinProofs: Uint8Array[];
  /** Serialized Minima ScriptProof bytes required by the input scripts. */
  scriptProofs: Uint8Array[];
}

export interface OmniaWitnessOptions extends OmniaWitnessProofs {
  /** Serialized Minima Signature objects. Must match the transaction digest being broadcast. */
  signatures: Uint8Array[];
}

function serializeProofList(items: Uint8Array[]): Uint8Array[] {
  return [writeMiniNumber(BigInt(items.length), 0), ...items];
}

export function serializeOmniaWitness(options: OmniaWitnessOptions): Uint8Array {
  return serializeDraftWitness(options);
}

export function assertBroadcastProofs(proofs?: Partial<OmniaWitnessProofs>): asserts proofs is OmniaWitnessProofs {
  assertTxBroadcastProofs(proofs);
}

/**
 * Close-package signatures in `MULTISIG` key order.
 *
 * Minima verifies `MULTISIG(n pkA pkB …)` against the witness in key order, so
 * the witness must follow the channel's party order, never object insertion order.
 */
export function closePackageSignatureBytes(
  state: SignedChannelState,
  tx: 'update' | 'settlement',
  partyOrder?: string[],
): Uint8Array[] {
  const closePackage = state.closePackage;
  if (!closePackage) throw new Error('Missing close package for witness assembly');
  const artifact = closePackage[tx];
  if (!partyOrder) return Object.values(artifact.signatures);
  return partyOrder
    .map(partyId => artifact.signatures[partyId])
    .filter((sig): sig is Uint8Array => sig instanceof Uint8Array);
}

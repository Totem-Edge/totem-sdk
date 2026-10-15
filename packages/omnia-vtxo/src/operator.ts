/**
 * VTXO operator co-signature (RFC-038 V0).
 *
 * The operator signs the canonical batch commitment with a unified WOTS
 * `TreeKey` (RFC-037), allocating one leaf per signature under a WOTS lease
 * (RFC-013). This retires the mock operator-signature placeholder: a receipt's
 * `signature` is now a real serialized `TreeSignature` over the commitment, and
 * `verify` checks it against the operator's tree-root public key.
 *
 * The operator's identity is the TreeKey root public key, so a holder can verify
 * a receipt without trusting transport identity.
 */

import {
  bytesToHex,
  deserializeTreeSignature,
  hexToBytes,
  serializeTreeSignature,
  sha3_256,
  verifyTreeSignature,
  type TreeKey,
} from '@totemsdk/core';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import type { OmniaVtxoOperator } from './types.js';

/** Keys per tree level — the flat leaf index is `l1 * KEYS_PER_LEVEL + l2`. */
const KEYS_PER_LEVEL = 64;

/** Lease treeId for a pool's operator signatures. */
export function vtxoOperatorTreeId(poolId: string): string {
  return `omnia-vtxo:${poolId}`;
}

export interface VtxoOperatorOptions {
  poolId: string;
  /** The operator's unified WOTS TreeKey (RFC-037). */
  treeKey: TreeKey;
  /** Lease provider for one-time leaf allocation (RFC-013). */
  leaseProvider: WotsLeaseProvider;
}

export interface VtxoOperatorWithIdentity extends OmniaVtxoOperator {
  /** The operator's tree-root public key (its identity). */
  readonly publicKey: string;
}

export function createVtxoOperator(options: VtxoOperatorOptions): VtxoOperatorWithIdentity {
  const { poolId, treeKey, leaseProvider } = options;
  const rootPubkey = treeKey.getPublicKey();

  // The TreeKey carries mutable state (setUses + sign); serialize signing so
  // concurrent co-signs cannot race on a shared key.
  let signLock: Promise<unknown> = Promise.resolve();

  const doSign = async (data: Uint8Array): Promise<string> => {
    const reservation = await leaseProvider.reserveKeyUse({
      treeId: vtxoOperatorTreeId(poolId),
      purpose: 'vtxo-operator',
      payloadHash: bytesToHex(sha3_256(data)),
    });
    const flat = reservation.indices.l1 * KEYS_PER_LEVEL + reservation.indices.l2;
    try {
      treeKey.setUses(flat);
      const signature = serializeTreeSignature(treeKey.sign(data)) as Uint8Array;
      await leaseProvider.commitKeyUse(reservation.reservationId, 'vtxo-operator');
      return '0x' + bytesToHex(signature);
    } catch (err) {
      await leaseProvider.burnReservation(reservation.reservationId, 'sign-failed').catch(() => {});
      throw err;
    }
  };

  return {
    poolId,
    publicKey: '0x' + bytesToHex(rootPubkey).toLowerCase(),
    sign(data: Uint8Array): Promise<string> {
      const run = signLock.then(
        () => doSign(data),
        () => doSign(data),
      );
      signLock = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    async verify(data: Uint8Array, sig: string): Promise<boolean> {
      try {
        return verifyTreeSignature(rootPubkey, data, deserializeTreeSignature(hexToBytes(sig)));
      } catch {
        return false;
      }
    },
  };
}

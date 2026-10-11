/**
 * Wallet channel-signing bridge (RFC-037 Phase 2).
 *
 * Binds the wallet's unified WOTS `TreeKey` (the same key as the address /
 * Minima pubkey) to Omnia's `ChannelSigner` + `ChannelParticipant`. A signature
 * is a serialized hierarchical `TreeSignature`, and the advertised
 * `publicKeyDigest` is the tree-root pubkey — exactly what
 * `@totemsdk/omnia`'s `verifyChannelSignature` and the on-chain
 * `MULTISIG(2 pkA pkB)` script expect.
 *
 * The caller supplies the `TreeKey` already resolved for the address index it
 * leased (the lease provider and the tree key MUST share that index), so no raw
 * seed or key material crosses this boundary.
 */

import { bytesToHex, serializeTreeSignature, type TreeKey } from '@totemsdk/core';
import type { ChannelParticipant, ChannelSigner, ChannelSignature } from '@totemsdk/omnia';
import type { SigningIndices } from '@totemsdk/wots-lease';

/** Keys per tree level — the flat leaf index is `l1 * KEYS_PER_LEVEL + l2`. */
export const KEYS_PER_LEVEL = 64;

export interface WalletChannelSigningOptions {
  /** Address index the `TreeKey` was derived for (used on the participant). */
  addressIndex?: number;
  /** Party id used in channel records; defaults to the public-key digest. */
  partyId?: string;
  /** Optional settlement address for cooperative close. */
  settlementAddress?: string;
}

export interface WalletChannelSigningMaterial {
  signer: ChannelSigner;
  participant: ChannelParticipant;
}

/**
 * Build the wallet's Omnia signing material from a unified WOTS `TreeKey`.
 * `sign(payload, indices)` signs with the leaf reserved by the lease and returns
 * the serialized `TreeSignature` Omnia verifies (RFC-037).
 */
export function createWalletChannelSigningMaterial(
  treeKey: TreeKey,
  options: WalletChannelSigningOptions = {},
): WalletChannelSigningMaterial {
  const publicKeyDigest = '0x' + bytesToHex(treeKey.getPublicKey()).toLowerCase();
  const addressIndex = options.addressIndex ?? 0;

  const signer: ChannelSigner = {
    publicKeyDigest,
    async sign(payload: Uint8Array, indices: SigningIndices): Promise<ChannelSignature> {
      const flat = indices.l1 * KEYS_PER_LEVEL + indices.l2;
      treeKey.setUses(flat);
      return serializeTreeSignature(treeKey.sign(payload)) as Uint8Array;
    },
  };

  const participant: ChannelParticipant = {
    partyId: options.partyId ?? publicKeyDigest,
    publicKeyDigest,
    addressIndex,
    ...(options.settlementAddress ? { settlementAddress: options.settlementAddress } : {}),
  };

  return { signer, participant };
}

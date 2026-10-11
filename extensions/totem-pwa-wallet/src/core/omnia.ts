/**
 * PWA Omnia signing material (RFC-037-A2).
 *
 * Builds the wallet-side Omnia client's signing material from the PWA wallet:
 *   - child-key signer (address index 0) via `createWalletChannelSigningMaterial`,
 *   - the root-identity anchor (RFC-037-A): partyId = the identity id and an
 *     ownership proof binding the channel key to the root key.
 *
 * Gated to self-hosted WOTS lease mode (RFC-013): in Axia mode the server owns
 * one-time-key allocation, so a local channel lease could reuse a leaf — the
 * builder returns `null` and mutations stay a reasoned `UNSUPPORTED`.
 *
 * The ownership proof's root leaf is allocated through the same lease provider
 * (`treeId: omnia-identity`) so root leaves are never reused (RFC-037-A §8).
 */

import { createWalletChannelSigningMaterial } from '@totemsdk/omnia-relay';
import type { ChannelIdentity } from '@totemsdk/omnia';
import type { ChannelParticipant, ChannelSigner } from '@totemsdk/omnia';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import { UnifiedIdentityWallet } from '@totemsdk/root-identity';
import { computeIdentityId } from '@totemsdk/identity';
import { WalletManager } from './WalletManager';
import {
  buildWalletChainProvider,
  buildWalletLeaseProvider,
  createLeaseStorage,
  createLocalStorageStore,
  loadWalletNetworkConfig,
} from './config/selfHosted';

const AXIA_BASE = import.meta.env.VITE_AXIA_API_BASE ?? 'https://api.axia.to';
const AXIA_PROJECT_ID = import.meta.env.VITE_AXIA_PROJECT_ID ?? 'totem-shared';

/** Dedicated Omnia channel address index (RFC-037-A §7). */
export const OMNIA_ADDRESS_INDEX = 0;

/** Keys per tree level — flat leaf index = l1 * 64 + l2. */
const KEYS_PER_LEVEL = 64;

export interface PwaOmniaSigningMaterial {
  signer: ChannelSigner;
  participant: ChannelParticipant;
  leaseProvider: WotsLeaseProvider;
  chainProvider: ChainStateProvider;
}

/**
 * Build the PWA's Omnia signing material, or `null` when it cannot be built
 * safely (wallet locked, or not in a self-hosted WOTS lease mode).
 */
export async function buildPwaOmniaSigningMaterial(): Promise<PwaOmniaSigningMaterial | null> {
  if (!WalletManager.isUnlocked()) return null;
  const session = WalletManager.getSession();
  if (!session) return null;

  const config = await loadWalletNetworkConfig(createLocalStorageStore());
  const leaseProvider = buildWalletLeaseProvider(config.lease, {
    storage: createLeaseStorage(),
    deviceId: 'pwa',
  });
  if (!leaseProvider) return null; // Axia lease mode — server owns allocation.

  const chainProvider = buildWalletChainProvider(config.chain, {
    hosted: { baseUrl: AXIA_BASE, apiKey: AXIA_PROJECT_ID },
  });

  const addressIndex = OMNIA_ADDRESS_INDEX;
  const treeKey = await WalletManager.getTreeKeyAt(addressIndex);
  const { signer, participant } = createWalletChannelSigningMaterial(treeKey, { addressIndex });

  // Root-identity anchor. Allocate the one-time root leaf through the lease so
  // it is never reused across sessions/proofs.
  const reservation = await leaseProvider.reserveKeyUse({
    treeId: 'omnia-identity',
    purpose: 'channel-identity',
  });
  const rootUseIndex = reservation.indices.l1 * KEYS_PER_LEVEL + reservation.indices.l2;
  let proof;
  try {
    const riw = new UnifiedIdentityWallet(session.seed, 64);
    proof = riw.proveOwnership([addressIndex], { rootUseIndex });
  } catch (err) {
    await leaseProvider.burnReservation(reservation.reservationId, 'identity-proof-failed').catch(() => {});
    throw err;
  }
  await leaseProvider.commitKeyUse(reservation.reservationId, 'channel-identity');

  const identity: ChannelIdentity = {
    id: computeIdentityId('person', proof.rootAddress),
    rootAddress: proof.rootAddress,
    rootPublicKey: proof.rootPublicKey,
    ownershipProof: proof as unknown as ChannelIdentity['ownershipProof'],
  };
  participant.identity = identity;
  participant.partyId = identity.id;

  return { signer, participant, leaseProvider, chainProvider };
}

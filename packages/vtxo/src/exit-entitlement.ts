/**
 * V1 transferable-exit artifact.
 *
 * A recipient must not accept a transferred VTXO unless it also receives a
 * self-contained, independently executable exit entitlement. This module binds
 * the exit transaction to the exact owner, amount, pool coin and exit block.
 */

import { deserializeTxDraft } from '@totemsdk/tx-builder';
import { wotsAddressData } from '@totemsdk/core';
import type { OmniaVtxo, OmniaVtxoPool } from './types.js';
import { exitTransactionDigest, type ExitTxParams, type ExitTxResult } from './exit-tx.js';

export interface VtxoExitEntitlement {
  version: 1;
  vtxoId: string;
  poolId: string;
  owner: string;
  amount: string;
  tokenId: string;
  fundingCoinId: string;
  fundingAddress: string;
  fundingScript: string;
  holders: string[];
  shares: string[];
  holderIndex: number;
  root: string;
  epoch: number;
  exitBlock: number;
  txHex: string;
  digest: string;
  witnessHex: string;
}

export interface ExitEntitlementVerification {
  valid: boolean;
  errors: string[];
}

/**
 * OMN-025: witness verification needs the signing key material, which an
 * entitlement cannot carry. Callers therefore supply a verifier; without one,
 * an untrusted entitlement is rejected rather than accepted on shape alone.
 */
export interface VerifyExitEntitlementOptions {
  /** Verify the serialized witness over the exit digest. */
  verifyWitness?: (
    witness: Uint8Array,
    digest: Uint8Array,
    entitlement: VtxoExitEntitlement,
  ) => boolean;
  /** Authoritative pool (live or historical) the exit must spend. */
  pool?: OmniaVtxoPool;
  /**
   * Set to false only when the caller produced the entitlement itself. Default
   * is true: an unverified witness invalidates the entitlement.
   */
  requireWitness?: boolean;
}

export function createVtxoExitEntitlement(
  params: ExitTxParams,
  result: ExitTxResult,
): VtxoExitEntitlement {
  return {
    version: 1,
    vtxoId: params.vtxo.vtxoId,
    poolId: params.vtxo.poolId,
    owner: params.vtxo.owner,
    amount: params.vtxo.amount.toString(),
    tokenId: params.vtxo.tokenId,
    fundingCoinId: params.fundingCoinId,
    fundingAddress: params.fundingAddress,
    fundingScript: params.fundingScript,
    holders: [...params.holders],
    shares: params.shares.map((s) => s.toString()),
    holderIndex: params.holderIndex,
    root: params.root,
    epoch: params.epoch,
    exitBlock: params.exitBlock,
    txHex: result.txHex,
    digest: result.digest,
    witnessHex: result.witnessHex,
  };
}

export function verifyVtxoExitEntitlement(
  entitlement: VtxoExitEntitlement,
  vtxo: OmniaVtxo,
  options: VerifyExitEntitlementOptions = {},
): ExitEntitlementVerification {
  const errors: string[] = [];
  if (entitlement.version !== 1) errors.push('unsupported entitlement version');
  if (entitlement.vtxoId !== vtxo.vtxoId) errors.push('vtxo id mismatch');
  if (entitlement.poolId !== vtxo.poolId) errors.push('pool id mismatch');
  if (entitlement.owner !== vtxo.owner) errors.push('owner mismatch');
  if (entitlement.amount !== vtxo.amount.toString()) errors.push('amount mismatch');
  if (entitlement.tokenId !== vtxo.tokenId) errors.push('token mismatch');
  if (entitlement.holders[entitlement.holderIndex] !== vtxo.owner) errors.push('holder index/owner mismatch');
  if (entitlement.shares[entitlement.holderIndex] !== vtxo.amount.toString()) errors.push('holder share mismatch');
  // The exit transaction commits the pool state it spends. It must match the
  // proof root/epoch of the VTXO it is attached to, otherwise it authorizes an
  // exit against a different pool state.
  if (!vtxo.proof.root || entitlement.root !== vtxo.proof.root) errors.push('proof root mismatch');
  if (entitlement.epoch !== vtxo.epoch) errors.push('epoch mismatch');
  if (!entitlement.txHex) errors.push('missing exit transaction');
  if (!entitlement.witnessHex) errors.push('missing exit witness');
  // OMN-025: a digest is mandatory; otherwise the transaction checks below
  // would be skipped entirely.
  if (!entitlement.digest) errors.push('missing exit digest');

  if (entitlement.txHex) {
    try {
      const draft = deserializeTxDraft(entitlement.txHex);
      const digest = Buffer.from(exitTransactionDigest(draft)).toString('hex');
      if (digest !== entitlement.digest.replace(/^0x/i, '')) errors.push('exit digest mismatch');

      // The entitlement is only meaningful if the decoded transaction actually
      // pays this VTXO's owner and spends the stated pool coin.
      const payout = draft.outputs?.[0];
      if (!payout) {
        errors.push('exit transaction has no payout output');
      } else {
        if (payout.address !== wotsAddressData(entitlement.owner)) {
          errors.push('exit transaction does not pay the entitlement owner');
        }
        if (payout.amount !== BigInt(entitlement.amount)) {
          errors.push('exit transaction payout amount mismatch');
        }
        // OMN-087: a payout in another asset is not this entitlement's exit.
        if (payout.tokenId !== entitlement.tokenId) {
          errors.push('exit transaction payout token mismatch');
        }
      }
      const fundingInput = draft.inputs?.[0];
      if (!fundingInput || fundingInput.coinId !== entitlement.fundingCoinId) {
        errors.push('exit transaction does not spend the stated pool coin');
      }
    } catch (err) {
      errors.push(`exit transaction does not decode: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // OMN-025: the witness must actually authorize the exit digest. A caller that
  // cannot verify it cannot accept an entitlement from a peer.
  const requireWitness = options.requireWitness !== false;
  if (entitlement.witnessHex) {
    if (options.verifyWitness) {
      try {
        const witness = Uint8Array.from(Buffer.from(entitlement.witnessHex.replace(/^0x/i, ''), 'hex'));
        const digest = Uint8Array.from(
          Buffer.from(entitlement.digest.replace(/^0x/i, ''), 'hex'),
        );
        const verified = options.verifyWitness(witness, digest, entitlement);
        if (!verified) errors.push('exit witness does not verify');
      } catch (err) {
        errors.push(`exit witness cannot be verified: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (requireWitness) {
      errors.push('exit witness is not verified: no witness verifier was supplied');
    }
  }

  // OMN-025: anchor the spending coin to authoritative pool state, and keep
  // historical epochs verifiable through the pool's published roots.
  if (options.pool) {
    const pool = options.pool;
    if (pool.poolId !== entitlement.poolId) errors.push('pool id does not match the authoritative pool');
    if (pool.tokenId !== entitlement.tokenId) errors.push('token does not match the authoritative pool');
    const backingCoin = pool.backing?.coinId;
    if (backingCoin && backingCoin.replace(/^0x/i, '').toLowerCase()
      !== entitlement.fundingCoinId.replace(/^0x/i, '').toLowerCase()) {
      errors.push('funding coin is not the pool backing coin');
    }
    if (pool.backing?.address && entitlement.fundingAddress
      && pool.backing.address.replace(/^0x/i, '').toLowerCase()
        !== entitlement.fundingAddress.replace(/^0x/i, '').toLowerCase()) {
      errors.push('funding address does not match the pool backing address');
    }
    // OMN-087: the entitlement must match the root the pool *published* for this
    // epoch, and the VTXO must belong to that epoch's set. Checking only that an
    // epoch number exists lets an entitlement disagree with authoritative state.
    const published = pool.epochRoots?.find((entry) => entry.epoch === entitlement.epoch);
    if (pool.epoch >= entitlement.epoch) {
      if (!published) {
        errors.push('exit epoch is not a published pool epoch');
      } else {
        if (published.root !== entitlement.root) {
          errors.push('exit entitlement root does not match the published epoch root');
        }
        if (published.vtxoIds?.length && !published.vtxoIds.includes(entitlement.vtxoId)) {
          errors.push('exit VTXO is not a member of the published epoch set');
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

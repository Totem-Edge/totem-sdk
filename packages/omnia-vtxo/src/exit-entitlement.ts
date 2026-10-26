/**
 * V1 transferable-exit artifact.
 *
 * A recipient must not accept a transferred VTXO unless it also receives a
 * self-contained, independently executable exit entitlement. This module binds
 * the exit transaction to the exact owner, amount, pool coin and exit block.
 */

import { deserializeTxDraft } from '@totemsdk/omnia';
import type { OmniaVtxo } from './types.js';
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
  if (!entitlement.txHex) errors.push('missing exit transaction');
  if (!entitlement.witnessHex) errors.push('missing exit witness');

  if (entitlement.txHex && entitlement.digest) {
    try {
      const draft = deserializeTxDraft(entitlement.txHex);
      const digest = Buffer.from(exitTransactionDigest(draft)).toString('hex');
      if (digest !== entitlement.digest.replace(/^0x/i, '')) errors.push('exit digest mismatch');
    } catch (err) {
      errors.push(`exit transaction does not decode: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

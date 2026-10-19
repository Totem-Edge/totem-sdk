/**
 * VTXO exit transaction (RFC-038 V3 — per-share, owner-signed).
 *
 * The exit spends the pool's on-chain coin and pays the exiting holder **only
 * its committed share** (`shares[holderIndex]`), returning the remainder to the
 * pool with that holder's share state zeroed. It is signed with the holder's key
 * — the pool script's `IF @BLOCK GT EXITBLOCK … IF SIGNEDBY(holder) … VERIFYOUT(0
 * holder SHARE @TOKENID FALSE)` branch authorizes it, so the holder can broadcast
 * without any operator signature or liveness, and cannot take more than its share.
 *
 * The caller must pass the holder signer; neither the operator nor another holder
 * can build a valid witness for this holder's share.
 */

import {
  computeOmniaTxDigest,
  omniaDraftToMinimaBytes,
  serializeTxDraft,
  type OmniaTxDraft,
  type TxOutputDraft,
} from '@totemsdk/omnia';
import { serializeTxBody, mineTxPoW, TX_POW_MIN_DIFFICULTY } from '@totemsdk/txpow';
import { concatBytes, wotsAddressData } from '@totemsdk/core';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { OmniaVtxo } from './types.js';
import { poolStateVariables } from './anchor.js';

/** State port carrying an optional exit delay on the holder's output. */
export const EXIT_DELAY_PORT = 110;

export interface ExitTxParams {
  vtxo: OmniaVtxo;
  /** The pool's on-chain coin (input). */
  fundingCoinId: string;
  fundingAddress: string;
  fundingScript: string;
  /** Total pool amount (raw base units). */
  amount: bigint;
  /** Pool holders + committed shares (aligned arrays). */
  holders: string[];
  shares: bigint[];
  /** Index of the exiting holder (must match `vtxo.owner`). */
  holderIndex: number;
  /** Pool state, needed to rebuild the remainder output's state. */
  root: string;
  epoch: number;
  exitBlock: number;
}

/** Draft that spends the pool coin: output 0 = holder's share, remainder = pool. */
export function buildExitTransactionDraft(params: ExitTxParams): OmniaTxDraft {
  const share = params.shares[params.holderIndex];
  if (share === undefined) throw new Error('exit: holderIndex out of range');
  if (share <= 0n) throw new Error('exit: holder share must be positive');

  const outputs: TxOutputDraft[] = [{
    address: wotsAddressData(params.vtxo.owner),
    amount: share,
    tokenId: params.vtxo.tokenId,
    storeState: false,
    stateVariables: [],
  }];

  const carriesState = params.amount > share;
  if (carriesState) {
    const remaining = params.shares.map((s, i) => (i === params.holderIndex ? 0n : s));
    outputs.push({
      address: params.fundingAddress,
      amount: params.amount - share,
      tokenId: params.vtxo.tokenId,
      storeState: true,
      stateVariables: poolStateVariables(params.root, params.epoch, params.exitBlock, remaining),
    });
  }

  return {
    type: 'settlement',
    inputs: [{
      coinId: params.fundingCoinId,
      address: params.fundingAddress,
      amount: params.amount,
      tokenId: params.vtxo.tokenId,
      scriptHex: params.fundingScript,
    }],
    outputs,
    storeState: carriesState,
    stateVariables: [],
  };
}

export function exitTransactionDigest(draft: OmniaTxDraft): Uint8Array {
  return computeOmniaTxDigest(draft);
}

export function exitTransactionHex(draft: OmniaTxDraft): string {
  return serializeTxDraft(draft);
}

interface MinedTxPow {
  minedHeaderBytes: Uint8Array;
  txpowId: Uint8Array;
}

export interface ExitTxDeps {
  signDigest: (digest: Uint8Array) => Promise<Uint8Array>;
  chainProvider?: ChainStateProvider;
  mine?: (txBody: Uint8Array, difficulty: Uint8Array) => Promise<MinedTxPow>;
}

export interface ExitTxResult {
  vtxoId: string;
  owner: string;
  share: string;
  draftType: 'vtxo-exit';
  txHex: string;
  digest: string;
  witnessHex: string;
  txpowId?: string;
}

/** Build, sign (and optionally mine + broadcast) a per-share VTXO exit transaction. */
export async function buildExitTransaction(params: ExitTxParams, deps: ExitTxDeps): Promise<ExitTxResult> {
  const draft = buildExitTransactionDraft(params);
  const digest = exitTransactionDigest(draft);
  const signature = await deps.signDigest(digest);

  const result: ExitTxResult = {
    vtxoId: params.vtxo.vtxoId,
    owner: params.vtxo.owner,
    share: params.shares[params.holderIndex].toString(),
    draftType: 'vtxo-exit',
    txHex: exitTransactionHex(draft),
    digest: Buffer.from(digest).toString('hex'),
    witnessHex: Buffer.from(signature).toString('hex'),
  };

  if (deps.chainProvider) {
    const mine = deps.mine ?? ((txBody, difficulty) => mineTxPoW(txBody, difficulty));
    const draftBytes = omniaDraftToMinimaBytes(draft);
    const txBody = serializeTxBody(draftBytes, signature);
    const mined = await mine(txBody, TX_POW_MIN_DIFFICULTY);
    const fullTxPoW = concatBytes(concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01])), txBody);
    await deps.chainProvider.broadcastTxPoW(Buffer.from(fullTxPoW).toString('hex'));
    result.txpowId = Buffer.from(mined.txpowId).toString('hex');
  }

  return result;
}

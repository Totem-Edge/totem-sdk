/**
 * VTXO exit transaction (RFC-038 V2 — owner-unilateral).
 *
 * The exit spends the pool's on-chain coin and pays the VTXO's owner, carrying
 * the exit delay in STATE(110). It is signed with the **owner's** key (not the
 * operator's): the pool script's `IF @BLOCK GT EXITBLOCK THEN RETURN
 * SIGNEDBY(OWNER)` branch authorizes it after the exit window, so the owner can
 * broadcast it without any operator signature or liveness. The digest is signed
 * (injected signer) and, when a chain provider is supplied, mined + broadcast
 * (injected miner).
 *
 * The caller must pass the owner signer; the operator cannot construct a valid
 * exit witness for itself.
 */

import {
  computeOmniaTxDigest,
  omniaDraftToMinimaBytes,
  serializeTxDraft,
  type OmniaTxDraft,
  type StateValue,
} from '@totemsdk/omnia';
import { serializeTxBody, mineTxPoW, TX_POW_MIN_DIFFICULTY } from '@totemsdk/txpow';
import { concatBytes } from '@totemsdk/core';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { OmniaVtxo } from './types.js';

/** State port carrying the exit delay on the owner's output. */
export const EXIT_DELAY_PORT = 110;

export interface ExitTxParams {
  vtxo: OmniaVtxo;
  /** The pool's on-chain coin (input). */
  fundingCoinId: string;
  fundingAddress: string;
  fundingScript: string;
  /** Raw base-unit amount to pay the owner (the VTXO amount, pre-scaled). */
  amount: bigint;
  /** Exit delay carried as STATE(102). */
  exitDelayBlocks: number;
}

/** Draft that spends the pool coin to the VTXO owner with the exit delay encoded. */
export function buildExitTransactionDraft(params: ExitTxParams): OmniaTxDraft {
  const stateVariables: StateValue[] = [
    { port: EXIT_DELAY_PORT, value: BigInt(params.exitDelayBlocks), type: 'number' },
  ];
  return {
    type: 'settlement',
    inputs: [{
      coinId: params.fundingCoinId,
      address: params.fundingAddress,
      amount: params.amount,
      tokenId: params.vtxo.tokenId,
      scriptHex: params.fundingScript,
    }],
    outputs: [{
      address: params.vtxo.owner,
      amount: params.amount,
      tokenId: params.vtxo.tokenId,
      storeState: false,
      stateVariables,
    }],
    storeState: false,
    stateVariables,
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
  amount: string;
  exitDelayBlocks: number;
  draftType: 'vtxo-exit';
  txHex: string;
  digest: string;
  witnessHex: string;
  txpowId?: string;
}

/** Build, sign (and optionally mine + broadcast) a VTXO exit transaction. */
export async function buildExitTransaction(params: ExitTxParams, deps: ExitTxDeps): Promise<ExitTxResult> {
  const draft = buildExitTransactionDraft(params);
  const digest = exitTransactionDigest(draft);
  const signature = await deps.signDigest(digest);

  const result: ExitTxResult = {
    vtxoId: params.vtxo.vtxoId,
    owner: params.vtxo.owner,
    amount: params.vtxo.amount.toString(),
    exitDelayBlocks: params.exitDelayBlocks,
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

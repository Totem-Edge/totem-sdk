/**
 * VTXO batch on-chain anchoring (RFC-038 V1).
 *
 * Builds a batch-anchor transaction that (re)commits an epoch's Merkle root into
 * the pool's on-chain state output, signs the tx digest, and — when a chain
 * provider is supplied — mines and broadcasts the assembled TxPoW. The signing
 * and mining are injected so the construction is testable without key material or
 * real PoW.
 */

import {
  computeOmniaTxDigest,
  omniaDraftToMinimaBytes,
  type OmniaTxDraft,
  type StateValue,
} from '@totemsdk/omnia';
import { serializeTxBody, mineTxPoW, TX_POW_MIN_DIFFICULTY } from '@totemsdk/txpow';
import { concatBytes } from '@totemsdk/core';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import { buildAndHashPoolScript } from './pool-script.js';

export interface BatchAnchorParams {
  operatorPublicKeyDigest: string;
  /** The epoch's Merkle root (32-byte hex). */
  root: string;
  epoch: number;
  /** The pool's current on-chain coin (input). */
  fundingCoinId: string;
  fundingAddress: string;
  fundingScript: string;
  /** Raw on-chain amount (token base units). */
  amount: bigint;
  tokenId: string;
}

/** State variables carried by the pool output: STATE(100)=root, STATE(101)=epoch. */
export function poolStateVariables(root: string, epoch: number): StateValue[] {
  return [
    { port: 100, value: root, type: 'string' },
    { port: 101, value: BigInt(epoch), type: 'number' },
  ];
}

/** Build the batch-anchor draft (input = pool coin, output = pool state output). */
export function buildBatchAnchorDraft(params: BatchAnchorParams): OmniaTxDraft {
  const { address } = buildAndHashPoolScript(params.operatorPublicKeyDigest);
  const stateVariables = poolStateVariables(params.root, params.epoch);
  return {
    type: 'settlement',
    inputs: [{
      coinId: params.fundingCoinId,
      address: params.fundingAddress,
      amount: params.amount,
      tokenId: params.tokenId,
      scriptHex: params.fundingScript,
    }],
    outputs: [{
      address,
      amount: params.amount,
      tokenId: params.tokenId,
      storeState: true,
      stateVariables,
    }],
    storeState: true,
    stateVariables,
  };
}

export function batchAnchorDigest(draft: OmniaTxDraft): Uint8Array {
  return computeOmniaTxDigest(draft);
}

interface MinedTxPow {
  minedHeaderBytes: Uint8Array;
  txpowId: Uint8Array;
}

export interface BatchAnchorDeps {
  /** Sign the batch-anchor tx digest (e.g. via a leased WOTS signer). */
  signDigest: (digest: Uint8Array) => Promise<Uint8Array>;
  chainProvider?: ChainStateProvider;
  /** PoW miner (defaults to `@totemsdk/txpow`'s mineTxPoW). */
  mine?: (txBody: Uint8Array, difficulty: Uint8Array) => Promise<MinedTxPow>;
}

export interface BatchAnchorResult {
  root: string;
  epoch: number;
  digest: string;
  witnessHex: string;
  txpowId?: string;
}

/** Sign (and, when a chain provider is given, mine + broadcast) a batch anchor. */
export async function anchorBatch(
  params: BatchAnchorParams,
  deps: BatchAnchorDeps,
): Promise<BatchAnchorResult> {
  const draft = buildBatchAnchorDraft(params);
  const digest = batchAnchorDigest(draft);
  const signature = await deps.signDigest(digest);

  const result: BatchAnchorResult = {
    root: params.root,
    epoch: params.epoch,
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

export interface PoolFundingExpectation {
  address: string;
  /** Raw base-unit amount, decimal string. */
  amount: string;
  tokenId: string;
}

export interface PoolFundingCheck {
  ok: boolean;
  coinId: string;
  coin?: { address: string; amount: string; tokenId: string; spent: boolean };
  proof?: unknown;
  error?: string;
}

/**
 * Verify that the pool's on-chain coin exists, matches the expected (address,
 * amount, token), is unspent, and has an MMR proof — i.e. a real funding proof
 * (RFC-038 §3.3).
 */
export async function verifyPoolFunding(
  coinId: string,
  expected: PoolFundingExpectation,
  chainProvider: ChainStateProvider,
): Promise<PoolFundingCheck> {
  const coin = await chainProvider.getCoin(coinId);
  if (!coin) return { ok: false, coinId, error: 'pool coin not found' };
  if (coin.spent) return { ok: false, coinId, error: 'pool coin is already spent' };

  const matches =
    coin.address === expected.address &&
    String(coin.amount) === expected.amount &&
    (coin.tokenid ?? '0x00') === expected.tokenId;
  if (!matches) return { ok: false, coinId, error: 'pool coin does not match expected address/amount/token' };

  const proof = await chainProvider.getProof(coinId).catch(() => null);
  if (!proof) return { ok: false, coinId, error: 'no MMR proof for pool coin' };

  return {
    ok: true,
    coinId,
    coin: { address: coin.address, amount: String(coin.amount), tokenId: coin.tokenid, spent: Boolean(coin.spent) },
    proof,
  };
}

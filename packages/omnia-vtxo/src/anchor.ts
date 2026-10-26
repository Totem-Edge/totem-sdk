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
  serializeOmniaWitness,
  omniaDraftToMinimaBytes,
  type OmniaTxDraft,
  type StateValue,
} from '@totemsdk/omnia';
import { serializeTxBody, mineTxPoW, resolveTxPowTarget } from '@totemsdk/txpow';
import { concatBytes } from '@totemsdk/core';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import { buildAndHashPoolScript, POOL_SHARE_PORT_BASE } from './pool-script.js';

export interface BatchAnchorParams {
  operatorPublicKeyDigest: string;
  /** Holder WOTS public-key digests (one per pool share). */
  holders: string[];
  /** Committed share per holder (aligned with `holders`); Σ = pool capacity. */
  shares: bigint[];
  /** Absolute block height after which holders may exit unilaterally (STATE(102)). */
  exitBlock: number;
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
  /** Real MMR entry number of the funding coin. */
  fundingMmrEntry?: bigint;
}

/** Pool output state: STATE(100)=root, STATE(101)=epoch, STATE(102)=exitBlock, STATE(300+k)=share k. */
export function poolStateVariables(
  root: string,
  epoch: number,
  exitBlock: number,
  shares: bigint[] = [],
): StateValue[] {
  return [
    { port: 100, value: root, type: 'string' },
    { port: 101, value: BigInt(epoch), type: 'number' },
    { port: 102, value: BigInt(exitBlock), type: 'number' },
    ...shares.map((share, k) => ({ port: POOL_SHARE_PORT_BASE + k, value: share, type: 'number' as const })),
  ];
}

/** Build the batch-anchor draft (input = pool coin, output = pool state output). */
export function buildBatchAnchorDraft(params: BatchAnchorParams): OmniaTxDraft {
  if (params.holders.length !== params.shares.length) {
    throw new Error('anchorBatch: holders and shares must be the same length');
  }
  const { script, address } = buildAndHashPoolScript({
    operatorPublicKeyDigest: params.operatorPublicKeyDigest,
    holders: params.holders,
    exitBlock: params.exitBlock,
  });
  // The input must be the operator's own pool output, not a foreign script.
  if (params.fundingScript !== script) {
    throw new Error('anchorBatch: fundingScript does not match the pool script');
  }
  if (params.fundingAddress !== address) {
    throw new Error('anchorBatch: fundingAddress does not match the pool address');
  }
  const stateVariables = poolStateVariables(params.root, params.epoch, params.exitBlock, params.shares);
  return {
    type: 'settlement',
    inputs: [{
      coinId: params.fundingCoinId,
      address: params.fundingAddress,
      amount: params.amount,
      tokenId: params.tokenId,
      scriptHex: params.fundingScript,
      ...(params.fundingMmrEntry !== undefined ? { mmrEntry: params.fundingMmrEntry } : {}),
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
  /** Sign the batch-anchor tx digest (single-signer legacy path). */
  signDigest?: (digest: Uint8Array) => Promise<Uint8Array>;
  /**
   * Complete N-of-N witness signatures in pool MULTISIG order:
   * operator first, then holders in `BatchAnchorParams.holders` order.
   * When supplied, `signDigest` is not called.
   */
  signatures?: Uint8Array[];
  /** Serialized Minima CoinProof(s) for the pool input. */
  coinProofs?: Uint8Array[];
  /** Serialized Minima ScriptProof(s) for the pool input script. */
  scriptProofs?: Uint8Array[];
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
  const signatures = deps.signatures ?? (deps.signDigest ? [await deps.signDigest(digest)] : undefined);
  if (!signatures || signatures.length === 0) {
    throw new Error('anchorBatch requires signDigest or signatures');
  }
  const witness = serializeOmniaWitness({
    signatures,
    coinProofs: deps.coinProofs ?? [],
    scriptProofs: deps.scriptProofs ?? [],
  });

  const result: BatchAnchorResult = {
    root: params.root,
    epoch: params.epoch,
    digest: Buffer.from(digest).toString('hex'),
    witnessHex: Buffer.from(witness).toString('hex'),
  };

  if (deps.chainProvider) {
    const draftBytes = omniaDraftToMinimaBytes(draft);
    // Prefer the node's explicit-mining path. A pre-mined TxPoW posted through
    // sendtransaction has a placeholder header and is not reliably promoted.
    if (typeof deps.chainProvider.submitTransaction === 'function') {
      const submitted = await deps.chainProvider.submitTransaction(draftBytes, witness);
      if (submitted?.success === false) {
        throw new Error(`anchorSubmit failed: ${submitted.message ?? 'unknown error'}`);
      }
      result.txpowId = submitted?.txpowid;
    } else {
      const mine = deps.mine ?? ((txBody, difficulty) => mineTxPoW(txBody, difficulty));
      const txnDifficulty = await resolveTxPowTarget(deps.chainProvider);
      const txBody = serializeTxBody(draftBytes, witness, { txnDifficulty });
      const mined = await mine(txBody, txnDifficulty);
      const fullTxPoW = concatBytes(concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01])), txBody);
      const broadcast = await deps.chainProvider.broadcastTxPoW(Buffer.from(fullTxPoW).toString('hex'));
      if (broadcast?.success === false) {
        throw new Error(`anchorBroadcast failed: ${broadcast.message ?? 'unknown error'}`);
      }
      result.txpowId = broadcast?.txpowid ?? Buffer.from(mined.txpowId).toString('hex');
    }
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
  /** The fetched MMR proof (present when `ok` and the node served one). */
  proof?: unknown;
  /**
   * Whether the MMR proof was cryptographically verified. `false` unless a
   * `verifyProof` callback was supplied — this function checks existence,
   * address/amount/token match, and unspent status, but does NOT itself verify the
   * proof against the tip. Pass `verifyProof` to verify it (RFC-038 §3.3 open).
   */
  proofVerified: boolean;
  error?: string;
}

/**
 * Check that the pool's on-chain coin exists, matches the expected
 * (address, amount, token), is unspent, and that the node serves an MMR proof.
 *
 * NOTE: this is a **presence/shape check**, not a cryptographic proof
 * verification, unless a `verifyProof` callback is supplied — see
 * `PoolFundingCheck.proofVerified`.
 */
export async function checkPoolFunding(
  coinId: string,
  expected: PoolFundingExpectation,
  chainProvider: ChainStateProvider,
  options: { verifyProof?: (proof: unknown, coinId: string) => boolean } = {},
): Promise<PoolFundingCheck> {
  const coin = await chainProvider.getCoin(coinId);
  if (!coin) return { ok: false, coinId, proofVerified: false, error: 'pool coin not found' };
  if (coin.spent) return { ok: false, coinId, proofVerified: false, error: 'pool coin is already spent' };

  const matches =
    coin.address === expected.address &&
    String(coin.amount) === expected.amount &&
    (coin.tokenid ?? '0x00') === expected.tokenId;
  if (!matches) return { ok: false, coinId, proofVerified: false, error: 'pool coin does not match expected address/amount/token' };

  const proof = await chainProvider.getProof(coinId).catch(() => null);
  if (!proof) return { ok: false, coinId, proofVerified: false, error: 'no MMR proof for pool coin' };

  const proofVerified = options.verifyProof ? options.verifyProof(proof, coinId) : false;

  return {
    ok: true,
    coinId,
    coin: { address: coin.address, amount: String(coin.amount), tokenId: coin.tokenid, spent: Boolean(coin.spent) },
    proof,
    proofVerified,
  };
}

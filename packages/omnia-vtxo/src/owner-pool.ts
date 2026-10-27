/**
 * V1 transferable owner-pool covenant.
 *
 * A single-owner claim coin whose **current owner is committed in state**, not
 * in the script. The owner can:
 *
 *   - transfer the whole coin by signing a state update that recreates it at
 *     the same address/amount with a new owner (epoch increments); or
 *   - exit after `exitBlock` to the committed owner address, with no operator
 *     signature or liveness.
 *
 * The script authenticates the **previous** committed owner
 * (`SIGNEDBY(PREVSTATE(103))`), so a spender cannot substitute their own key.
 * `PREVSTATE(104)` is the committed payout address. This is the V1 recovery
 * path: a recipient holds a coin they can spend unilaterally.
 */

import { computeScriptAddress, toNodeScript, wotsAddressData } from '@totemsdk/core';
import type { OmniaTxDraft, StateValue } from '@totemsdk/omnia';

export const OWNER_POOL_ROOT_PORT = 100;
export const OWNER_POOL_EPOCH_PORT = 101;
export const OWNER_POOL_EXIT_BLOCK_PORT = 102;
export const OWNER_POOL_PK_PORT = 103;
export const OWNER_POOL_ADDR_PORT = 104;

export interface OwnerPoolState {
  /** Batch/root commitment (opaque to this covenant; owner cannot change it). */
  root: string;
  /** Monotonic state epoch; every transfer increments it. */
  epoch: number;
  /** Absolute block after which the committed owner may exit unilaterally. */
  exitBlock: number;
  /** Current owner public-key digest (32-byte hex, `0x`-prefixed). */
  ownerPk: string;
  /** Current owner payout address (derived from `ownerPk` by the transfer builder). */
  ownerAddr: string;
}

/** Derive the committed payout address from an owner public-key digest. */
export function ownerAddressFor(ownerPk: string): string {
  return wotsAddressData(ownerPk);
}

/**
 * The transferable owner-pool script. State ports 100–104 are the only state;
 * there are no fixed holder constants.
 */
export function buildOwnerPoolScript(): string {
  return toNodeScript([
    // Unilateral exit: only the previously committed owner, only after the
    // committed block, and only to the committed owner address.
    'IF @BLOCK GT PREVSTATE(102) THEN',
    '  ASSERT SIGNEDBY(PREVSTATE(103))',
    '  ASSERT VERIFYOUT(0 PREVSTATE(104) @AMOUNT @TOKENID FALSE)',
    '  RETURN TRUE',
    'ENDIF',
    // Transfer: the previous owner authorizes a new owner. Root and exit block
    // are immutable; the coin stays at the same address with the same amount.
    'ASSERT SIGNEDBY(PREVSTATE(103))',
    'ASSERT STATE(101) GT PREVSTATE(101)',
    'ASSERT STATE(100) EQ PREVSTATE(100)',
    'ASSERT STATE(102) EQ PREVSTATE(102)',
    'ASSERT STATE(103) NEQ PREVSTATE(103)',
    'ASSERT STATE(103) NEQ 0x00',
    'ASSERT STATE(104) NEQ 0x00',
    'ASSERT VERIFYOUT(0 @ADDRESS @AMOUNT @TOKENID TRUE)',
    'RETURN TRUE',
  ].join('\n'));
}

export function buildOwnerPoolState(state: OwnerPoolState): StateValue[] {
  if (!Number.isInteger(state.exitBlock) || state.exitBlock < 0) {
    throw new Error(`owner pool: invalid exitBlock ${String(state.exitBlock)}`);
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(state.ownerPk)) {
    throw new Error('owner pool: ownerPk must be a 0x-prefixed 32-byte hex digest');
  }
  if (!state.ownerAddr) throw new Error('owner pool: ownerAddr is required');
  return [
    { port: OWNER_POOL_ROOT_PORT, value: state.root, type: 'string' },
    { port: OWNER_POOL_EPOCH_PORT, value: BigInt(state.epoch), type: 'number' },
    { port: OWNER_POOL_EXIT_BLOCK_PORT, value: BigInt(state.exitBlock), type: 'number' },
    { port: OWNER_POOL_PK_PORT, value: state.ownerPk, type: 'string' },
    { port: OWNER_POOL_ADDR_PORT, value: state.ownerAddr, type: 'string' },
  ];
}

export function ownerPoolAddress(): string {
  return computeScriptAddress(buildOwnerPoolScript());
}

export interface OwnerPoolCoin {
  coinId: string;
  address: string;
  amount: bigint;
  tokenId: string;
  scriptHex?: string;
  mmrEntry?: bigint;
}

export interface OwnerTransferParams {
  /** The coin being transferred (input). */
  coin: OwnerPoolCoin;
  /** The previously committed state (must match the input coin's state). */
  from: OwnerPoolState;
  /** The new owner. `epoch` must be greater than `from.epoch`. */
  to: OwnerPoolState;
}

/**
 * Build the transfer transaction: same script address, same amount/token,
 * new owner state and a higher epoch.
 */
export function buildOwnerTransferDraft(params: OwnerTransferParams): OmniaTxDraft {
  if (params.to.epoch <= params.from.epoch) {
    throw new Error('owner transfer: new epoch must be greater than the previous epoch');
  }
  if (params.to.exitBlock !== params.from.exitBlock) {
    throw new Error('owner transfer: exitBlock is immutable');
  }
  if (params.to.ownerAddr !== ownerAddressFor(params.to.ownerPk)) {
    throw new Error('owner transfer: ownerAddr must be derived from ownerPk');
  }
  return {
    type: 'settlement',
    inputs: [{
      coinId: params.coin.coinId,
      address: params.coin.address,
      amount: params.coin.amount,
      tokenId: params.coin.tokenId,
      scriptHex: params.coin.scriptHex ?? buildOwnerPoolScript(),
      ...(params.coin.mmrEntry !== undefined ? { mmrEntry: params.coin.mmrEntry } : {}),
    }],
    outputs: [{
      address: params.coin.address,
      amount: params.coin.amount,
      tokenId: params.coin.tokenId,
      storeState: true,
      stateVariables: buildOwnerPoolState(params.to),
    }],
    storeState: true,
    stateVariables: buildOwnerPoolState(params.to),
  };
}

export interface OwnerExitParams {
  coin: OwnerPoolCoin;
  state: OwnerPoolState;
}

/** Build the unilateral exit: full amount to the committed owner address. */
export function buildOwnerExitDraft(params: OwnerExitParams): OmniaTxDraft {
  if (params.state.ownerAddr !== ownerAddressFor(params.state.ownerPk)) {
    throw new Error('owner exit: ownerAddr must be derived from ownerPk');
  }
  return {
    type: 'settlement',
    inputs: [{
      coinId: params.coin.coinId,
      address: params.coin.address,
      amount: params.coin.amount,
      tokenId: params.coin.tokenId,
      scriptHex: params.coin.scriptHex ?? buildOwnerPoolScript(),
      ...(params.coin.mmrEntry !== undefined ? { mmrEntry: params.coin.mmrEntry } : {}),
    }],
    outputs: [{
      address: params.state.ownerAddr,
      amount: params.coin.amount,
      tokenId: params.coin.tokenId,
      storeState: false,
      stateVariables: [],
    }],
    storeState: false,
    stateVariables: [],
  };
}

// ── Signed transaction assembly ───────────────────────────────────────────────

import {
  computeOmniaTxDigest,
  omniaDraftToMinimaBytes,
  serializeOmniaWitness,
  serializeTxDraft,
} from '@totemsdk/omnia';
import { concatBytes } from '@totemsdk/core';
import { serializeTxBody, mineTxPoW, TX_POW_MIN_DIFFICULTY } from '@totemsdk/txpow';
import type { ChainStateProvider } from '@totemsdk/chain-provider';

export interface OwnerPoolTxDeps {
  /** Sign the transaction digest with the previous (transfer) or current (exit) owner key. */
  signDigest: (digest: Uint8Array) => Promise<Uint8Array>;
  coinProofs?: Uint8Array[];
  scriptProofs?: Uint8Array[];
  chainProvider?: ChainStateProvider;
  mine?: (txBody: Uint8Array, difficulty: Uint8Array) => Promise<{ minedHeaderBytes: Uint8Array; txpowId: Uint8Array }>;
}

export interface OwnerPoolTxResult {
  kind: 'owner-transfer' | 'owner-exit';
  txHex: string;
  digest: string;
  witnessHex: string;
  txpowId?: string;
  /** The state committed by the new pool output (transfer) or spent state (exit). */
  state: OwnerPoolState;
}

async function assembleOwnerPoolTx(
  draft: OmniaTxDraft,
  kind: OwnerPoolTxResult['kind'],
  state: OwnerPoolState,
  deps: OwnerPoolTxDeps,
): Promise<OwnerPoolTxResult> {
  const digest = computeOmniaTxDigest(draft);
  const signature = await deps.signDigest(digest);
  const witness = serializeOmniaWitness({
    signatures: [signature],
    coinProofs: deps.coinProofs ?? [],
    scriptProofs: deps.scriptProofs ?? [],
  });
  const result: OwnerPoolTxResult = {
    kind,
    txHex: serializeTxDraft(draft),
    digest: Buffer.from(digest).toString('hex'),
    witnessHex: Buffer.from(witness).toString('hex'),
    state,
  };

  if (deps.chainProvider) {
    const draftBytes = omniaDraftToMinimaBytes(draft);
    if (typeof deps.chainProvider.submitTransaction === 'function') {
      const submitted = await deps.chainProvider.submitTransaction(draftBytes, witness);
      if (submitted?.success === false) {
        throw new Error(`owner-pool submit failed: ${submitted.message ?? 'unknown error'}`);
      }
      result.txpowId = submitted?.txpowid;
    } else {
      const mine = deps.mine ?? ((txBody, difficulty) => mineTxPoW(txBody, difficulty));
      const txBody = serializeTxBody(draftBytes, witness);
      const mined = await mine(txBody, TX_POW_MIN_DIFFICULTY);
      const fullTxPoW = concatBytes(concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01])), txBody);
      const broadcast = await deps.chainProvider.broadcastTxPoW(Buffer.from(fullTxPoW).toString('hex'));
      if (broadcast?.success === false) {
        throw new Error(`owner-pool broadcast failed: ${broadcast.message ?? 'unknown error'}`);
      }
      result.txpowId = broadcast?.txpowid ?? Buffer.from(mined.txpowId).toString('hex');
    }
  }

  return result;
}

/** Sign and assemble the owner-rotation transfer transaction. */
export async function buildOwnerTransferTransaction(
  params: OwnerTransferParams,
  deps: OwnerPoolTxDeps,
): Promise<OwnerPoolTxResult> {
  return assembleOwnerPoolTx(buildOwnerTransferDraft(params), 'owner-transfer', params.to, deps);
}

/** Sign and assemble the unilateral owner exit transaction. */
export async function buildOwnerExitTransaction(
  params: OwnerExitParams,
  deps: OwnerPoolTxDeps,
): Promise<OwnerPoolTxResult> {
  return assembleOwnerPoolTx(buildOwnerExitDraft(params), 'owner-exit', params.state, deps);
}

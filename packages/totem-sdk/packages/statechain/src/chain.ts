import { sha3_256 } from '@totemsdk/core';
import {
  hex,
  fromHex,
  concatBytes,
  computeScriptAddress,
  buildMinimaCoin,
  serializeTransaction,
  computeTransactionDigest,
  precomputeTransactionCoinID,
  writeMiniNumber,
} from '@totemsdk/core';
import type { MinimaTransaction } from '@totemsdk/core';
import { serializeTxPoW } from '@totemsdk/txpow';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import { buildStatechainScript, RECLAIM_TIMELOCK } from './script.js';
import type { StateChain, StatechainOwner, StatechainLeaseProvider } from './types.js';

// ─── Internal utilities ──────────────────────────────────────────────────────

export function buildWitnessBytes(sigs: Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = [writeMiniNumber(BigInt(sigs.length))];
  for (const sig of sigs) parts.push(sig);
  parts.push(writeMiniNumber(0n));
  parts.push(writeMiniNumber(0n));
  return concatBytes(...parts);
}

export function coinIdBytes(coinIdHex: string): Uint8Array {
  const raw = coinIdHex.replace(/^0x/i, '').padStart(64, '0').slice(0, 64);
  return fromHex(raw);
}

export function tokenIdBytes(tokenIdHex: string): Uint8Array {
  const raw = tokenIdHex.replace(/^0x/i, '').padStart(64, '0').slice(0, 64);
  return fromHex(raw);
}

export function kissHex(h: string): string {
  const raw = h.startsWith('0x') || h.startsWith('0X') ? h.slice(2) : h;
  return '0X' + raw.toUpperCase();
}

// ─── Lock TX ─────────────────────────────────────────────────────────────────

/**
 * Build and sign the statechain LOCK TX.
 *
 * Moves an existing UTXO (`inputCoinId` at `ownerCurrentAddress`) into the
 * statechain locking address with STATE(0) = ownerPkd. The output coinId
 * (derived via precomputeTransactionCoinID) becomes the statechain's `coinId`.
 *
 * Owner signs `computeTransactionDigest(tx)` — the actual TX body hash.
 * Satisfies whatever script is at `ownerCurrentAddress` (assumed SIGNEDBY or
 * compatible single-sig script).
 *
 * Returns the full TxPoW hex and the output coin ID.
 */
export async function buildLockTx(
  inputCoinId:        string,
  ownerCurrentAddress: string,
  tokenId:            string,
  amount:             bigint,
  lockingAddress:     string,
  owner:              StatechainOwner,
  chainId:            string,
): Promise<{ txHex: string; lockedCoinId: string }> {
  const inputCoin = buildMinimaCoin({
    coinId:     coinIdBytes(inputCoinId),
    address:    fromHex(ownerCurrentAddress),
    amount:     amount.toString(),
    tokenId:    tokenIdBytes(tokenId),
    storeState: false,
  });
  const outputCoin = buildMinimaCoin({
    address:    fromHex(lockingAddress),
    amount:     amount.toString(),
    tokenId:    tokenIdBytes(tokenId),
    storeState: true,
    state:      [{ port: 0, value: owner.publicKeyDigest, type: 'hex' as const }],
  });

  const tx: MinimaTransaction = {
    linkHash: new Uint8Array([0x00]),
    inputs:   [inputCoin],
    outputs:  [outputCoin],
    state:    [],
  };

  // Pre-compute output coinId before signing so it is included in the TX digest
  precomputeTransactionCoinID(tx.inputs, tx.outputs);

  const digest   = computeTransactionDigest(tx);
  const ownerSig = await owner.sign(digest);

  const txBytes      = serializeTransaction(tx);
  const witnessBytes = buildWitnessBytes([ownerSig]);
  const prng         = sha3_256(new TextEncoder().encode(`lock:${chainId}`));
  const txHex        = Buffer.from(serializeTxPoW(txBytes, witnessBytes, { prng })).toString('hex');
  const lockedCoinId = hex(tx.outputs[0].coinId!);

  return { txHex, lockedCoinId };
}

// ─── Reclaim TX ───────────────────────────────────────────────────────────────

/**
 * Build a pre-signed unilateral reclaim TX for `owner`.
 *
 * Input:  statechain coin at lockingAddress with STATE(0) = ownerPkd
 * Output: SIGNEDBY(ownerPkd) claim address
 *
 * Signed via the `SIGNEDBY(STATE(0))` path. Valid after `@COINAGE >= RECLAIM_TIMELOCK`.
 * Uses `computeTransactionDigest(tx)` — the actual TX body hash.
 */
export async function buildOwnerReclaimTx(
  coinId:         string,
  tokenId:        string,
  amount:         bigint,
  lockingAddress: string,
  owner:          StatechainOwner,
  chainId:        string,
): Promise<{ txHex: string; reclaimAddress: string }> {
  const claimScript    = `RETURN SIGNEDBY(${kissHex(owner.publicKeyDigest)})`;
  const reclaimAddress = computeScriptAddress(claimScript);

  const inputCoin = buildMinimaCoin({
    coinId:     coinIdBytes(coinId),
    address:    fromHex(lockingAddress),
    amount:     amount.toString(),
    tokenId:    tokenIdBytes(tokenId),
    storeState: true,
    state:      [{ port: 0, value: owner.publicKeyDigest, type: 'hex' as const }],
  });
  const outputCoin = buildMinimaCoin({
    address:    fromHex(reclaimAddress),
    amount:     amount.toString(),
    tokenId:    tokenIdBytes(tokenId),
    storeState: false,
  });

  const tx: MinimaTransaction = {
    linkHash: new Uint8Array([0x00]),
    inputs:   [inputCoin],
    outputs:  [outputCoin],
    state:    [],
  };

  // Pre-compute output coinId before signing (mandatory for allsignaturesvalid=true on-chain)
  precomputeTransactionCoinID(tx.inputs, tx.outputs);

  const digest   = computeTransactionDigest(tx);
  const ownerSig = await owner.sign(digest);

  const txBytes      = serializeTransaction(tx);
  const witnessBytes = buildWitnessBytes([ownerSig]);
  const prng         = sha3_256(new TextEncoder().encode(`reclaim:${chainId}:${owner.partyId}`));
  const txHex        = Buffer.from(serializeTxPoW(txBytes, witnessBytes, { prng })).toString('hex');

  return { txHex, reclaimAddress };
}

// ─── createStateChain ─────────────────────────────────────────────────────────

/**
 * Create a new StateChain by locking a coin into the statechain MULTISIG script.
 *
 * Public API: `createStateChain(coinId, owner, sePublicKey, leaseProvider, chainProvider?)`
 *
 * Steps:
 *  1. Resolve coin details (address, tokenId, amount) from owner fields or chainProvider.
 *  2. Build the STATE(0)-based locking script and compute lockingAddress.
 *  3. Build and sign the LOCK TX: moves `coinId` into `lockingAddress` with
 *     STATE(0) = ownerPkd. Output coinId becomes `chain.coinId`.
 *  4. Broadcast the lock TX if `leaseProvider.broadcast` is present.
 *  5. Register the locked coin with the SE via `seClient.registerChain?`.
 *  6. Pre-sign the initial owner's unilateral reclaim TX (owner can exit
 *     without SE after @COINAGE >= reclaimTimelock).
 *
 * @param coinId         - The input UTXO coinId to be locked into the statechain.
 *                         `chain.coinId` will be the LOCK TX output coinId (different).
 * @param owner          - Initial owner with identity, signing capability, and coin metadata.
 *                         `owner.address`, `owner.tokenId`, `owner.amount` must be present
 *                         (or derivable from `chainProvider`).
 * @param sePublicKey    - SE's WOTS public key digest.
 * @param leaseProvider  - SE client + optional broadcast for the lock TX.
 * @param chainProvider  - Optional: fetch coin details when owner metadata is absent.
 */
export async function createStateChain(
  coinId:         string,
  owner:          StatechainOwner,
  sePublicKey:    string,
  leaseProvider:  StatechainLeaseProvider,
  chainProvider?: ChainStateProvider,
): Promise<StateChain> {
  // ── Resolve coin metadata ────────────────────────────────────────────────
  let ownerAddress = owner.address;
  let tokenId      = owner.tokenId;
  let amount       = owner.amount;

  if ((!ownerAddress || tokenId === undefined || amount === undefined) && chainProvider) {
    const coin = await chainProvider.getCoin?.(coinId);
    if (coin) {
      ownerAddress ??= coin.address;
      tokenId      ??= coin.tokenid as string;
      amount       ??= BigInt(coin.amount ?? 0);
    }
  }

  if (!ownerAddress || tokenId === undefined || amount === undefined) {
    throw new Error(
      'createStateChain: owner.address, owner.tokenId, and owner.amount are required ' +
      '(or provide a chainProvider with getCoin)',
    );
  }

  const lockingScript  = buildStatechainScript(sePublicKey);
  const lockingAddress = computeScriptAddress(lockingScript);

  const chainId = hex(sha3_256(
    new TextEncoder().encode(`${coinId}:${owner.partyId}:${owner.publicKeyDigest}`),
  ));

  // ── Build + sign lock TX (input coinId → lockingAddress with STATE(0)) ───
  const { txHex: lockTxHex, lockedCoinId } = await buildLockTx(
    coinId, ownerAddress, tokenId, amount, lockingAddress, owner, chainId,
  );

  // ── Broadcast lock TX if provider is present ─────────────────────────────
  if (leaseProvider.broadcast) {
    await leaseProvider.broadcast(lockTxHex);
  }

  // ── Register locked coin with SE ─────────────────────────────────────────
  await leaseProvider.seClient.registerChain?.(chainId, lockedCoinId, owner.publicKeyDigest, lockingScript);

  // ── Pre-sign reclaim TX for initial owner ────────────────────────────────
  const { txHex: reclaimTx, reclaimAddress } = await buildOwnerReclaimTx(
    lockedCoinId, tokenId, amount, lockingAddress, owner, chainId,
  );

  // ── Strip creation-only metadata from the stored owner snapshot ──────────
  const { address: _addr, tokenId: _t, amount: _a, ...ownerSnapshot } = owner;

  return {
    chainId,
    coinId:          lockedCoinId,    // LOCK TX output coinId, not the original input
    tokenId,
    amount,
    sePublicKey,
    lockingScript,
    lockingAddress,
    currentOwner:    { ...ownerSnapshot },
    transferHistory: [],
    status:          'active',
    reclaimTx,
    reclaimAddress,
    reclaimTimelock: RECLAIM_TIMELOCK,
    createdAt:       Date.now(),
  };
}

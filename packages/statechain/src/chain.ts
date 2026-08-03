import { sha3_256 } from '@totemsdk/core';
import {
  bytesToHex,
  hexToBytes,
  concatBytes,
  scriptToAddress,
  parseMxAddress,
  serializeTransaction,
  computeTransactionDigest,
  precomputeTransactionCoinID,
  writeMiniNumber,
} from '@totemsdk/core';
import { serializeTxPoW } from '@totemsdk/txpow';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import { buildStatechainScript, RECLAIM_TIMELOCK } from './script.js';
import type { StateChain, StatechainOwner, StatechainLeaseProvider } from './types.js';

function multiConcat(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 0) return new Uint8Array(0);
  let result = parts[0];
  for (let i = 1; i < parts.length; i++) {
    result = concatBytes(result, parts[i]);
  }
  return result;
}

// ─── Internal utilities ──────────────────────────────────────────────────────

export function buildWitnessBytes(sigs: Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = [writeMiniNumber(BigInt(sigs.length), 0)];
  for (const sig of sigs) parts.push(sig);
  parts.push(writeMiniNumber(0n, 0));
  parts.push(writeMiniNumber(0n, 0));
  return multiConcat(parts);
}

export function coinIdBytes(coinIdHex: string): Uint8Array {
  const raw = coinIdHex.replace(/^0x/i, '').padStart(64, '0').slice(0, 64);
  return hexToBytes(raw);
}

export function tokenIdBytes(tokenIdHex: string): Uint8Array {
  const raw = tokenIdHex.replace(/^0x/i, '').padStart(64, '0').slice(0, 64);
  return hexToBytes(raw);
}

export function kissHex(h: string): string {
  const raw = h.startsWith('0x') || h.startsWith('0X') ? h.slice(2) : h;
  return '0X' + raw.toUpperCase();
}

// ─── WASM JSON helpers (the @totemsdk/core WASM serializers consume JSON) ───

/** Normalize an Mx (radix-32) or hex address to lowercase hex for the WASM JSON schema. */
export function addressToHex(address: string): string {
  const upper = address.startsWith('0x') || address.startsWith('0X') ? address.slice(2) : address;
  return upper.toUpperCase().startsWith('MX')
    ? bytesToHex(parseMxAddress(address))
    : address.replace(/^0x/i, '');
}

/** Build a STATE(0) variable in WASM JSON form (`data` is hex). */
export function stateVarJson(hexValue: string): { port: number; svtype: string; data: string } {
  return { port: 0, svtype: 'hex', data: hexValue };
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
  const inputCoin = {
    coinid:    inputCoinId,
    address:   addressToHex(ownerCurrentAddress),
    amount:    amount.toString(),
    tokenid:   tokenId,
    storestate: false,
  };
  const outputCoin = {
    address:   addressToHex(lockingAddress),
    amount:    amount.toString(),
    tokenid:   tokenId,
    storestate: true,
    state:     [stateVarJson(owner.publicKeyDigest)],
  };

  const tx = {
    linkhash: '0x00',
    inputs:   [inputCoin],
    outputs:  [outputCoin],
    state:    [],
  };

  const txBytes = serializeTransaction(JSON.stringify(tx));
  const outputCoinId = precomputeTransactionCoinID(txBytes, 0);

  const digest   = computeTransactionDigest(txBytes);
  const ownerSig = await owner.sign(digest);

  const witnessBytes = buildWitnessBytes([ownerSig]);
  const prng         = sha3_256(new TextEncoder().encode(`lock:${chainId}`));
  const txHex        = Buffer.from(serializeTxPoW(txBytes, witnessBytes, { prng })).toString('hex');
  const lockedCoinId = bytesToHex(outputCoinId);

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
  const reclaimAddress = scriptToAddress(claimScript);

  const inputCoin = {
    coinid:    coinId,
    address:   addressToHex(lockingAddress),
    amount:    amount.toString(),
    tokenid:   tokenId,
    storestate: true,
    state:     [stateVarJson(owner.publicKeyDigest)],
  };
  const outputCoin = {
    address:   addressToHex(reclaimAddress),
    amount:    amount.toString(),
    tokenid:   tokenId,
    storestate: false,
  };

  const tx = {
    linkhash: '0x00',
    inputs:   [inputCoin],
    outputs:  [outputCoin],
    state:    [],
  };

  const txBytes = serializeTransaction(JSON.stringify(tx));
  const outputCoinId = precomputeTransactionCoinID(txBytes, 0);

  const digest   = computeTransactionDigest(txBytes);
  const ownerSig = await owner.sign(digest);

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
  const lockingAddress = scriptToAddress(lockingScript);

  const chainId = bytesToHex(sha3_256(
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

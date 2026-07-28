import { sha3_256 } from '@totemsdk/core';
import {
  bytesToHex,
  hexToBytes,
  wotsVerifyDigest,
  buildMinimaCoin,
  serializeTransaction,
  computeTransactionDigest,
  precomputeTransactionCoinID,
} from '@totemsdk/core';
import type { MinimaTransaction } from '@totemsdk/core';
import { serializeTxPoW } from '@totemsdk/txpow';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import { buildOwnerReclaimTx, buildWitnessBytes, coinIdBytes, tokenIdBytes } from './chain.js';
import type { StateChain, StatechainOwner, SEClient, TransferRecord } from './types.js';

function defaultVerifyBlindSig(sig: string, commitment: Uint8Array, sePkdHex: string): boolean {
  return wotsVerifyDigest(hexToBytes(sig), commitment, hexToBytes(sePkdHex));
}

/**
 * Transfer ownership of a statechain UTXO to a new owner.
 *
 * Public API: `transferOwnership(chain, newOwner, seClient)`
 *
 * Creates an on-chain state-update TX:
 *   input:  current MULTISIG coin with STATE(0) = oldOwnerPkd
 *   output: same locking address with STATE(0) = newOwnerPkd
 *
 * Signing flow:
 *  - `chain.currentOwner.sign(txDigest)` — old owner signs TX body digest.
 *  - `seClient.blindSign(hex(txDigest))` — SE countersigns same digest.
 *  Both satisfy `MULTISIG(2 STATE(0) SE)` for the input coin.
 *
 * Post-transfer:
 *  - New owner's reclaim TX is built via `newOwner.sign(reclaimDigest)`.
 *    `chain.reclaimTx` always reflects CURRENT owner — never initial owner.
 *  - Old owner's `transferKeySeed` is moved to `TransferRecord.transferKey`
 *    then **zeroed in-place** on the original owner object so the secret does
 *    not persist in hot state after the ownership hop.
 *
 * @param chain           - Active statechain (must have `currentOwner.sign`).
 * @param newOwner        - Recipient identity + signing capability.
 * @param seClient        - SE client for countersigning the state-update TX.
 * @param _verifyBlindSig - Optional SE blind-sig verification override (test use).
 *   Defaults to `wotsVerifyDigest`. Production callers should omit this.
 * @param _chainProvider  - Optional: broadcast the state-update TX on-chain.
 */
export async function transferOwnership(
  chain:            StateChain,
  newOwner:         StatechainOwner,
  seClient:         SEClient,
  _verifyBlindSig?: (sig: string, commitment: Uint8Array, sePkdHex: string) => boolean,
  _chainProvider?:  ChainStateProvider,
): Promise<StateChain> {
  if (chain.status !== 'active') {
    throw new Error(
      `transferOwnership: chain must be active, got '${chain.status}'`,
    );
  }

  const from      = chain.currentOwner.partyId;
  const to        = newOwner.partyId;
  const sequence  = chain.transferHistory.length;
  const timestamp = Date.now();

  const lockAddrBytes = hexToBytes(chain.lockingAddress);

  // ── Build state-update TX ────────────────────────────────────────────────
  const inputCoin = buildMinimaCoin({
    coinId:     coinIdBytes(chain.coinId),
    address:    lockAddrBytes,
    amount:     chain.amount.toString(),
    tokenId:    tokenIdBytes(chain.tokenId),
    storeState: true,
    state:      [{ port: 0, value: chain.currentOwner.publicKeyDigest, type: 'hex' as const }],
  });
  const outputCoin = buildMinimaCoin({
    address:    lockAddrBytes,
    amount:     chain.amount.toString(),
    tokenId:    tokenIdBytes(chain.tokenId),
    storeState: true,
    state:      [{ port: 0, value: newOwner.publicKeyDigest, type: 'hex' as const }],
  });

  const stateUpdateTx: MinimaTransaction = {
    linkHash: new Uint8Array([0x00]),
    inputs:   [inputCoin],
    outputs:  [outputCoin],
    state:    [],
  };

  const txBodyBytes = serializeTransaction(JSON.stringify(stateUpdateTx));
  const outputCoinId = precomputeTransactionCoinID(txBodyBytes, 0);
  stateUpdateTx.outputs[0].coinId = outputCoinId;
  const txBodyHex = bytesToHex(txBodyBytes);

  const digest       = computeTransactionDigest(txBodyBytes);
  const signedDigest = bytesToHex(digest);

  const oldOwnerSigBytes = await chain.currentOwner.sign(digest);
  const ownerSignature   = bytesToHex(oldOwnerSigBytes);

  const blindedSignature = await seClient.blindSign(chain.chainId, signedDigest);

  const verifyFn = _verifyBlindSig ?? defaultVerifyBlindSig;
  if (!verifyFn(blindedSignature, digest, chain.sePublicKey)) {
    throw new Error(
      `transferOwnership: SE blind signature verification failed for '${from}' → '${to}'`,
    );
  }

  // ── Build TxPoW (MULTISIG(2) witness: old owner + SE) ───────────────────
  const witnessBytes = buildWitnessBytes([oldOwnerSigBytes, hexToBytes(blindedSignature)]);
  const prng = sha3_256(
    new TextEncoder().encode(`transfer:${chain.chainId}:${sequence}`),
  );
  const txHex    = Buffer.from(serializeTxPoW(txBodyBytes, witnessBytes, { prng })).toString('hex');
  const newCoinId = bytesToHex(outputCoinId);

  // ── Optional on-chain broadcast ──────────────────────────────────────────
  if (_chainProvider) {
    await _chainProvider.broadcastTxPoW(txHex);
  }

  // ── Pre-sign new owner's reclaim TX ─────────────────────────────────────
  const { txHex: newReclaimTx, reclaimAddress: newReclaimAddress } =
    await buildOwnerReclaimTx(
      newCoinId, chain.tokenId, chain.amount, chain.lockingAddress, newOwner, chain.chainId,
    );

  // ── Key zeroing (security-critical) ─────────────────────────────────────
  // 1. Copy the old owner's WOTS seed into the TransferRecord before zeroing.
  // 2. Zero the transferKeySeed in-place on the original owner object so any
  //    caller retaining a reference to `chain.currentOwner` can no longer read
  //    the live secret. The hex string is replaced with a zero-filled string of
  //    the same length, and the underlying Buffer bytes are filled with 0x00.
  const transferKey = chain.currentOwner.transferKeySeed ?? '';
  if (chain.currentOwner.transferKeySeed) {
    try {
      const keyBytes = hexToBytes(chain.currentOwner.transferKeySeed);
      keyBytes.fill(0);
    } catch { /* ignore hex decode errors on already-zeroed values */ }
    (chain.currentOwner as { transferKeySeed: string }).transferKeySeed =
      '0'.repeat(chain.currentOwner.transferKeySeed.length);
  }

  await seClient.revokeKey(chain.chainId, {
    previousOwnerPartyId: from,
    previousOwnerPkd: chain.currentOwner.publicKeyDigest,
    newOwnerPartyId: to,
    newOwnerPkd: newOwner.publicKeyDigest,
    newReclaimTxHex: newReclaimTx,
  });

  const record: TransferRecord = {
    from,
    to,
    fromPublicKeyDigest: chain.currentOwner.publicKeyDigest,
    toPublicKeyDigest:   newOwner.publicKeyDigest,
    blindedSignature,
    transferKey,
    ownerSignature,
    signedDigest,
    txBodyHex,
    txHex,
    timestamp,
  };

  return {
    ...chain,
    coinId:          newCoinId,
    currentOwner:    { ...newOwner },
    transferHistory: [...chain.transferHistory, record],
    reclaimTx:       newReclaimTx,
    reclaimAddress:  newReclaimAddress,
  };
}

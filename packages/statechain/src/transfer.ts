import { sha3_256 } from '@totemsdk/core';
import {
  bytesToHex,
  hexToBytes,
  serializeTreeSignature,
  deserializeTreeSignature,
  serializeTransaction,
  computeTransactionDigest,
  precomputeTransactionCoinID,
} from '@totemsdk/core';
import { serializeTxPoW } from '@totemsdk/txpow';
import { buildMinimaWitnessBytes } from '@totemsdk/tx-builder';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import { addressToHex, buildOwnerReclaimTx, stateVarJson } from './chain.js';
import { verifySeSignatureEnvelope } from './verify.js';
import type { StateChain, StatechainOwner, SEClient, TransferRecord } from './types.js';

/**
 * Transfer ownership of a statechain UTXO to a new owner.
 *
 * Public API: `transferOwnership(chain, newOwner, seClient)`
 *
 * Creates an on-chain state-update TX:
 *   input:  current MULTISIG coin with STATE(0) = oldOwnerRoot
 *   output: same locking address with STATE(0) = newOwnerRoot
 *
 * Signing flow (RFC-009, Minima-faithful):
 *  - `chain.currentOwner.signTree(txDigest)` — old owner root-bound TreeKey sig.
 *  - `seClient.blindSign(hex(txDigest))` — SE leased-leaf co-signature envelope.
 *  Both satisfy `MULTISIG(2 STATE(0) SE)` for the input coin; the witness is a
 *  list of Minima `TreeSignature` objects.
 *
 * Post-transfer:
 *  - New owner's reclaim TX is built via `newOwner.signTree(reclaimDigest)`.
 *    `chain.reclaimTx` always reflects CURRENT owner — never initial owner.
 *
 * @param chain          - Active statechain (must have `currentOwner.signTree`).
 * @param newOwner       - Recipient identity + TreeKey signing capability.
 * @param seClient       - SE client for countersigning the state-update TX.
 * @param _chainProvider - Optional: broadcast the state-update TX on-chain.
 */
export async function transferOwnership(
  chain:            StateChain,
  newOwner:         StatechainOwner,
  seClient:         SEClient,
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

  const lockAddrHex = addressToHex(chain.lockingAddress);

  // ── Build state-update TX ────────────────────────────────────────────────
  const inputCoin = {
    coinid:    chain.coinId,
    address:   lockAddrHex,
    amount:    chain.amount.toString(),
    tokenid:   chain.tokenId,
    storestate: true,
    state:     [stateVarJson(chain.currentOwner.publicKeyDigest)],
  };
  const outputCoin = {
    address:   lockAddrHex,
    amount:    chain.amount.toString(),
    tokenid:   chain.tokenId,
    storestate: true,
    state:     [stateVarJson(newOwner.publicKeyDigest)],
  };

  const stateUpdateTx = {
    linkhash: '0x00',
    inputs:   [inputCoin],
    outputs:  [outputCoin],
    state:    [],
  };

  const txBodyBytes = serializeTransaction(JSON.stringify(stateUpdateTx));
  const outputCoinId = precomputeTransactionCoinID(txBodyBytes, 0);
  const txBodyHex = bytesToHex(txBodyBytes);

  const digest       = computeTransactionDigest(txBodyBytes);
  const signedDigest = bytesToHex(digest);

  const oldOwnerTreeSig = await chain.currentOwner.signTree(digest);
  const ownerSignature  = bytesToHex(serializeTreeSignature(oldOwnerTreeSig));

  const seSignature = await seClient.blindSign(chain.chainId, signedDigest);

  // RFC-008: verify the leased-leaf envelope against the SE root's proof.
  if (!verifySeSignatureEnvelope(seSignature, digest, chain)) {
    throw new Error(
      `transferOwnership: SE signature verification failed for '${from}' → '${to}'`,
    );
  }

  const seTreeSig = deserializeTreeSignature(hexToBytes(seSignature.signature));

  // ── Build TxPoW (Minima witness: old owner + SE tree signatures) ────────
  const witnessBytes = buildMinimaWitnessBytes([oldOwnerTreeSig, seTreeSig]);
  const prng = sha3_256(
    new TextEncoder().encode(`transfer:${chain.chainId}:${sequence}`),
  );
  // AUD-012: pin the TxPoW header time to the record timestamp so the TxPoW is
  // deterministically reconstructable during verification.
  const txTimeMilli = timestamp;
  const txHex    = Buffer.from(serializeTxPoW(txBodyBytes, witnessBytes, { prng, timeMilli: BigInt(txTimeMilli) })).toString('hex');
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
    seSignature,
    ownerSignature,
    signedDigest,
    txBodyHex,
    txHex,
    timestamp,
    txTimeMilli,
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

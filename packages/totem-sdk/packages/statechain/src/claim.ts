import { sha3_256 } from '@totemsdk/core';
import {
  hex,
  fromHex,
  computeScriptAddress,
  buildMinimaCoin,
  serializeTransaction,
  computeTransactionDigest,
  precomputeTransactionCoinID,
} from '@totemsdk/core';
import type { MinimaTransaction } from '@totemsdk/core';
import { serializeTxPoW } from '@totemsdk/txpow';
import { buildWitnessBytes, coinIdBytes, tokenIdBytes, kissHex } from './chain.js';
import type {
  StateChain,
  StatechainLeaseProvider,
  ClaimPayload,
  AbandonedProof,
} from './types.js';

/**
 * Cooperative claim — current owner + SE co-sign a claim TX.
 *
 * Public API: `claimOwnership(chain, leaseProvider) -> ClaimPayload`
 *
 * Both `chain.currentOwner.sign` and `leaseProvider.seClient.blindSign` sign
 * `computeTransactionDigest(tx)` — the actual TX body hash — satisfying the
 * `MULTISIG(2 STATE(0) SE)` spending path. No timelock required.
 *
 * @param chain          - Active or claiming statechain.
 * @param leaseProvider  - Bundle: SE client for countersigning + optional broadcast.
 * @returns ClaimPayload with txHex, claimAddress, chainId, coinId, and optional txpowId.
 */
export async function claimOwnership(
  chain:         StateChain,
  leaseProvider: StatechainLeaseProvider,
): Promise<ClaimPayload> {
  if (chain.status !== 'active' && chain.status !== 'claiming') {
    throw new Error(
      `claimOwnership: chain must be active or claiming, got '${chain.status}'`,
    );
  }

  const claimScript  = `RETURN SIGNEDBY(${kissHex(chain.currentOwner.publicKeyDigest)})`;
  const claimAddress = computeScriptAddress(claimScript);

  const inputCoin = buildMinimaCoin({
    coinId:     coinIdBytes(chain.coinId),
    address:    fromHex(chain.lockingAddress),
    amount:     chain.amount.toString(),
    tokenId:    tokenIdBytes(chain.tokenId),
    storeState: true,
    state:      [{ port: 0, value: chain.currentOwner.publicKeyDigest, type: 'hex' as const }],
  });
  const outputCoin = buildMinimaCoin({
    address:    fromHex(claimAddress),
    amount:     chain.amount.toString(),
    tokenId:    tokenIdBytes(chain.tokenId),
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

  const digest = computeTransactionDigest(tx);

  const seSig    = await leaseProvider.seClient.blindSign(hex(digest));
  const ownerSig = await chain.currentOwner.sign(digest);

  const txBytes      = serializeTransaction(tx);
  const seBytes      = fromHex(seSig.length >= 2 ? seSig : '00');
  const witnessBytes = buildWitnessBytes([ownerSig, seBytes]);
  const prng         = sha3_256(new TextEncoder().encode(`claim:${chain.chainId}`));
  const txHex        = Buffer.from(serializeTxPoW(txBytes, witnessBytes, { prng })).toString('hex');

  let txpowId: string | undefined;
  if (leaseProvider.broadcast) {
    const result = await leaseProvider.broadcast(txHex);
    txpowId = result.txpowid;
  }

  return {
    chainId:      chain.chainId,
    coinId:       chain.coinId,
    claimAddress,
    txHex,
    txpowId,
  };
}

/**
 * Reclaim after SE abandonment (SE offline / unresponsive).
 *
 * Public API: `reclaimAbandoned(chain, proof, leaseProvider) -> ClaimPayload`
 *
 * Broadcasts `chain.reclaimTx` — the pre-signed unilateral reclaim TX built
 * during `createStateChain` (and updated on every `transferOwnership`).
 *
 * This TX is signed by the CURRENT owner (not the initial owner) and spends
 * via `SIGNEDBY(STATE(0))` after `@COINAGE >= RECLAIM_TIMELOCK`. No SE
 * cooperation needed.
 *
 * If `proof.timelockBlock` is provided and `leaseProvider.getTip` is present,
 * the current block height is validated before broadcasting.
 *
 * @param chain          - Any non-claimed statechain.
 * @param proof          - Optional: timelockBlock + evidence.
 * @param leaseProvider  - Bundle: optional broadcast + optional getTip.
 * @returns ClaimPayload with pre-built reclaimTx and reclaimAddress.
 */
export async function reclaimAbandoned(
  chain:          StateChain,
  proof:          AbandonedProof,
  leaseProvider?: StatechainLeaseProvider,
): Promise<ClaimPayload> {
  if (chain.status === 'claimed') {
    throw new Error('reclaimAbandoned: chain is already claimed');
  }

  if (!chain.reclaimTx || chain.reclaimTx.length === 0) {
    throw new Error('reclaimAbandoned: no reclaimTx on chain — was createStateChain called?');
  }

  if (proof.timelockBlock !== undefined && leaseProvider?.getTip) {
    const tip = await leaseProvider.getTip();
    if (tip && tip.block < proof.timelockBlock) {
      throw new Error(
        `reclaimAbandoned: timelock not yet expired — current block ${tip.block} < required ${proof.timelockBlock}`,
      );
    }
  }

  let txpowId: string | undefined;
  if (leaseProvider?.broadcast) {
    const result = await leaseProvider.broadcast(chain.reclaimTx);
    txpowId = result.txpowid;
  }

  return {
    chainId:      chain.chainId,
    coinId:       chain.coinId,
    claimAddress: chain.reclaimAddress,
    txHex:        chain.reclaimTx,
    txpowId,
  };
}

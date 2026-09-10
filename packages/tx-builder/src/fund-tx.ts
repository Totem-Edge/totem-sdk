/**
 * tx-builder/fund-tx.ts — Deep pool-funding proof (#30).
 *
 * The load-bearing rule for liquidity-bonds: "an unspent coin in my name" is not
 * enough — the funding coin must be SPENT into the pool/channel script by a
 * transaction signed by the LP. `buildPoolFundTx` constructs that spending
 * transaction (canonical form + WOTS signature over its digest), and
 * `verifyPoolFundTx` proves:
 *
 *   1. the tx bytes were not tampered with (signedDigest === digest(tx));
 *   2. the LP signature is valid over the tx digest;
 *   3. the signer's public key actually owns lpAddress;
 *   4. the tx pays the claimed token+amount to the pool/channel script.
 *
 * Combined with `chain-provider.verifyDeposit(fundingCoinId, lpAddress)` at
 * acceptance time (unspent + owned), this forms the deep on-chain deposit proof:
 * a coin that existed in the LP's name and a tx signed by the LP paying it into
 * the pool script. Real mining/broadcast of the TxPoW happens downstream; this
 * module guarantees the signing/binding that makes the proof non-forgeable.
 */

import { canonicalJson, hexToBytes, bytesToHex, sha3_256, scriptFromWotsPk, scriptToAddress, toHex, wotsKeypairFromSeed, wotsSign, wotsVerifyDigest } from '@totemsdk/core';

export const POOL_FUND_DOMAIN = 'totemsdk/pool-fund/deep-proof/v1';

export interface PoolFundTx {
  version: 1;
  domain: string;
  poolId: string;
  fundingCoinId: string;
  tokenId: string;
  amount: string;
  lpAddress: string;
  recipientAddress: string;
  nonce: string;
}

export interface BuildPoolFundTxParams {
  poolId: string;
  fundingCoinId: string;
  tokenId?: string;
  amount: string;
  lpAddress: string;
  recipientAddress: string;
  lpSeed: Uint8Array;
  lpKeyIndex?: number;
  nonce?: string;
}

export interface DeepFundingProof {
  fundingCoinId: string;
  tokenId: string;
  amount: string;
  lpAddress: string;
  recipientAddress: string;
  lpPkDigest: string;
  signedDigest: string;
  lpSignature: string;
  nonce: string;
}

export interface PoolFundBuildResult {
  tx: PoolFundTx;
  digest: Uint8Array;
  signature: Uint8Array;
  proof: DeepFundingProof;
}

export interface PoolFundVerification {
  valid: boolean;
  reasons: string[];
}

/**
 * Replicate Minima's SIGNEDBY-address derivation from a 32-byte WOTS pk digest:
 * script = `RETURN SIGNEDBY(pkDigest)` → MMR leaf → Mx address. Matches the
 * wasm `wots_address_from_keypair_wasm` path, so a keypair's address here is
 * the same address a Minima node would report for that key.
 */
export function addressFromPkDigest(pkDigest32: Uint8Array): string {
  return scriptToAddress(scriptFromWotsPk(pkDigest32));
}

export function hashPoolFundTx(tx: PoolFundTx): Uint8Array {
  return sha3_256(new TextEncoder().encode(`${POOL_FUND_DOMAIN}|${canonicalJson(tx)}`));
}

/**
 * Construct the pool-funding spending transaction and the LP's deep proof.
 * The returned TxPoW-relevant digest is what the LP signs; broadcast/mine is
 * left to the caller (which then proves the coin spent into the pool script).
 */
export function buildPoolFundTx(params: BuildPoolFundTxParams): PoolFundBuildResult {
  const lpKeyIndex = params.lpKeyIndex ?? 0;
  const tx: PoolFundTx = {
    version: 1,
    domain: POOL_FUND_DOMAIN,
    poolId: params.poolId,
    fundingCoinId: params.fundingCoinId,
    tokenId: params.tokenId ?? '0x00',
    amount: params.amount,
    lpAddress: params.lpAddress,
    recipientAddress: params.recipientAddress,
    nonce: params.nonce ?? `${Date.now()}`,
  };

  const digest = hashPoolFundTx(tx);
  const { pk } = wotsKeypairFromSeed(params.lpSeed, lpKeyIndex);
  const lpPkDigest = pk;

  if (addressFromPkDigest(lpPkDigest) !== params.lpAddress) {
    throw new Error(`lpSeed/lpKeyIndex do not own lpAddress=${params.lpAddress}`);
  }

  const signature = wotsSign(params.lpSeed, lpKeyIndex, digest);

  return {
    tx,
    digest,
    signature,
    proof: {
      fundingCoinId: tx.fundingCoinId,
      tokenId: tx.tokenId,
      amount: tx.amount,
      lpAddress: params.lpAddress,
      recipientAddress: tx.recipientAddress,
      lpPkDigest: bytesToHex(lpPkDigest),
      signedDigest: bytesToHex(digest),
      lpSignature: bytesToHex(signature),
      nonce: tx.nonce,
    },
  };
}

const empty = (reasons: string[]): PoolFundVerification => ({ valid: reasons.length === 0, reasons });

/**
 * Verify a deep funding proof. `expectedPoolAddress` (the pool/channel script
 * address) is required to prove the spend target — without it the proof only
 * proves the LP signed some tx, which is why acceptance must pass it.
 */
export function verifyPoolFundTx(
  tx: PoolFundTx,
  proof: DeepFundingProof,
  expectedPoolAddress?: string,
): PoolFundVerification {
  const reasons: string[] = [];

  if (tx.domain !== POOL_FUND_DOMAIN) reasons.push('tx uses a foreign domain');
  const digest = hashPoolFundTx(tx);
  const signedDigest = hexToBytes(proof.signedDigest);
  if (bytesToHex(digest) !== bytesToHex(signedDigest)) {
    reasons.push('signedDigest does not match the transaction');
  }

  const lpPkDigest = hexToBytes(proof.lpPkDigest);
  if (addressFromPkDigest(lpPkDigest) !== proof.lpAddress) {
    reasons.push('lpPkDigest does not own lpAddress');
  }
  if (proof.lpAddress !== tx.lpAddress) {
    reasons.push('proof.lpAddress differs from tx.lpAddress');
  }

  if (!wotsVerifyDigest(hexToBytes(proof.lpSignature), digest, lpPkDigest)) {
    reasons.push('LP signature is invalid over the transaction digest');
  }

  if (proof.fundingCoinId !== tx.fundingCoinId) reasons.push('proof.fundingCoinId differs from tx');
  if (proof.tokenId !== tx.tokenId) reasons.push('proof.tokenId differs from tx');
  if (proof.amount !== tx.amount) reasons.push('proof.amount differs from tx');
  if (proof.recipientAddress !== tx.recipientAddress) reasons.push('proof.recipientAddress differs from tx');
  if (proof.nonce !== tx.nonce) reasons.push('proof.nonce differs from tx');

  if (expectedPoolAddress && proof.recipientAddress !== expectedPoolAddress) {
    reasons.push(`recipient ${proof.recipientAddress} is not the expected pool address ${expectedPoolAddress}`);
  }

  return empty(reasons);
}

export function toProofHex(proof: DeepFundingProof): string {
  return toHex(new TextEncoder().encode(canonicalJson(proof)));
}

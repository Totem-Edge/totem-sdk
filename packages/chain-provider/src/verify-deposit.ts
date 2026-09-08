/**
 * chain-provider/verify-deposit.ts — Funding-truth verification.
 *
 * "Verified every time means on-chain check," so this module is the single
 * place a deposit's funding is checked: an unspent coin, owned by the LP,
 * for the claimed token and amount. The offline variant anchors a legacy
 * chunk MMR proof against a known root so a peer with a lookup root can
 * re-validate a deposit without reaching the node.
 */

import { bytesToHex, sha3_256, toHex, verifyMMRProof } from '@totemsdk/core';
import type {
  ChainStateProvider,
  DepositAddressOptions,
  DepositVerification,
  DepositVerifier,
  MmrChunkProof,
  VerifyDepositParams,
} from './types.js';

export const DEPOSIT_ADDRESS_DOMAIN = 'totemsdk/chain-provider/deposit/v1';

/**
 * Live deposit check against a chain provider. All gates must hold:
 *  1. the coin exists;
 *  2. it is unspent (confirmed on-chain, never a declared flag);
 *  3. it is owned by `ownerAddress`;
 *  4. its tokenid matches (base MINIMA = '0x00' when none is requested);
 *  5. its amount covers `claimedAmount`.
 */
export async function verifyDeposit(
  provider: Pick<ChainStateProvider, 'getCoin'>,
  params: VerifyDepositParams,
): Promise<DepositVerification> {
  let coin;
  try {
    coin = await provider.getCoin(params.coinId);
  } catch (error) {
    return {
      valid: false,
      exists: false,
      unspent: false,
      ownedByOwner: false,
      tokenMatches: false,
      amountSufficient: false,
      reason: 'unable to reach chain provider',
      error,
    };
  }

  if (!coin) {
    return {
      valid: false,
      exists: false,
      unspent: false,
      ownedByOwner: false,
      tokenMatches: false,
      amountSufficient: false,
      reason: `coin ${params.coinId} not found on chain`,
    };
  }

  const unspent = coin.spent !== true;
  const ownedByOwner = coin.address === params.ownerAddress;
  const tokenMatches = params.tokenId ? coin.tokenid === params.tokenId : coin.tokenid === '0x00' || coin.tokenid === '0x01';
  const amountSufficient = params.claimedAmount === undefined || bigintify(coin.amount) >= bigintify(params.claimedAmount);

  return {
    valid: unspent && ownedByOwner && tokenMatches && amountSufficient,
    exists: true,
    unspent,
    ownedByOwner,
    tokenMatches,
    amountSufficient,
    reason: unspent && ownedByOwner && tokenMatches && amountSufficient ? undefined : 'deposit funding check failed',
    coin,
  };
}

/**
 * Offline verification of a legacy chunk MMR proof against an expected root.
 * Pure function — a peer holding (leafPubkey, proof, root) can re-validate a
 * deposit commitment without node access. The proof is encoded to the wasm
 * contract (hex `data`, decimal-string `value` per chunk).
 */
export function verifyDepositMmrProof(
  leafPubkey: Uint8Array,
  proof: MmrChunkProof,
  expectedRoot: Uint8Array,
): boolean {
  const proofJson = JSON.stringify({
    chunks: proof.chunks.map((c) => ({
      isLeft: c.isLeft,
      mmrData: {
        data: bytesToHex(c.mmrData.data),
        value: c.mmrData.value.toString(),
      },
    })),
  });
  return verifyMMRProof(leafPubkey, proofJson, expectedRoot as never);
}

/**
 * Deterministic, domain-separated funding address for an LP deposit. In
 * production this is the channel/pool script address the LP pays into and the
 * funding check is run against; keeping it a pure derivation keeps issue #25
 * constructable and checkable without a live script compiler.
 */
export function depositAddressFor(lp: string, opts?: DepositAddressOptions): string {
  const scope = [
    DEPOSIT_ADDRESS_DOMAIN,
    lp,
    opts?.poolId ?? '',
    opts?.tokenId ?? '0x00',
  ].join('|');
  return `Mx${toHex(sha3_256(new TextEncoder().encode(scope))).slice(0, 80)}`;
}

/**
 * Default `DepositVerifier` over any `ChainStateProvider`. The live path uses
 * `getCoin`; the MMR-root path returns `null` unless the base provider knows a
 * root (concrete providers override `getMmrRoot`).
 */
export function withDepositVerifier(provider: ChainStateProvider): ChainStateProvider & DepositVerifier {
  return {
    ...provider,
    verifyDeposit: (params) => verifyDeposit(provider, params),
    depositAddressFor,
    getMmrRoot: async () => null,
    verifyMmrDeposit: (params) => Promise.resolve(verifyDepositMmrProof(params.leafPubkey, params.proof, params.expectedRoot)),
  };
}

function bigintify(decimalOrMinima: string): bigint {
  // Minima amounts may be MiniNumber "decimal.uuid" strings — parse the numeric
  // prefix only. Falls back to a plain BigInt parse for bare integers.
  const match = /^([0-9]+(?:\.[0-9]+)?)/.exec(decimalOrMinima.trim());
  const num = match ? match[1] : decimalOrMinima.trim();
  if (!num || !/^[0-9]+(\.[0-9]+)?$/.test(num)) return 0n;
  const [whole, frac] = num.split('.');
  // Scale to 8 decimal places (matches Minima's default MiniNumber scale).
  const fracPadded = (frac ?? '').padEnd(8, '0').slice(0, 8);
  return BigInt(`${whole}${fracPadded || ''}` || '0');
}
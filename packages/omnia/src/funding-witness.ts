import { buildScriptProof, bytesToHex, hexToBytes } from '@totemsdk/core';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import type { ChannelOpeningPlan } from './channel.js';
import type { ChannelSigner } from './types.js';
import { serializeOmniaWitness } from './witness.js';

export interface FundingWitnessBuilderInput {
  plan: ChannelOpeningPlan;
  fundingCoinId: string;
  tokenId?: string;
  localAmount: bigint;
  remoteAmount: bigint;
}

/**
 * Wallet-side port that assembles the signed funding witness for a channel open.
 *
 * The dApp supplies the funding coin id and channel terms. The wallet owns the
 * coin, so only the wallet can build the funding witness. A dApp or provider
 * MUST NOT be able to substitute a witness for a different coin or amount.
 */
export interface FundingWitnessBuilder {
  build(input: FundingWitnessBuilderInput): Promise<{ fundingWitnessBytes: Uint8Array }>;
}

export interface FundingProofProvider {
  /**
   * Serialized Minima CoinProof bytes for the funding input. `leaseToken` is
   * supplied when the wallet leases the funding slot from a remote lease
   * service (for example Axia `/v1/wots-hardened/coinproofs`).
   */
  getCoinProof(coinId: string, leaseToken?: string): Promise<Uint8Array>;
  /** KISSVM script whose hash is the funding coin's address. */
  getFundingScript(coinId: string): Promise<string>;
}

export interface WalletFundingWitnessBuilderOptions {
  signer: ChannelSigner;
  leaseProvider: WotsLeaseProvider;
  proofs: FundingProofProvider;
  /** Lease purpose label. Default: `channel-funding`. */
  purpose?: string;
}

/**
 * Reference wallet funding-witness builder.
 *
 * The wallet signs the exact funding digest produced by `buildChannelOpening`
 * and supplies the coin proof + address script. The lease is committed on
 * success and burned on failure, so a failed open never reuses a WOTS leaf.
 */
export function createWalletFundingWitnessBuilder(
  options: WalletFundingWitnessBuilderOptions,
): FundingWitnessBuilder {
  return {
    async build({ plan }) {
      const purpose = options.purpose ?? 'channel-funding';
      const reservation = await options.leaseProvider.reserveKeyUse({
        treeId: `omnia-channel-${plan.channel.channelId}`,
        purpose,
        payloadHash: bytesToHex(plan.fundingDigest),
      });

      try {
        const [coinProof, fundingScript] = await Promise.all([
          options.proofs.getCoinProof(plan.inputCoinId, reservation.leaseToken),
          options.proofs.getFundingScript(plan.inputCoinId),
        ]);

        const signature = await options.signer.sign(plan.fundingDigest, reservation.indices);
        await options.leaseProvider.commitKeyUse(reservation.reservationId, bytesToHex(plan.fundingDigest));

        return {
          fundingWitnessBytes: serializeOmniaWitness({
            signatures: [signature],
            coinProofs: [coinProof],
            scriptProofs: [buildScriptProof(fundingScript)],
          }),
        };
      } catch (error) {
        await options.leaseProvider
          .burnReservation(reservation.reservationId, 'funding witness build failed')
          .catch(() => undefined);
        throw error;
      }
    },
  };
}

/**
 * Funding proof provider backed by a `ChainStateProvider` that supports
 * `exportCoin` and `getAddressInfo` (for example a self-hosted Minima RPC node).
 *
 * Hosted providers that cannot export coin proofs fail closed with an explicit
 * error instead of fabricating a witness.
 */
export function createChainFundingProofProvider(
  chainProvider: ChainStateProvider,
): FundingProofProvider {
  return {
    async getCoinProof(coinId) {
      if (!chainProvider.exportCoin) {
        throw new Error(
          'Funding witness requires a chain provider that supports coin export (coinexport)',
        );
      }
      const exported = await chainProvider.exportCoin(coinId);
      if (!exported) throw new Error(`No coin export available for ${coinId}`);
      return hexToBytes(exported.data.replace(/^0x/i, ''));
    },

    async getFundingScript(coinId) {
      if (!chainProvider.getAddressInfo) {
        throw new Error(
          'Funding witness requires a chain provider that supports address info',
        );
      }
      const coin = await chainProvider.getCoin(coinId);
      if (!coin) throw new Error(`Funding coin ${coinId} not found`);
      const info = await chainProvider.getAddressInfo(coin.address);
      if (!info) throw new Error(`No address info available for ${coin.address}`);
      return info.script;
    },
  };
}

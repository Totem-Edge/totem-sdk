/**
 * MinimaRpcProvider — thin wrapper over @totemsdk/minima-rpc.
 */

import type { MinimaRpcClient } from '@totemsdk/minima-rpc';
import type {
  ChainStateProvider,
  CoinsQuery,
  Coin,
  MMRProof,
  ChainTip,
  TokenInfo,
  TokenSearchQuery,
  BroadcastResult,
  DepositVerifier,
  VerifyDepositParams,
  DepositVerification,
} from '../types.js';
import { depositAddressFor, evaluateDeposit, notFoundResult } from '../verify-deposit.js';

export class MinimaRpcProvider implements ChainStateProvider, DepositVerifier {
  constructor(private readonly client: MinimaRpcClient) {}

  async getCoins(query: CoinsQuery): Promise<Coin[]> {
    const result = await this.client.coins({
      address: query.address,
      tokenid: query.tokenId,
      sendable: query.sendable,
      relevant: query.relevant,
      coinid: query.coinId,
      megammr: query.megammr,
    });
    return result as unknown as Coin[];
  }

  async getCoin(coinId: string): Promise<Coin | null> {
    try {
      const coins = await this.getCoins({ coinId });
      return coins[0] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Authoritative live check via `coinexport` (the coinproof endpoint): returns
   * found/unspent/owned/token/amount + the full coin proof. `coincheck` on
   * totem-node wants a full proof payload rather than a coinid, so coinexport
   * is the canonical primitive (#3).
   */
  async verifyDeposit(params: VerifyDepositParams): Promise<DepositVerification> {
    try {
      const exported = await this.client.coinExport(params.coinId);
      const coin = exported?.coinproof?.coin as unknown as Coin | undefined;
      const spent = coin?.spent === true;
      if (!coin) {
        return notFoundResult(`coin ${params.coinId} not found on chain`);
      }
      return evaluateDeposit(coin, spent, params);
    } catch (error) {
      return {
        valid: false,
        exists: false,
        unspent: false,
        confirmed: false,
        ownedByOwner: false,
        tokenMatches: false,
        amountSufficient: false,
        reason: 'unable to reach chain provider',
        error,
      };
    }
  }

  depositAddressFor(lp: string, opts?: { poolId?: string; tokenId?: string }): string {
    return depositAddressFor(lp, opts);
  }

  /** MMR root at tip — the anchor peers verify offline proofs against. */
  async getMmrRoot(): Promise<string | null> {
    const info = await this.client.megammr();
    return info?.hash ?? null;
  }

  async getProof(coinId: string): Promise<MMRProof> {
    return this.client.mmrProof(coinId) as unknown as MMRProof;
  }

  async getTip(): Promise<ChainTip> {
    return this.client.getTip() as unknown as ChainTip;
  }

  async getToken(tokenId: string): Promise<TokenInfo> {
    const tokens = await this.client.tokens(tokenId);
    if (!tokens || tokens.length === 0) {
      throw new Error(`Token not found: ${tokenId}`);
    }
    return tokens[0] as unknown as TokenInfo;
  }

  async searchTokens(query: TokenSearchQuery): Promise<TokenInfo[]> {
    const all = await this.client.tokens();
    let results = all as unknown as TokenInfo[];
    if (query.name) {
      const needle = query.name.toLowerCase();
      results = results.filter((t) => {
        const nameStr = JSON.stringify(t.name ?? '').toLowerCase();
        return nameStr.includes(needle);
      });
    }
    if (query.creatorAddress) {
      const addr = query.creatorAddress;
      results = results.filter((t) => {
        const desc = JSON.stringify(t.description ?? '');
        return desc.includes(addr);
      });
    }
    if (query.offset) results = results.slice(query.offset);
    if (query.limit) results = results.slice(0, query.limit);
    return results;
  }

  async getTokensByCreator(address: string): Promise<TokenInfo[]> {
    return this.searchTokens({ creatorAddress: address });
  }

  async broadcastTxPoW(txpowHex: string): Promise<BroadcastResult> {
    try {
      const result = await this.client.txnMinePost(txpowHex);
      return {
        success: true,
        txpowid: result?.txpowid,
        message: 'broadcast via MinimaRpc txnminepost',
      };
    } catch (e) {
      return { success: false, message: String(e) };
    }
  }
}

function bigintify(decimalOrMinima: string): bigint {
  const match = /^([0-9]+(?:\.[0-9]+)?)/.exec(decimalOrMinima.trim());
  const num = match ? match[1] : decimalOrMinima.trim();
  if (!num || !/^[0-9]+(\.[0-9]+)?$/.test(num)) return 0n;
  const [whole, frac] = num.split('.');
  const fracPadded = (frac ?? '').padEnd(8, '0').slice(0, 8);
  return BigInt(`${whole}${fracPadded || ''}` || '0');
}

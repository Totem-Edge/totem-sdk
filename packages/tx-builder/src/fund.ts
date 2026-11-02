/**
 * @totemsdk/tx-builder/fund
 *
 * Coin selection + fee/change construction. Produces `EnhancedBuildParams`
 * ready for `buildTransaction` / `serializeWitness`.
 */

import { createSignedByDescriptor, type ScriptDescriptor } from '@totemsdk/core/scripts';
import { compareDecimal, CoinSelectionService, type SpendableCoin } from './coin-selection.js';
import type { CoinProvider, TxCoin } from './coin-provider.js';
import type { EnhancedBuildParams, EnhancedCoinInput, EnhancedCoinOutput } from './enhanced-types.js';

export interface FundedPaymentParams {
  provider: CoinProvider;
  /** Addresses that may fund the payment. */
  ownerAddresses: string[];
  recipient: string;
  amount: string;
  /** Token to pay. Defaults to native MINIMA (`0x00`). */
  tokenId?: string;
  /** Public key used for the default `RETURN SIGNEDBY(pubkey)` input descriptor. */
  ownerPublicKey: string;
  /** Where token/fee change goes. Defaults to the first owner address. */
  changeAddress?: string;
  /**
   * Native fee coin amount. When paying a token, a separate native coin of at
   * least this amount is selected and returned as change.
   */
  feeAmount?: string;
  /** Explicit fee coin id (skips fee selection). */
  feeCoinId?: string;
  /** Custom descriptor for non-standard inputs (HTLC/MAST/etc.). */
  scriptDescriptorFor?: (coin: TxCoin) => ScriptDescriptor;
  /** Fetch `coinexport` proofs for inputs when the provider supports it. */
  fetchProofs?: boolean;
}

export interface FundedPayment {
  buildParams: EnhancedBuildParams;
  selected: TxCoin[];
  change: string;
  feeCoin?: TxCoin;
}

function toSpendable(coin: TxCoin): SpendableCoin {
  return {
    coinId: coin.coinId,
    address: coin.address,
    amount: coin.amount,
    tokenid: coin.tokenId,
    created: 0,
    spent: coin.spent,
    expiresAt: coin.expiresAt,
  };
}

function dedupe(coins: TxCoin[]): TxCoin[] {
  const seen = new Set<string>();
  const out: TxCoin[] = [];
  for (const coin of coins) {
    const key = coin.coinId.replace(/^0x/i, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(coin);
  }
  return out;
}

async function coinsForAddresses(
  provider: CoinProvider,
  addresses: string[],
  tokenId: string,
): Promise<TxCoin[]> {
  const all: TxCoin[] = [];
  for (const address of addresses) {
    all.push(...(await provider.getCoins({ address, tokenId, sendable: true })));
  }
  return dedupe(all);
}

/**
 * Select coins for a payment, add a fee coin (for token payments), and build
 * outputs including change.
 */
export async function buildFundedPayment(params: FundedPaymentParams): Promise<FundedPayment> {
  if (!params.ownerAddresses?.length) throw new Error('buildFundedPayment: ownerAddresses required');
  const tokenId = params.tokenId ?? '0x00';
  const changeAddress = params.changeAddress ?? params.ownerAddresses[0];

  const tokenCoins = await coinsForAddresses(params.provider, params.ownerAddresses, tokenId);
  const service = new CoinSelectionService({
    async fetchCoins(addresses, requestedToken) {
      return (await coinsForAddresses(params.provider, addresses, requestedToken ?? tokenId)).map(toSpendable);
    },
  });
  const selection = service.selectCoins(
    tokenCoins.map(toSpendable),
    { mode: 'global', targetAmount: params.amount, tokenId },
  );
  if (selection.insufficientFunds) {
    throw new Error(`Insufficient ${tokenId} funds for ${params.amount}`);
  }

  const selectedIds = new Set(
    selection.selectedCoins.map((coin) => coin.coinId.replace(/^0x/i, '').toLowerCase()),
  );
  const selected = tokenCoins.filter((coin) =>
    selectedIds.has(coin.coinId.replace(/^0x/i, '').toLowerCase()),
  );

  let feeCoin: TxCoin | undefined;
  if (params.feeCoinId) {
    feeCoin = (await params.provider.getCoins({ coinId: params.feeCoinId }))[0];
    if (!feeCoin) throw new Error(`Fee coin not found: ${params.feeCoinId}`);
  } else if (tokenId !== '0x00' && compareDecimal(params.feeAmount ?? '0', '0') > 0) {
    const native = await coinsForAddresses(params.provider, params.ownerAddresses, '0x00');
    feeCoin = native
      .filter((coin) => !selectedIds.has(coin.coinId.replace(/^0x/i, '').toLowerCase()))
      .filter((coin) => compareDecimal(coin.amount, params.feeAmount ?? '0') >= 0)
      .sort((a, b) => compareDecimal(a.amount, b.amount))[0];
    if (!feeCoin) throw new Error('No native fee coin available');
  }

  const descriptorFor = (coin: TxCoin): ScriptDescriptor =>
    params.scriptDescriptorFor?.(coin) ??
    createSignedByDescriptor(coin.address, params.ownerPublicKey);

  const inputs: EnhancedCoinInput[] = [];
  for (const coin of [...selected, ...(feeCoin ? [feeCoin] : [])]) {
    inputs.push({
      coinId: coin.coinId,
      address: coin.address,
      amount: coin.amount,
      tokenId: coin.tokenId,
      scriptDescriptor: descriptorFor(coin),
      ...(params.fetchProofs && params.provider.getCoinProof
        ? { coinProofHex: (await params.provider.getCoinProof(coin.coinId)) ?? undefined }
        : {}),
    });
  }

  const outputs: EnhancedCoinOutput[] = [
    { address: params.recipient, amount: params.amount, tokenId },
  ];
  if (compareDecimal(selection.change, '0') > 0) {
    outputs.push({ address: changeAddress, amount: selection.change, tokenId });
  }
  if (feeCoin) {
    outputs.push({ address: changeAddress, amount: feeCoin.amount, tokenId: '0x00' });
  }

  return {
    buildParams: { inputs, outputs },
    selected,
    change: selection.change,
    feeCoin,
  };
}

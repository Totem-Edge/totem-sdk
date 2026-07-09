import type {
  TotemProvider,
  TotemWalletInfo,
  TotemAnnounceDetail,
  TotemConnectResponse,
  TotemVerifyResponse,
  TotemGetAccountsResponse,
  TotemSendTransactionResponse,
  TotemGetCoinsResponse,
  TotemSendComplexBuildResponse,
  TotemSendComplexSubmitResponse,
  TotemSignDataResponse,
  TotemBroadcastHexResponse,
  TotemGrantTxPermissionResponse,
  TotemRevokeTxPermissionResponse,
  TotemGetTxPermissionsResponse,
  EnhancedBuildParams,
  DAppTransactionIntent,
  TokenSpendingLimit,
  TotemGetCapabilitiesResponse,
  TotemGetProviderStatusResponse,
  TotemSetChainProviderResponse,
  TotemGetWotsStatusResponse,
  TotemReserveWotsLeaseResponse,
  TotemReleaseWotsLeaseResponse,
  TotemSignTransactionResponse,
  TotemMineTxPoWResponse,
  TotemBroadcastTxPoWResponse,
  TotemCreatePaymentRequestResponse,
  TotemPayPaymentRequestResponse,
  TotemGetTransactionStatusResponse,
  TotemGetReceiptResponse,
  TotemOmniaGetChannelsResponse,
  TotemOmniaOpenChannelResponse,
  TotemOmniaPayResponse,
  TotemOmniaSettleResponse,
  TotemOmniaCloseChannelResponse,
  TotemOmniaGetRouteResponse,
  TotemOmniaPayMultiHopResponse,
  TotemOmniaGetSwapRateResponse,
  TotemOmniaCreateFactoryResponse,
  TotemOmniaOpenVirtualChannelResponse,
  TotemOmniaCloseFactoryResponse,
  TotemOmniaSpliceInResponse,
  TotemOmniaSpliceOutResponse,
  TotemStatechainCreateResponse,
  TotemStatechainTransferResponse,
  TotemStatechainClaimResponse,
  TotemStatechainVerifyResponse,
  TotemKissvmSimulateResponse,
  TotemKissvmValidateResponse,
  TotemAgentProposePaymentResponse,
  TotemAgentExplainTransactionResponse,
  TotemAgentCreateReceiptResponse,
  Route,
  KissvmTxContext,
  KissvmWitness,
  StatechainTransferEntry,
} from './types.js';

import { TOTEM_ANNOUNCE, TOTEM_REQUEST_ANNOUNCE } from './types.js';

export type * from './types.js';
export { TOTEM_ANNOUNCE, TOTEM_REQUEST_ANNOUNCE } from './types.js';

export class TotemNotInstalledError extends Error {
  constructor() {
    super('No Totem-compatible wallet detected. Use WalletDiscovery to wait for a wallet announcement.');
    this.name = 'TotemNotInstalledError';
  }
}

export class TotemConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TotemConnectionError';
  }
}

// ─── Module-level active provider ────────────────────────────────────────────
// Set by WalletDiscovery (or manually via setActiveProvider) before calling
// any of the convenience functions below.

let _activeProvider: TotemProvider | null = null;

export function setActiveProvider(provider: TotemProvider): void {
  _activeProvider = provider;
}

export function clearActiveProvider(): void {
  _activeProvider = null;
}

export function isTotemInstalled(): boolean {
  return _activeProvider !== null;
}

export function getProvider(): TotemProvider {
  if (!_activeProvider) {
    throw new TotemNotInstalledError();
  }
  return _activeProvider;
}

// ─── WalletDiscovery ──────────────────────────────────────────────────────────

export interface DiscoveredWallet {
  info: TotemWalletInfo;
  provider: TotemProvider;
}

/**
 * WalletDiscovery — listens for wallet announcements via the 'totem:announce'
 * CustomEvent and maintains a live list of available wallets.
 *
 * Usage:
 *   const discovery = new WalletDiscovery();
 *
 *   // Subscribe to wallet list changes
 *   const unsubscribe = discovery.onChange((wallets) => {
 *     if (wallets.length === 1) {
 *       setActiveProvider(wallets[0].provider);
 *     }
 *   });
 *
 *   // Snapshot of currently-known wallets
 *   const wallets = discovery.getWallets();
 *
 *   // Teardown (removes the 'totem:announce' listener)
 *   discovery.destroy();
 */
export class WalletDiscovery {
  private readonly _wallets = new Map<string, DiscoveredWallet>();
  private readonly _listeners = new Set<(wallets: ReadonlyArray<DiscoveredWallet>) => void>();
  private readonly _onAnnounce: (event: Event) => void;
  private readonly _retryTimers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    this._onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<TotemAnnounceDetail>).detail;
      if (!detail?.info?.id || !detail?.provider) return;
      this._wallets.set(detail.info.id, { info: detail.info, provider: detail.provider });
      this._notify();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(TOTEM_ANNOUNCE, this._onAnnounce);
      // Initial request — fires immediately so fast-loading providers are caught.
      window.dispatchEvent(new CustomEvent(TOTEM_REQUEST_ANNOUNCE));

      // Retry dispatches handle the race where provider.js listener wasn't
      // registered yet when the initial request fired (or vice-versa).
      // Two retries at 150 ms and 800 ms cover both fast and slow page loads.
      this._retryTimers.push(
        setTimeout(() => {
          if (this._wallets.size === 0) {
            window.dispatchEvent(new CustomEvent(TOTEM_REQUEST_ANNOUNCE));
          }
        }, 150),
        setTimeout(() => {
          if (this._wallets.size === 0) {
            window.dispatchEvent(new CustomEvent(TOTEM_REQUEST_ANNOUNCE));
          }
        }, 800),
      );
    }
  }

  getWallets(): ReadonlyArray<DiscoveredWallet> {
    return [...this._wallets.values()];
  }

  onChange(
    callback: (wallets: ReadonlyArray<DiscoveredWallet>) => void,
  ): () => void {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  destroy(): void {
    for (const id of this._retryTimers) {
      clearTimeout(id);
    }
    this._retryTimers.length = 0;
    if (typeof window !== 'undefined') {
      window.removeEventListener(TOTEM_ANNOUNCE, this._onAnnounce);
    }
    this._listeners.clear();
  }

  private _notify(): void {
    const wallets = this.getWallets();
    this._listeners.forEach(cb => {
      try { cb(wallets); } catch { /* noop */ }
    });
  }
}

export async function connect(origin: string): Promise<TotemConnectResponse> {
  const provider = getProvider();
  try {
    return await provider.request({
      method: 'TOTEM_CONNECT',
      params: { origin }
    });
  } catch (err: any) {
    throw new TotemConnectionError(err.message || 'Failed to connect to Totem wallet');
  }
}

export async function verify(origin: string, challenge?: {
  statement?: string;
  nonce?: string;
  expiryMs?: number;
}): Promise<TotemVerifyResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'TOTEM_VERIFY',
    params: { origin, challenge }
  });
}

export async function getAccounts(origin: string): Promise<TotemGetAccountsResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'TOTEM_GET_ACCOUNTS',
    params: { origin }
  });
}

export async function sendTransaction(origin: string, request: {
  version: 1;
  intent?: DAppTransactionIntent;
  outputs: Array<{
    address: string;
    amount: string;
    tokenId?: string;
  }>;
}): Promise<TotemSendTransactionResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'TOTEM_SEND_TRANSACTION',
    params: { origin, request }
  });
}

export async function getCoins(origin: string, params?: {
  tokenId?: string;
  address?: string;
  minAmount?: string;
}): Promise<TotemGetCoinsResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'TOTEM_GET_COINS',
    params: { origin, ...params }
  });
}

export async function sendComplex(
  origin: string,
  buildParams: EnhancedBuildParams,
  mode?: 'build'
): Promise<TotemSendComplexBuildResponse>;
export async function sendComplex(
  origin: string,
  buildParams: EnhancedBuildParams,
  mode: 'submit'
): Promise<TotemSendComplexSubmitResponse>;
export async function sendComplex(
  origin: string,
  buildParams: EnhancedBuildParams,
  mode?: 'build' | 'submit'
): Promise<TotemSendComplexBuildResponse | TotemSendComplexSubmitResponse>;
export async function sendComplex(
  origin: string,
  buildParams: EnhancedBuildParams,
  mode?: 'build' | 'submit'
): Promise<TotemSendComplexBuildResponse | TotemSendComplexSubmitResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'TOTEM_SEND_COMPLEX',
    params: { origin, buildParams, mode }
  });
}

export async function signData(origin: string, params: {
  unsignedHex: string;
  inputAddresses: string[];
  inputIndices?: number[];
  returnFormat?: 'hex' | 'json';
}): Promise<TotemSignDataResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'TOTEM_SIGN_DATA',
    params: { origin, ...params }
  });
}

export async function broadcastHex(origin: string, params: {
  signedHex: string;
  expectedDigestTx?: string;
}): Promise<TotemBroadcastHexResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'TOTEM_BROADCAST_HEX',
    params: { origin, ...params }
  });
}

export async function grantTxPermission(origin: string, config: {
  allowedIntents?: DAppTransactionIntent[];
  tokenLimits?: TokenSpendingLimit[];
  expiresInDays?: number;
}): Promise<TotemGrantTxPermissionResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'TOTEM_GRANT_TX_PERMISSION',
    params: { origin, config }
  });
}

export async function revokeTxPermission(origin: string): Promise<TotemRevokeTxPermissionResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'TOTEM_REVOKE_TX_PERMISSION',
    params: { origin }
  });
}

export async function getTxPermissions(): Promise<TotemGetTxPermissionsResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'TOTEM_GET_TX_PERMISSIONS',
    params: {}
  });
}

export function onEvent(event: string, handler: (...args: unknown[]) => void): () => void {
  const provider = getProvider();
  provider.on(event, handler);
  return () => provider.removeListener(event, handler);
}

/** @deprecated Use verify() instead */
export const requestSignature = verify;

// ─── Capability discovery ─────────────────────────────────────────────────────

export async function getCapabilities(): Promise<TotemGetCapabilitiesResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_getCapabilities'
  });
}

export async function getProviderStatus(): Promise<TotemGetProviderStatusResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_getProviderStatus'
  });
}

// ─── Core / WOTS / Chain ──────────────────────────────────────────────────────

export async function setChainProvider(params: {
  providerType: 'hosted' | 'pure_rpc' | 'hybrid';
  rpcEndpoint?: string;
}): Promise<TotemSetChainProviderResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_setChainProvider',
    params
  });
}

export async function getWotsStatus(params?: {
  address?: string;
  addressIndex?: number;
}): Promise<TotemGetWotsStatusResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_getWotsStatus',
    params: params ?? {}
  });
}

export async function reserveWotsLease(params?: {
  address?: string;
  addressIndex?: number;
  purpose?: string;
  ttlMs?: number;
}): Promise<TotemReserveWotsLeaseResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_reserveWotsLease',
    params: params ?? {}
  });
}

export async function releaseWotsLease(params: {
  reservationId: string;
  reason?: string;
}): Promise<TotemReleaseWotsLeaseResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_releaseWotsLease',
    params
  });
}

// ─── Transaction flow ─────────────────────────────────────────────────────────

export async function signTransaction(origin: string, params: {
  unsignedHex: string;
  inputAddresses: string[];
  inputIndices?: number[];
  returnFormat?: 'hex' | 'json';
}): Promise<TotemSignTransactionResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_signTransaction',
    params: { origin, ...params }
  });
}

export async function mineTxPoW(origin: string, params: {
  signedHex: string;
  difficulty?: number;
}): Promise<TotemMineTxPoWResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_mineTxPoW',
    params: { origin, ...params }
  });
}

export async function broadcastTxPoW(origin: string, params: {
  minedHex: string;
  expectedTxpowId?: string;
}): Promise<TotemBroadcastTxPoWResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_broadcastTxPoW',
    params: { origin, ...params }
  });
}

// ─── TESSA Pay (payment requests) ────────────────────────────────────────────

export async function createPaymentRequest(origin: string, params: {
  amount: string;
  tokenId?: string;
  description?: string;
  expiryMs?: number;
}): Promise<TotemCreatePaymentRequestResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_createPaymentRequest',
    params: { origin, ...params }
  });
}

export async function payPaymentRequest(origin: string, params: {
  paymentUri: string;
  maxFeePercent?: number;
}): Promise<TotemPayPaymentRequestResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_payPaymentRequest',
    params: { origin, ...params }
  });
}

export async function getTransactionStatus(txpowId: string): Promise<TotemGetTransactionStatusResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_getTransactionStatus',
    params: { txpowId }
  });
}

export async function getReceipt(txpowId: string): Promise<TotemGetReceiptResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_getReceipt',
    params: { txpowId }
  });
}

// ─── Omnia direct-channel ─────────────────────────────────────────────────────

export async function omniaGetChannels(origin: string, params?: {
  tokenId?: string;
  status?: string;
}): Promise<TotemOmniaGetChannelsResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_omniaGetChannels',
    params: { origin, ...params }
  });
}

export async function omniaOpenChannel(origin: string, params: {
  remotePartyId: string;
  localAmount: string;
  remoteAmount: string;
  tokenId?: string;
  fundingCoinId: string;
}): Promise<TotemOmniaOpenChannelResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_omniaOpenChannel',
    params: { origin, ...params }
  });
}

export async function omniaPay(origin: string, params: {
  channelId: string;
  amount: string;
  tokenId?: string;
  memo?: string;
}): Promise<TotemOmniaPayResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_omniaPay',
    params: { origin, ...params }
  });
}

export async function omniaSettle(origin: string, channelId: string): Promise<TotemOmniaSettleResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_omniaSettle',
    params: { origin, channelId }
  });
}

export async function omniaCloseChannel(origin: string, params: {
  channelId: string;
  force?: boolean;
}): Promise<TotemOmniaCloseChannelResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_omniaCloseChannel',
    params: { origin, ...params }
  });
}

// ─── Omnia Router ─────────────────────────────────────────────────────────────

export async function omniaGetRoute(origin: string, params: {
  fromPartyId: string;
  toPartyId: string;
  amount: string;
  tokenId: string;
  targetTokenId?: string;
  maxHops?: number;
}): Promise<TotemOmniaGetRouteResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_omniaGetRoute',
    params: { origin, ...params }
  });
}

export async function omniaPayMultiHop(origin: string, params: {
  route: Route;
  hashlock: string;
  timeoutBlocks?: number;
}): Promise<TotemOmniaPayMultiHopResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_omniaPayMultiHop',
    params: { origin, ...params }
  });
}

export async function omniaGetSwapRate(origin: string, params: {
  tokenIn: string;
  tokenOut: string;
}): Promise<TotemOmniaGetSwapRateResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_omniaGetSwapRate',
    params: { origin, ...params }
  });
}

// ─── Omnia Factory ────────────────────────────────────────────────────────────

export async function omniaCreateFactory(origin: string, params: {
  partyIds: string[];
  amounts: string[];
  tokenId?: string;
  fundingCoinIds?: string[];
}): Promise<TotemOmniaCreateFactoryResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_omniaCreateFactory',
    params: { origin, ...params }
  });
}

export async function omniaOpenVirtualChannel(origin: string, params: {
  factoryId: string;
  remotePartyId: string;
  localAmount: string;
  remoteAmount: string;
  tokenId?: string;
}): Promise<TotemOmniaOpenVirtualChannelResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_omniaOpenVirtualChannel',
    params: { origin, ...params }
  });
}

export async function omniaCloseFactory(origin: string, factoryId: string): Promise<TotemOmniaCloseFactoryResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_omniaCloseFactory',
    params: { origin, factoryId }
  });
}

// ─── Omnia Splice ─────────────────────────────────────────────────────────────

export async function omniaSpliceIn(origin: string, params: {
  channelId: string;
  newTotalValue: string;
  newBalances: Record<string, string>;
  additionalCoinId: string;
}): Promise<TotemOmniaSpliceInResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_omniaSpliceIn',
    params: { origin, ...params }
  });
}

export async function omniaSpliceOut(origin: string, params: {
  channelId: string;
  newTotalValue: string;
  newBalances: Record<string, string>;
  withdrawAmount: string;
  withdrawAddress: string;
}): Promise<TotemOmniaSpliceOutResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_omniaSpliceOut',
    params: { origin, ...params }
  });
}

// ─── Statechain ───────────────────────────────────────────────────────────────

export async function statechainCreate(origin: string, params: {
  coinId: string;
  ownerPublicKeyDigest: string;
  seEndpoint: string;
  reclaimTimelock?: number;
}): Promise<TotemStatechainCreateResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_statechainCreate',
    params: { origin, ...params }
  });
}

export async function statechainTransfer(origin: string, params: {
  chainId: string;
  newOwnerPublicKeyDigest: string;
}): Promise<TotemStatechainTransferResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_statechainTransfer',
    params: { origin, ...params }
  });
}

export async function statechainClaim(origin: string, params: {
  chainId: string;
  claimAddress: string;
  cooperative?: boolean;
}): Promise<TotemStatechainClaimResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_statechainClaim',
    params: { origin, ...params }
  });
}

export async function statechainVerify(origin: string, params: {
  chainId: string;
  transferHistory: StatechainTransferEntry[];
}): Promise<TotemStatechainVerifyResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_statechainVerify',
    params: { origin, ...params }
  });
}

// ─── KISSVM scripting ─────────────────────────────────────────────────────────

export async function kissvmSimulate(params: {
  script: string;
  txContext: KissvmTxContext;
  witness?: KissvmWitness;
}): Promise<TotemKissvmSimulateResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_kissvmSimulate',
    params
  });
}

export async function kissvmValidate(script: string): Promise<TotemKissvmValidateResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_kissvmValidate',
    params: { script }
  });
}

// ─── QVAC stubs (forward-looking) ────────────────────────────────────────────

export async function agentProposePayment(origin: string, params: {
  amount: string;
  tokenId?: string;
  recipient: string;
  intent?: string;
  context?: Record<string, unknown>;
}): Promise<TotemAgentProposePaymentResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_agentProposePayment',
    params: { origin, ...params }
  });
}

export async function agentExplainTransaction(origin: string, params: {
  txpowId?: string;
  unsignedHex?: string;
  context?: Record<string, unknown>;
}): Promise<TotemAgentExplainTransactionResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_agentExplainTransaction',
    params: { origin, ...params }
  });
}

export async function agentCreateReceipt(origin: string, params: {
  txpowId: string;
  metadata?: Record<string, unknown>;
}): Promise<TotemAgentCreateReceiptResponse> {
  const provider = getProvider();
  return await provider.request({
    method: 'totem_agentCreateReceipt',
    params: { origin, ...params }
  });
}

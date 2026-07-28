export type DAppTransactionIntent =
  | 'send'
  | 'token_send'
  | 'swap'
  | 'liquidity_add'
  | 'liquidity_remove'
  | 'contract_call'
  | 'multisig'
  | 'timelock'
  | 'htlc'
  | 'custom'
  | 'utxo_read'
  | 'complex_send'
  | 'sign_data'
  | 'broadcast_tx';

export type ScriptType =
  | 'signedby'
  | 'multisig'
  | 'multisig_mofn'
  | 'timelock'
  | 'htlc'
  | 'mast'
  | 'exchange'
  | 'vault'
  | 'flashcash'
  | 'slowcash'
  | 'stateful'
  | 'custom';

export type StateVariableType = 'number' | 'string' | 'hex' | 'bool';

export interface StateVariable {
  port: number;
  value: string;
  type?: StateVariableType;
}

// ─── TOTEM_ANNOUNCE multi-wallet discovery ────────────────────────────────────

export const TOTEM_ANNOUNCE = 'totem:announce' as const;
export const TOTEM_REQUEST_ANNOUNCE = 'totem:requestAnnounce' as const;

export interface TotemWalletInfo {
  id: string;
  name: string;
  icon?: string;
  version?: string;
}

export interface TotemAnnounceDetail {
  info: TotemWalletInfo;
  provider: TotemProvider;
}

// ─── Capability discovery ─────────────────────────────────────────────────────

export interface TotemCapabilities {
  version: string;
  wallet: {
    selfCustody: boolean;
    wotsTreeKey: boolean;
    rootIdentity: boolean;
    treeKeyDepth: number | null;
    maxAddresses: number | null;
    seedExport: boolean;
    custodyType: 'self' | 'hosted' | 'hybrid';
  };
  account: {
    multiAddress: boolean;
    accountSwitcher: boolean;
  };
  chain: {
    hostedProvider: boolean;
    pureMinimaRpc: boolean;
    lookupNode: boolean;
    localProofVerify: boolean;
    pearRuntime: boolean;
    hyperswarm: boolean;
  };
  txpow: {
    localMining: boolean;
    progressEvents: boolean;
  };
  omnia: {
    channels: boolean;
    routing: boolean;
    multiHop: boolean;
    crossTokenSwap: boolean;
    factory: boolean;
    virtualChannels: boolean;
    splicing: boolean;
    hyperswarm: boolean;
  };
  statechain: {
    supported: boolean;
    blindSE: boolean;
  };
  scripting: {
    kissvm: boolean;
  };
  qvac: {
    paymentIntents: boolean;
    explanations: boolean;
  };
}

export interface TotemProviderStatus {
  providerType: 'hosted' | 'pure_rpc' | 'hybrid';
  network: string;
  relayAvailable: boolean;
  localMiningAvailable: boolean;
  pearRuntime: boolean;
  lookupLatencyMs: number | null;
}

// ─── Capability request/response ──────────────────────────────────────────────

export interface TotemGetCapabilitiesRequest {
  method: 'totem_getCapabilities';
  params?: Record<string, never>;
}

export type TotemGetCapabilitiesResponse = TotemCapabilities;

export interface TotemGetProviderStatusRequest {
  method: 'totem_getProviderStatus';
  params?: Record<string, never>;
}

export type TotemGetProviderStatusResponse = TotemProviderStatus;

// ─── Core / WOTS / Chain ──────────────────────────────────────────────────────

export interface TotemSetChainProviderRequest {
  method: 'totem_setChainProvider';
  params: {
    providerType: 'hosted' | 'pure_rpc' | 'hybrid';
    rpcEndpoint?: string;
  };
}

export interface TotemSetChainProviderResponse {
  success: boolean;
  providerType: string;
}

export interface TotemGetWotsStatusRequest {
  method: 'totem_getWotsStatus';
  params: {
    address?: string;
    addressIndex?: number;
  };
}

export interface TotemGetWotsStatusResponse {
  address: string;
  addressIndex: number;
  totalSlots: number;
  usedSlots: number;
  availableSlots: number;
  nearExhaustion: boolean;
}

export interface TotemReserveWotsLeaseRequest {
  method: 'totem_reserveWotsLease';
  params: {
    address?: string;
    addressIndex?: number;
    purpose?: string;
    ttlMs?: number;
  };
}

export interface TotemReserveWotsLeaseResponse {
  reservationId: string;
  addressIndex: number;
  l1: number;
  l2: number;
  expiresAt: number;
}

export interface TotemReleaseWotsLeaseRequest {
  method: 'totem_releaseWotsLease';
  params: {
    reservationId: string;
    reason?: string;
  };
}

export interface TotemReleaseWotsLeaseResponse {
  success: boolean;
  reservationId: string;
}

// ─── Transaction flow ─────────────────────────────────────────────────────────

export interface TotemSignTransactionRequest {
  method: 'totem_signTransaction';
  params: {
    origin: string;
    unsignedHex: string;
    inputAddresses: string[];
    inputIndices?: number[];
    returnFormat?: 'hex' | 'json';
  };
}

export interface TotemSignTransactionResponse {
  success: boolean;
  signedHex?: string;
  signatures?: object[];
  error?: string;
  errorCode?: string;
}

export interface TotemMineTxPoWRequest {
  method: 'totem_mineTxPoW';
  params: {
    origin: string;
    signedHex: string;
    difficulty?: number;
  };
}

export interface TotemMineTxPoWResponse {
  success: boolean;
  minedHex?: string;
  txpowId?: string;
  error?: string;
  errorCode?: string;
}

export interface TotemBroadcastTxPoWRequest {
  method: 'totem_broadcastTxPoW';
  params: {
    origin: string;
    minedHex: string;
    expectedTxpowId?: string;
  };
}

export interface TotemBroadcastTxPoWResponse {
  success: boolean;
  txpowId?: string;
  status?: 'submitted';
  error?: string;
  errorCode?: string;
}

// ─── TESSA Pay (payment requests) ────────────────────────────────────────────

export interface TotemCreatePaymentRequestRequest {
  method: 'totem_createPaymentRequest';
  params: {
    origin: string;
    amount: string;
    tokenId?: string;
    description?: string;
    expiryMs?: number;
  };
}

export interface TotemCreatePaymentRequestResponse {
  success: boolean;
  requestId?: string;
  hashlock?: string;
  paymentUri?: string;
  expiresAt?: number;
  error?: string;
  errorCode?: string;
}

export interface TotemPayPaymentRequestRequest {
  method: 'totem_payPaymentRequest';
  params: {
    origin: string;
    paymentUri: string;
    maxFeePercent?: number;
  };
}

export interface TotemPayPaymentRequestResponse {
  success: boolean;
  txpowId?: string;
  preimage?: string;
  status?: 'paid' | 'pending' | 'failed';
  error?: string;
  errorCode?: string;
}

export interface TotemGetTransactionStatusRequest {
  method: 'totem_getTransactionStatus';
  params: {
    txpowId: string;
  };
}

export interface TotemGetTransactionStatusResponse {
  txpowId: string;
  status: 'pending' | 'confirmed' | 'failed' | 'unknown';
  blockNumber?: number;
  confirmedAt?: number;
}

export interface TotemGetReceiptRequest {
  method: 'totem_getReceipt';
  params: {
    txpowId: string;
  };
}

export interface TotemGetReceiptResponse {
  txpowId: string;
  amount: string;
  tokenId: string;
  from: string;
  to: string;
  timestamp: number;
  blockNumber?: number;
  description?: string;
}

// ─── Omnia direct-channel ─────────────────────────────────────────────────────

export interface OmniaChannelSummary {
  channelId: string;
  status: string;
  tokenId: string;
  totalValue: string;
  localBalance: string;
  remoteBalance: string;
  currentSequence: number;
}

export interface TotemOmniaGetChannelsRequest {
  method: 'totem_omniaGetChannels';
  params: {
    origin: string;
    tokenId?: string;
    status?: string;
  };
}

export interface TotemOmniaGetChannelsResponse {
  channels: OmniaChannelSummary[];
}

export interface TotemOmniaOpenChannelRequest {
  method: 'totem_omniaOpenChannel';
  params: {
    origin: string;
    remotePartyId: string;
    localAmount: string;
    remoteAmount: string;
    tokenId?: string;
    fundingCoinId: string;
  };
}

export interface TotemOmniaOpenChannelResponse {
  success: boolean;
  channelId?: string;
  fundingTxId?: string;
  error?: string;
  errorCode?: string;
}

export interface TotemOmniaPayRequest {
  method: 'totem_omniaPay';
  params: {
    origin: string;
    channelId: string;
    amount: string;
    tokenId?: string;
    memo?: string;
  };
}

export interface TotemOmniaPayResponse {
  success: boolean;
  channelId?: string;
  sequence?: number;
  localBalance?: string;
  remoteBalance?: string;
  error?: string;
  errorCode?: string;
}

export interface TotemOmniaSettleRequest {
  method: 'totem_omniaSettle';
  params: {
    origin: string;
    channelId: string;
  };
}

export interface TotemOmniaSettleResponse {
  success: boolean;
  channelId?: string;
  settlementTxId?: string;
  finalBalances?: Record<string, string>;
  error?: string;
  errorCode?: string;
}

export interface TotemOmniaCloseChannelRequest {
  method: 'totem_omniaCloseChannel';
  params: {
    origin: string;
    channelId: string;
    force?: boolean;
  };
}

export interface TotemOmniaCloseChannelResponse {
  success: boolean;
  channelId?: string;
  closingTxId?: string;
  error?: string;
  errorCode?: string;
}

// ─── Omnia Router ─────────────────────────────────────────────────────────────

export interface RoutingHop {
  channelId: string;
  from: string;
  to: string;
  amount: string;
  tokenId: string;
  htlcId?: string;
}

export interface SwapHop extends RoutingHop {
  isSwap: true;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  rate: string;
  inboundChannelId: string;
  outboundChannelId: string;
}

export interface Route {
  hops: (RoutingHop | SwapHop)[];
  totalFees: string;
  tokenIn: string;
  tokenOut: string;
  estimatedBlocks: number;
}

export interface SwapAnnouncement {
  intermediaryPubKey: string;
  tokenIn: string;
  tokenOut: string;
  rate: string;
  inboundChannelId: string;
  outboundChannelId: string;
  maxAmountIn: string;
}

export interface TotemOmniaGetRouteRequest {
  method: 'totem_omniaGetRoute';
  params: {
    origin: string;
    fromPartyId: string;
    toPartyId: string;
    amount: string;
    tokenId: string;
    targetTokenId?: string;
    maxHops?: number;
  };
}

export interface TotemOmniaGetRouteResponse {
  success: boolean;
  route?: Route;
  error?: string;
  errorCode?: string;
}

export interface TotemOmniaPayMultiHopRequest {
  method: 'totem_omniaPayMultiHop';
  params: {
    origin: string;
    route: Route;
    hashlock: string;
    timeoutBlocks?: number;
  };
}

export interface TotemOmniaPayMultiHopResponse {
  success: boolean;
  preimage?: string;
  settledHops?: string[];
  error?: string;
  errorCode?: string;
}

export interface TotemOmniaGetSwapRateRequest {
  method: 'totem_omniaGetSwapRate';
  params: {
    origin: string;
    tokenIn: string;
    tokenOut: string;
  };
}

export interface TotemOmniaGetSwapRateResponse {
  success: boolean;
  announcements?: SwapAnnouncement[];
  error?: string;
  errorCode?: string;
}

// ─── Omnia Factory ────────────────────────────────────────────────────────────

export interface TotemOmniaCreateFactoryRequest {
  method: 'totem_omniaCreateFactory';
  params: {
    origin: string;
    partyIds: string[];
    amounts: string[];
    tokenId?: string;
    fundingCoinIds?: string[];
  };
}

export interface TotemOmniaCreateFactoryResponse {
  success: boolean;
  factoryId?: string;
  fundingTxId?: string;
  error?: string;
  errorCode?: string;
}

export interface TotemOmniaOpenVirtualChannelRequest {
  method: 'totem_omniaOpenVirtualChannel';
  params: {
    origin: string;
    factoryId: string;
    remotePartyId: string;
    localAmount: string;
    remoteAmount: string;
    tokenId?: string;
  };
}

export interface TotemOmniaOpenVirtualChannelResponse {
  success: boolean;
  channelId?: string;
  error?: string;
  errorCode?: string;
}

export interface TotemOmniaCloseFactoryRequest {
  method: 'totem_omniaCloseFactory';
  params: {
    origin: string;
    factoryId: string;
  };
}

export interface TotemOmniaCloseFactoryResponse {
  success: boolean;
  factoryId?: string;
  settlementTxId?: string;
  finalAllocations?: Record<string, string>;
  error?: string;
  errorCode?: string;
}

// ─── Omnia Splice ─────────────────────────────────────────────────────────────

export interface TotemOmniaSpliceInRequest {
  method: 'totem_omniaSpliceIn';
  params: {
    origin: string;
    channelId: string;
    newTotalValue: string;
    newBalances: Record<string, string>;
    additionalCoinId: string;
  };
}

export interface TotemOmniaSpliceInResponse {
  success: boolean;
  channelId?: string;
  newTotalValue?: string;
  updatedChannelState?: string;
  spliceTxId?: string;
  error?: string;
  errorCode?: string;
}

export interface TotemOmniaSpliceOutRequest {
  method: 'totem_omniaSpliceOut';
  params: {
    origin: string;
    channelId: string;
    newTotalValue: string;
    newBalances: Record<string, string>;
    withdrawAmount: string;
    withdrawAddress: string;
  };
}

export interface TotemOmniaSpliceOutResponse {
  success: boolean;
  channelId?: string;
  newTotalValue?: string;
  updatedChannelState?: string;
  spliceTxId?: string;
  error?: string;
  errorCode?: string;
}

// ─── Statechain ───────────────────────────────────────────────────────────────

export interface StatechainTransferEntry {
  from: string;
  to: string;
  fromPublicKeyDigest: string;
  toPublicKeyDigest: string;
  blindedSignature: string;
  ownerSignature: string;
  signedDigest: string;
  txBodyHex: string;
  txHex: string;
  timestamp: number;
}

export interface TotemStatechainCreateRequest {
  method: 'totem_statechainCreate';
  params: {
    origin: string;
    coinId: string;
    ownerPublicKeyDigest: string;
    seEndpoint: string;
    reclaimTimelock?: number;
  };
}

export interface TotemStatechainCreateResponse {
  success: boolean;
  chainId?: string;
  lockingAddress?: string;
  lockTxId?: string;
  error?: string;
  errorCode?: string;
}

export interface TotemStatechainTransferRequest {
  method: 'totem_statechainTransfer';
  params: {
    origin: string;
    chainId: string;
    newOwnerPublicKeyDigest: string;
  };
}

export interface TotemStatechainTransferResponse {
  success: boolean;
  chainId?: string;
  transferRecord?: StatechainTransferEntry;
  error?: string;
  errorCode?: string;
}

export interface TotemStatechainClaimRequest {
  method: 'totem_statechainClaim';
  params: {
    origin: string;
    chainId: string;
    claimAddress: string;
    cooperative?: boolean;
  };
}

export interface TotemStatechainClaimResponse {
  success: boolean;
  chainId?: string;
  txpowId?: string;
  cooperative?: boolean;
  error?: string;
  errorCode?: string;
}

export interface TotemStatechainVerifyRequest {
  method: 'totem_statechainVerify';
  params: {
    origin: string;
    chainId: string;
    transferHistory: StatechainTransferEntry[];
  };
}

export interface TotemStatechainVerifyResponse {
  valid: boolean;
  chainId: string;
  hopsVerified: number;
  error?: string;
}

// ─── KISSVM scripting ─────────────────────────────────────────────────────────

export interface KissvmCoinData {
  amount: number;
  tokenId: string;
  coinId: string;
  address: string;
  coinCreatedBlock?: number;
  scriptHash?: string;
}

export interface KissvmOutputData {
  address: string;
  amount: number;
  tokenId: string;
  keepState: boolean;
}

export interface KissvmTxContext {
  block: number;
  inputIndex: number;
  inputs: KissvmCoinData[];
  outputs: KissvmOutputData[];
  state: Record<number, string>;
  prevState: Record<number, string>;
  txDigest?: string;
  simulationMode?: boolean;
}

export interface KissvmWitness {
  signatures: Record<string, string>;
  preimages?: Record<string, string>;
}

export interface TotemKissvmSimulateRequest {
  method: 'totem_kissvmSimulate';
  params: {
    script: string;
    txContext: KissvmTxContext;
    witness?: KissvmWitness;
  };
}

export interface TotemKissvmSimulateResponse {
  passed: boolean;
  trace: string[];
  instructionsUsed: number;
  error?: string;
}

export interface TotemKissvmValidateRequest {
  method: 'totem_kissvmValidate';
  params: {
    script: string;
  };
}

export interface TotemKissvmValidateResponse {
  valid: boolean;
  errors: Array<{
    message: string;
    line?: number;
    column?: number;
  }>;
}

// ─── QVAC stubs (forward-looking) ────────────────────────────────────────────

export interface TotemAgentProposePaymentRequest {
  method: 'totem_agentProposePayment';
  params: {
    origin: string;
    amount: string;
    tokenId?: string;
    recipient: string;
    intent?: string;
    context?: Record<string, unknown>;
  };
}

export interface TotemAgentProposePaymentResponse {
  success: boolean;
  proposalId?: string;
  status?: 'approved' | 'pending_user' | 'rejected';
  error?: string;
  errorCode?: string;
}

export interface TotemAgentExplainTransactionRequest {
  method: 'totem_agentExplainTransaction';
  params: {
    origin: string;
    txpowId?: string;
    unsignedHex?: string;
    context?: Record<string, unknown>;
  };
}

export interface TotemAgentExplainTransactionResponse {
  explanation: string;
  riskLevel?: 'low' | 'medium' | 'high';
  warnings?: string[];
}

export interface TotemAgentCreateReceiptRequest {
  method: 'totem_agentCreateReceipt';
  params: {
    origin: string;
    txpowId: string;
    metadata?: Record<string, unknown>;
  };
}

export interface TotemAgentCreateReceiptResponse {
  success: boolean;
  receiptId?: string;
  receiptUri?: string;
  error?: string;
  errorCode?: string;
}

// ─── TotemProvider interface ──────────────────────────────────────────────────

export interface TotemProvider {
  isTotem: true;

  request(args: TotemConnectRequest): Promise<TotemConnectResponse>;
  request(args: TotemVerifyRequest): Promise<TotemVerifyResponse>;
  request(args: TotemGetAccountsRequest): Promise<TotemGetAccountsResponse>;
  request(args: TotemSendTransactionRequest): Promise<TotemSendTransactionResponse>;
  request(args: TotemGetCoinsRequest): Promise<TotemGetCoinsResponse>;
  request(args: TotemSendComplexRequest & { params: { mode: 'build' } }): Promise<TotemSendComplexBuildResponse>;
  request(args: TotemSendComplexRequest & { params: { mode?: 'submit' } }): Promise<TotemSendComplexSubmitResponse>;
  request(args: TotemSendComplexRequest): Promise<TotemSendComplexBuildResponse | TotemSendComplexSubmitResponse>;
  request(args: TotemSignDataRequest): Promise<TotemSignDataResponse>;
  request(args: TotemBroadcastHexRequest): Promise<TotemBroadcastHexResponse>;
  request(args: TotemGrantTxPermissionRequest): Promise<TotemGrantTxPermissionResponse>;
  request(args: TotemRevokeTxPermissionRequest): Promise<TotemRevokeTxPermissionResponse>;
  request(args: TotemGetTxPermissionsRequest): Promise<TotemGetTxPermissionsResponse>;

  // Capability discovery
  request(args: TotemGetCapabilitiesRequest): Promise<TotemGetCapabilitiesResponse>;
  request(args: TotemGetProviderStatusRequest): Promise<TotemGetProviderStatusResponse>;

  // Core / WOTS / Chain
  request(args: TotemSetChainProviderRequest): Promise<TotemSetChainProviderResponse>;
  request(args: TotemGetWotsStatusRequest): Promise<TotemGetWotsStatusResponse>;
  request(args: TotemReserveWotsLeaseRequest): Promise<TotemReserveWotsLeaseResponse>;
  request(args: TotemReleaseWotsLeaseRequest): Promise<TotemReleaseWotsLeaseResponse>;

  // Transaction flow
  request(args: TotemSignTransactionRequest): Promise<TotemSignTransactionResponse>;
  request(args: TotemMineTxPoWRequest): Promise<TotemMineTxPoWResponse>;
  request(args: TotemBroadcastTxPoWRequest): Promise<TotemBroadcastTxPoWResponse>;

  // TESSA Pay
  request(args: TotemCreatePaymentRequestRequest): Promise<TotemCreatePaymentRequestResponse>;
  request(args: TotemPayPaymentRequestRequest): Promise<TotemPayPaymentRequestResponse>;
  request(args: TotemGetTransactionStatusRequest): Promise<TotemGetTransactionStatusResponse>;
  request(args: TotemGetReceiptRequest): Promise<TotemGetReceiptResponse>;

  // Omnia direct-channel
  request(args: TotemOmniaGetChannelsRequest): Promise<TotemOmniaGetChannelsResponse>;
  request(args: TotemOmniaOpenChannelRequest): Promise<TotemOmniaOpenChannelResponse>;
  request(args: TotemOmniaPayRequest): Promise<TotemOmniaPayResponse>;
  request(args: TotemOmniaSettleRequest): Promise<TotemOmniaSettleResponse>;
  request(args: TotemOmniaCloseChannelRequest): Promise<TotemOmniaCloseChannelResponse>;

  // Omnia Router
  request(args: TotemOmniaGetRouteRequest): Promise<TotemOmniaGetRouteResponse>;
  request(args: TotemOmniaPayMultiHopRequest): Promise<TotemOmniaPayMultiHopResponse>;
  request(args: TotemOmniaGetSwapRateRequest): Promise<TotemOmniaGetSwapRateResponse>;

  // Omnia Factory
  request(args: TotemOmniaCreateFactoryRequest): Promise<TotemOmniaCreateFactoryResponse>;
  request(args: TotemOmniaOpenVirtualChannelRequest): Promise<TotemOmniaOpenVirtualChannelResponse>;
  request(args: TotemOmniaCloseFactoryRequest): Promise<TotemOmniaCloseFactoryResponse>;

  // Omnia Splice
  request(args: TotemOmniaSpliceInRequest): Promise<TotemOmniaSpliceInResponse>;
  request(args: TotemOmniaSpliceOutRequest): Promise<TotemOmniaSpliceOutResponse>;

  // Statechain
  request(args: TotemStatechainCreateRequest): Promise<TotemStatechainCreateResponse>;
  request(args: TotemStatechainTransferRequest): Promise<TotemStatechainTransferResponse>;
  request(args: TotemStatechainClaimRequest): Promise<TotemStatechainClaimResponse>;
  request(args: TotemStatechainVerifyRequest): Promise<TotemStatechainVerifyResponse>;

  // KISSVM scripting
  request(args: TotemKissvmSimulateRequest): Promise<TotemKissvmSimulateResponse>;
  request(args: TotemKissvmValidateRequest): Promise<TotemKissvmValidateResponse>;

  // QVAC stubs
  request(args: TotemAgentProposePaymentRequest): Promise<TotemAgentProposePaymentResponse>;
  request(args: TotemAgentExplainTransactionRequest): Promise<TotemAgentExplainTransactionResponse>;
  request(args: TotemAgentCreateReceiptRequest): Promise<TotemAgentCreateReceiptResponse>;

  request(args: TotemRequest): Promise<unknown>;

  on(event: string, handler: (...args: unknown[]) => void): void;
  removeListener(event: string, handler: (...args: unknown[]) => void): void;

  enable(): Promise<TotemConnectResponse>;
  send(method: string, params?: unknown[]): Promise<unknown>;
  getCoins(params?: { tokenId?: string; address?: string; minAmount?: string }): Promise<unknown>;
  sendComplex(buildParams: Record<string, unknown>, mode?: 'build' | 'submit'): Promise<unknown>;
  signData(params: { unsignedHex: string; inputAddresses: string[]; inputIndices?: number[]; returnFormat?: string }): Promise<unknown>;
  broadcastHex(params: { signedHex: string; expectedDigestTx?: string }): Promise<unknown>;
}

export interface TotemRequest {
  method: string;
  params?: Record<string, unknown>;
}

export interface TotemConnectRequest {
  method: 'TOTEM_CONNECT';
  params: {
    origin: string;
  };
}

export interface TotemConnectResponse {
  connected: true;
  address: string;
  addressIndex: number;
  publicKey: string | null;
  isReconnect?: boolean;
}

export interface TotemVerifyRequest {
  method: 'TOTEM_VERIFY';
  params: {
    origin: string;
    challenge?: {
      statement?: string;
      nonce?: string;
      expiryMs?: number;
    };
  };
}

export interface TotemVerifyResponse {
  verified: true;
  verificationId: string;
  address: string;
  message: string;
  signature: string;
  publicKey: string;
  expiresAt: number;
  sessionToken?: string;
  sessionExpiresAt?: number;
}

export interface TotemGetAccountsRequest {
  method: 'TOTEM_GET_ACCOUNTS';
  params: {
    origin: string;
  };
}

export interface TotemGetAccountsResponse {
  accounts: Array<{
    index: number;
    address: string;
    balance: string;
  }>;
}

export interface TotemSendTransactionRequest {
  method: 'TOTEM_SEND_TRANSACTION';
  params: {
    origin: string;
    request: {
      version: 1;
      intent?: DAppTransactionIntent;
      outputs: Array<{
        address: string;
        amount: string;
        tokenId?: string;
      }>;
    };
  };
}

export interface TotemSendTransactionSuccessResponse {
  success: true;
  txpowid: string;
  status: 'submitted';
}

export interface TotemSendTransactionErrorResponse {
  success: false;
  error: string;
  errorCode: string;
  requiresApproval?: boolean;
  requestedIntent?: string;
  requestedToken?: string;
  requestedAmount?: string;
}

export type TotemSendTransactionResponse =
  | TotemSendTransactionSuccessResponse
  | TotemSendTransactionErrorResponse;

export interface TotemGetCoinsRequest {
  method: 'TOTEM_GET_COINS';
  params: {
    origin: string;
    tokenId?: string;
    address?: string;
    minAmount?: string;
  };
}

export interface TotemGetCoinsSuccessResponse {
  success: true;
  coins: Array<{
    coinId: string;
    address: string;
    amount: string;
    tokenId: string;
    created: string;
  }>;
  totalCoins: number;
  queriedAddresses: number;
  tokenId: string;
}

export interface TotemGetCoinsErrorResponse {
  success: false;
  error: string;
  errorCode: string;
  requiredIntent?: string;
}

export type TotemGetCoinsResponse =
  | TotemGetCoinsSuccessResponse
  | TotemGetCoinsErrorResponse;

export interface InputScriptDescriptor {
  scriptType: ScriptType;
  script: string;
  wotsRootPublicKey?: string;
  mastProof?: object;
  extraScripts?: object;
  multisigKeys?: string[];
  multisigThreshold?: number;
  externalSignatures?: object[];
  htlcHash?: string;
  htlcPreimage?: string;
  timelockBlock?: bigint;
  stateVariables?: StateVariable[];
  verifyOutExpectations?: Array<{
    inputIndex: string;
    outputAddress: string;
    amount: string;
    tokenId: string;
    keepState: boolean;
  }>;
  storeState?: boolean;
}

export interface EnhancedBuildParams {
  inputs: Array<{
    coinId: string;
    address: string;
    amount: string;
    tokenId?: string;
    scriptDescriptor: InputScriptDescriptor;
  }>;
  outputs: Array<{
    address: string;
    amount: string;
    tokenId?: string;
    state?: StateVariable[];
  }>;
  transactionState?: StateVariable[];
  linkHash?: string;
}

export interface TotemSendComplexRequest {
  method: 'TOTEM_SEND_COMPLEX';
  params: {
    origin: string;
    mode?: 'build' | 'submit';
    buildParams: EnhancedBuildParams;
  };
}

export interface TransactionPlan {
  inputs: Array<{
    coinId: string;
    amount: string;
    tokenId: string;
    address: string;
  }>;
  outputs: Array<{
    address: string;
    amount: string;
    tokenId: string;
  }>;
  change: {
    address: string;
    amount: string;
    tokenId: string;
  } | null;
  fee: string | null;
}

export interface InputCoinProof {
  coinId: string;
  amount: string;
  tokenId: string;
  address: string;
  proof: object | null;
}

export interface ResponseScriptDescriptor {
  scriptType: string;
  script: string;
  root?: string;
  branchScript?: string;
  proofPath?: string[];
  extraScripts?: string[];
  requiredSignatures?: number;
  totalSigners?: number;
  signerKeys?: string[];
}

export interface TotemSendComplexBuildResponse {
  success: true;
  mode: 'build';
  unsignedHex: string;
  digestTx: string;
  plan: TransactionPlan;
  inputCoinProofs: InputCoinProof[];
  scriptDescriptors: ResponseScriptDescriptor[];
  chainId: string;
  blobHash: string;
  detectedIntent: string;
  scriptTypes: string[];
}

export interface TotemSendComplexSubmitResponse {
  success: true;
  mode: 'submit';
  txpowid: string;
  status: 'submitted';
  detectedIntent: string;
  scriptTypes: string[];
  inputCount: number;
  outputCount: number;
}

export interface TotemSendComplexErrorResponse {
  success: false;
  error: string;
  errorCode: string;
  detectedIntent?: string;
  scriptTypes?: string[];
  requiredIntent?: string;
}

export type TotemSendComplexResponse =
  | TotemSendComplexBuildResponse
  | TotemSendComplexSubmitResponse
  | TotemSendComplexErrorResponse;

export interface TotemSignDataRequest {
  method: 'TOTEM_SIGN_DATA';
  params: {
    origin: string;
    unsignedHex: string;
    inputAddresses: string[];
    inputIndices?: number[];
    returnFormat?: 'hex' | 'json';
  };
}

export interface TotemSignDataSuccessResponse {
  success: true;
  signedHex: string;
  signatures: object[];
  signerAddress: string;
  signerIndex: number;
  inputsSigned: number[];
  status: 'signed';
}

export interface TotemSignDataErrorResponse {
  success: false;
  error: string;
  errorCode: string;
  requiredIntent?: string;
}

export type TotemSignDataResponse =
  | TotemSignDataSuccessResponse
  | TotemSignDataErrorResponse;

export interface TotemBroadcastHexRequest {
  method: 'TOTEM_BROADCAST_HEX';
  params: {
    origin: string;
    signedHex: string;
    expectedDigestTx?: string;
  };
}

export interface TotemBroadcastHexSuccessResponse {
  success: true;
  txpowid: string;
}

export interface TotemBroadcastHexErrorResponse {
  success: false;
  error: string;
  errorCode: string;
  requiredIntent?: string;
}

export type TotemBroadcastHexResponse =
  | TotemBroadcastHexSuccessResponse
  | TotemBroadcastHexErrorResponse;

export interface TokenSpendingLimit {
  tokenId: string;
  tokenSymbol: string;
  maxAmountPerTx: string;
  maxDailyAmount: string;
}

export interface TotemGrantTxPermissionRequest {
  method: 'TOTEM_GRANT_TX_PERMISSION';
  params: {
    origin: string;
    config: {
      allowedIntents?: DAppTransactionIntent[];
      tokenLimits?: TokenSpendingLimit[];
      expiresInDays?: number;
    };
  };
}

export interface TotemGrantTxPermissionResponse {
  success: boolean;
}

export interface TotemRevokeTxPermissionRequest {
  method: 'TOTEM_REVOKE_TX_PERMISSION';
  params: {
    origin: string;
  };
}

export interface TotemRevokeTxPermissionResponse {
  success: boolean;
}

export interface TotemGetTxPermissionsRequest {
  method: 'TOTEM_GET_TX_PERMISSIONS';
  params: {};
}

export interface SitePermissionEntry {
  origin: string;
  address: string;
  permissions: {
    grantedAt: number;
    expiresAt: number;
    allowedIntents: DAppTransactionIntent[];
    tokenLimits: TokenSpendingLimit[];
    totalTransactions: number;
    lastTransactionAt?: number;
  };
}

export type TotemGetTxPermissionsResponse = SitePermissionEntry[];

/**
 * @module @totemsdk/connect/wallet
 *
 * Shared wallet-side connect runtime (RFC-014).
 *
 * The dApp-facing client lives in `@totemsdk/connect`; this is its wallet-side
 * counterpart. Both wallets consume this so every connect method is implemented
 * **once**, resolves to an explicit `handled`/`unsupported` disposition, and
 * execution families are delegated to injected ports (Edge dispatch, SDK
 * clients) rather than re-implemented per wallet.
 *
 * This module must not import `extensions/*`. Execution ports are structural, so
 * it also does not hard-depend on `@totemsdk/edge` (edge already peer-depends on
 * connect).
 */

import type {
  TotemCapabilities,
  TotemProvider,
  TotemProviderStatus,
  TotemRequest,
  TotemWalletInfo,
} from './types.js';

// ── Canonical method inventory ─────────────────────────────────────────────

/** Legacy uppercase wire methods. */
export const LEGACY_METHODS = [
  'TOTEM_CONNECT',
  'TOTEM_VERIFY',
  'TOTEM_GET_ACCOUNTS',
  'TOTEM_SEND_TRANSACTION',
  'TOTEM_GET_COINS',
  'TOTEM_SEND_COMPLEX',
  'TOTEM_TOKENCREATE',
  'TOTEM_SIGN_DATA',
  'TOTEM_BROADCAST_HEX',
  'TOTEM_GRANT_TX_PERMISSION',
  'TOTEM_REVOKE_TX_PERMISSION',
  'TOTEM_GET_TX_PERMISSIONS',
] as const;

/** Newer lowercase `totem_*` methods. */
export const TOTEM_METHODS = [
  'totem_getCapabilities',
  'totem_getProviderStatus',
  'totem_setChainProvider',
  'totem_getWotsStatus',
  'totem_reserveWotsLease',
  'totem_releaseWotsLease',
  'totem_signTransaction',
  'totem_mineTxPoW',
  'totem_broadcastTxPoW',
  'totem_createPaymentRequest',
  'totem_payPaymentRequest',
  'totem_getTransactionStatus',
  'totem_getReceipt',
  'totem_omniaGetChannels',
  'totem_omniaOpenChannel',
  'totem_omniaPay',
  'totem_omniaSettle',
  'totem_omniaCloseChannel',
  'totem_omniaGetRoute',
  'totem_omniaPayMultiHop',
  'totem_omniaGetSwapRate',
  'totem_omniaCreateFactory',
  'totem_omniaOpenVirtualChannel',
  'totem_omniaCloseFactory',
  'totem_omniaSpliceIn',
  'totem_omniaSpliceOut',
  'totem_statechainCreate',
  'totem_statechainTransfer',
  'totem_statechainClaim',
  'totem_statechainVerify',
  'totem_kissvmSimulate',
  'totem_kissvmValidate',
  'totem_agentProposePayment',
  'totem_agentExplainTransaction',
  'totem_agentCreateReceipt',
] as const;

/** Every canonical connect method (47). */
export const CONNECT_METHODS = [...LEGACY_METHODS, ...TOTEM_METHODS] as const;

export type LegacyMethod = (typeof LEGACY_METHODS)[number];
export type TotemMethod = (typeof TOTEM_METHODS)[number];
export type ConnectMethod = (typeof CONNECT_METHODS)[number];

/**
 * Wallet-internal verbs that are intentionally not connect methods.
 * Mirrors `scripts/audit-wallet-connect-parity.mjs` `WALLET_INTERNAL`.
 */
export const WALLET_INTERNAL_METHODS = [
  'TOTEM_CONNECT_APPROVE',
  'TOTEM_DISCONNECT',
  'TOTEM_PROVE_OWNERSHIP',
  'WOTS_SEND',
  'WOTS_SIGN_DATA',
  'RPC_COMMAND',
  'START_STREAM',
  'STOP_STREAM',
  'GET_SNAPSHOT',
  'GET_BALANCE_SNAPSHOT',
  'PORTFOLIO_SNAPSHOT',
  'GET_CONNECTED_SITES',
  'DISCONNECT_SITE',
  'DISCONNECT_ALL_SITES',
  'GET_RPC_ENDPOINT',
] as const;

// ── Dispositions ───────────────────────────────────────────────────────────

export type WalletMethodDisposition = 'local' | 'edge' | 'sdk' | 'unsupported';

export type WalletPortKey =
  | 'info'
  | 'signer'
  | 'approvals'
  | 'chain'
  | 'lease'
  | 'edge'
  | 'omnia'
  | 'statechain'
  | 'kissvm'
  | 'agent'
  | 'receipts'
  | 'paymentRequests'
  | 'selfHosted';

export interface WalletMethodDescriptor {
  readonly method: ConnectMethod;
  readonly disposition: WalletMethodDisposition;
  readonly family: string;
  readonly requiredCapabilities: readonly string[];
  /** Ports that must be present for the method to be `supported`. */
  readonly requires: readonly WalletPortKey[];
  /**
   * Alternative port set: the method is also `supported` when every one of
   * these is present (e.g. Omnia via a consent client *or* a host edge port).
   */
  readonly orRequires?: readonly WalletPortKey[];
  readonly requiresApproval?: boolean;
  /** Reason shown when the method is `unsupported`. */
  readonly reason?: string;
}

function d(
  method: ConnectMethod,
  disposition: WalletMethodDisposition,
  family: string,
  requires: readonly WalletPortKey[],
  requiredCapabilities: readonly string[] = [],
  extra: Partial<WalletMethodDescriptor> = {},
): WalletMethodDescriptor {
  return { method, disposition, family, requires, requiredCapabilities, ...extra };
}

/** Frozen disposition table (RFC-014 §6.3). */
export const WALLET_METHODS: readonly WalletMethodDescriptor[] = [
  // Legacy core — wallet-owned, user-approved.
  d('TOTEM_CONNECT', 'local', 'connect', ['signer', 'approvals'], [], { requiresApproval: true }),
  d('TOTEM_VERIFY', 'local', 'verify', ['signer', 'approvals'], [], { requiresApproval: true }),
  d('TOTEM_GET_ACCOUNTS', 'local', 'accounts', ['signer']),
  d('TOTEM_SEND_TRANSACTION', 'local', 'payment', ['signer', 'approvals'], ['payment:send'], { requiresApproval: true }),
  d('TOTEM_GET_COINS', 'local', 'chain', ['signer']),
  d('TOTEM_SEND_COMPLEX', 'local', 'complex', ['signer', 'approvals'], [], { requiresApproval: true }),
  d('TOTEM_TOKENCREATE', 'local', 'token', ['signer', 'approvals'], [], { requiresApproval: true }),
  d('TOTEM_SIGN_DATA', 'local', 'sign', ['signer', 'approvals'], [], { requiresApproval: true }),
  d('TOTEM_BROADCAST_HEX', 'local', 'broadcast', ['signer', 'approvals'], [], { requiresApproval: true }),
  d('TOTEM_GRANT_TX_PERMISSION', 'local', 'permissions', ['signer', 'approvals'], [], { requiresApproval: true }),
  d('TOTEM_REVOKE_TX_PERMISSION', 'local', 'permissions', ['signer']),
  d('TOTEM_GET_TX_PERMISSIONS', 'local', 'permissions', ['signer']),

  // Discovery / status.
  d('totem_getCapabilities', 'local', 'discovery', ['info']),
  d('totem_getProviderStatus', 'local', 'discovery', ['info']),
  d('totem_setChainProvider', 'local', 'chain', ['selfHosted']),

  // WOTS lease.
  d('totem_getWotsStatus', 'local', 'wots', ['signer']),
  d('totem_reserveWotsLease', 'local', 'wots', ['lease']),
  d('totem_releaseWotsLease', 'local', 'wots', ['lease']),

  // Transaction flow.
  d('totem_signTransaction', 'local', 'sign', ['signer', 'approvals'], [], { requiresApproval: true }),
  d('totem_mineTxPoW', 'local', 'txpow', ['signer']),
  d('totem_broadcastTxPoW', 'local', 'broadcast', ['signer']),

  // Payments / TESSA.
  d('totem_createPaymentRequest', 'local', 'payment', ['paymentRequests']),
  d('totem_payPaymentRequest', 'edge', 'payment', ['edge', 'paymentRequests'], ['payment:send'], { requiresApproval: true }),
  d('totem_getTransactionStatus', 'local', 'receipts', ['receipts']),
  d('totem_getReceipt', 'local', 'receipts', ['receipts']),

  // Omnia — consent-gated SDK client (RFC-014 §6.3); an autonomous host may
  // instead route the same methods through its governed `edge` port.
  d('totem_omniaGetChannels', 'sdk', 'omnia', ['omnia'], ['omnia:channels'], { orRequires: ['edge'] }),
  d('totem_omniaOpenChannel', 'sdk', 'omnia', ['omnia'], ['omnia:channels'], { requiresApproval: true, orRequires: ['edge'] }),
  d('totem_omniaPay', 'sdk', 'omnia', ['omnia'], ['omnia:routing'], { requiresApproval: true, orRequires: ['edge'] }),
  d('totem_omniaSettle', 'sdk', 'omnia', ['omnia'], ['omnia:channels'], { requiresApproval: true, orRequires: ['edge'] }),
  d('totem_omniaCloseChannel', 'sdk', 'omnia', ['omnia'], ['omnia:channels'], { requiresApproval: true, orRequires: ['edge'] }),
  d('totem_omniaGetRoute', 'sdk', 'omnia', ['omnia'], ['omnia:routing'], { orRequires: ['edge'] }),
  d('totem_omniaPayMultiHop', 'sdk', 'omnia', ['omnia'], ['omnia:multi-hop'], { requiresApproval: true, orRequires: ['edge'] }),
  d('totem_omniaGetSwapRate', 'sdk', 'omnia', ['omnia'], ['omnia:cross-token-swap'], { orRequires: ['edge'] }),
  d('totem_omniaCreateFactory', 'sdk', 'omnia', ['omnia'], ['omnia:factory'], { requiresApproval: true, orRequires: ['edge'] }),
  d('totem_omniaOpenVirtualChannel', 'sdk', 'omnia', ['omnia'], ['omnia:virtual-channels'], { requiresApproval: true, orRequires: ['edge'] }),
  d('totem_omniaCloseFactory', 'sdk', 'omnia', ['omnia'], ['omnia:factory'], { requiresApproval: true, orRequires: ['edge'] }),
  d('totem_omniaSpliceIn', 'sdk', 'omnia', ['omnia'], ['omnia:splicing'], { requiresApproval: true, orRequires: ['edge'] }),
  d('totem_omniaSpliceOut', 'sdk', 'omnia', ['omnia'], ['omnia:splicing'], { requiresApproval: true, orRequires: ['edge'] }),

  // Statechain — sdk-client.
  d('totem_statechainCreate', 'sdk', 'statechain', ['statechain', 'approvals'], ['statechain:supported'], { requiresApproval: true }),
  d('totem_statechainTransfer', 'sdk', 'statechain', ['statechain', 'approvals'], ['statechain:supported'], { requiresApproval: true }),
  d('totem_statechainClaim', 'sdk', 'statechain', ['statechain', 'approvals'], ['statechain:supported'], { requiresApproval: true }),
  d('totem_statechainVerify', 'sdk', 'statechain', ['statechain'], ['statechain:supported']),

  // KISSVM — sdk-client.
  d('totem_kissvmSimulate', 'sdk', 'kissvm', ['kissvm'], ['scripting:kissvm']),
  d('totem_kissvmValidate', 'sdk', 'kissvm', ['kissvm'], ['scripting:kissvm']),

  // Agent — edge/governance bridge.
  d('totem_agentProposePayment', 'edge', 'agent', ['agent'], [], { requiresApproval: true }),
  d('totem_agentExplainTransaction', 'edge', 'agent', ['agent']),
  d('totem_agentCreateReceipt', 'edge', 'agent', ['agent']),
];

const DESCRIPTOR_BY_METHOD = new Map<string, WalletMethodDescriptor>(
  WALLET_METHODS.map((descriptor) => [descriptor.method, descriptor]),
);

const CONNECT_METHOD_SET: ReadonlySet<string> = new Set<string>(CONNECT_METHODS);

/** True for any canonical connect method (legacy `TOTEM_*` or `totem_*`). */
export function isConnectMethod(method: string): boolean {
  return CONNECT_METHOD_SET.has(method);
}

export function methodDescriptor(method: string): WalletMethodDescriptor | undefined {
  return DESCRIPTOR_BY_METHOD.get(method);
}

/** Omnia connect method → governed edge action id. */
export const OMNIA_ACTION_BY_METHOD: Readonly<Record<string, string>> = {
  totem_omniaGetChannels: 'omnia:getChannels',
  totem_omniaOpenChannel: 'omnia:channel:open',
  totem_omniaPay: 'omnia:pay',
  totem_omniaSettle: 'omnia:settle',
  totem_omniaCloseChannel: 'omnia:close',
  totem_omniaGetRoute: 'omnia:route',
  totem_omniaPayMultiHop: 'omnia:pay-multihop',
  totem_omniaGetSwapRate: 'omnia:swap-rate',
  totem_omniaCreateFactory: 'omnia:factory:create',
  totem_omniaOpenVirtualChannel: 'omnia:virtual:open',
  totem_omniaCloseFactory: 'omnia:factory:close',
  totem_omniaSpliceIn: 'omnia:splice-in',
  totem_omniaSpliceOut: 'omnia:splice-out',
};

/** Omnia connect method → consent Omnia client method (RFC-014 §6.3). */
export const OMNIA_CLIENT_METHOD_BY_METHOD: Readonly<
  Record<string, Exclude<keyof OmniaClientPort, 'supports'>>
> = {
  totem_omniaGetChannels: 'getChannels',
  totem_omniaOpenChannel: 'openChannel',
  totem_omniaPay: 'pay',
  totem_omniaSettle: 'settle',
  totem_omniaCloseChannel: 'closeChannel',
  totem_omniaGetRoute: 'getRoute',
  totem_omniaPayMultiHop: 'payMultiHop',
  totem_omniaGetSwapRate: 'getSwapRate',
  totem_omniaCreateFactory: 'createFactory',
  totem_omniaOpenVirtualChannel: 'openVirtualChannel',
  totem_omniaCloseFactory: 'closeFactory',
  totem_omniaSpliceIn: 'spliceIn',
  totem_omniaSpliceOut: 'spliceOut',
};

// ── Structural ports ───────────────────────────────────────────────────────

export interface WalletInfoPort {
  readonly wallet: string;
  readonly version: string;
  readonly capabilities: TotemCapabilities;
  readonly status: TotemProviderStatus;
}

/**
 * Per-method capability declaration (RFC-014 Amendment A).
 *
 * Port presence is not capability: a port may exist but return UNSUPPORTED for a
 * method (e.g. the Omnia relay client's advanced topology ops). A port implements
 * `supports()` to report what it will actually attempt, so the manifest and the
 * live dispatch describe reality rather than the port's existence. Absent ⇒ the
 * method is assumed supported (pre-amendment behaviour).
 */
export interface SupportProbe {
  supports?(method: string): boolean | { supported: boolean; reason?: string };
}

export interface WalletSignerPort extends SupportProbe {
  connect?(params: Record<string, unknown>): Promise<unknown>;
  verify?(params: Record<string, unknown>): Promise<unknown>;
  getAccounts?(params: Record<string, unknown>): Promise<unknown>;
  getCoins?(params: Record<string, unknown>): Promise<unknown>;
  sendTransaction?(params: Record<string, unknown>): Promise<unknown>;
  sendComplex?(params: Record<string, unknown>): Promise<unknown>;
  createToken?(params: Record<string, unknown>): Promise<unknown>;
  signData?(params: Record<string, unknown>): Promise<unknown>;
  broadcastHex?(params: Record<string, unknown>): Promise<unknown>;
  proveOwnership?(params: Record<string, unknown>): Promise<unknown>;
  grantTxPermission?(params: Record<string, unknown>): Promise<unknown>;
  revokeTxPermission?(params: Record<string, unknown>): Promise<unknown>;
  getTxPermissions?(params: Record<string, unknown>): Promise<unknown>;
  getWotsStatus?(params: Record<string, unknown>): Promise<unknown>;
  signTransaction?(params: Record<string, unknown>): Promise<unknown>;
  mineTxPoW?(params: Record<string, unknown>): Promise<unknown>;
  broadcastTxPoW?(params: Record<string, unknown>): Promise<unknown>;
}

export interface ApprovalPort {
  request<T = unknown>(req: {
    readonly method: string;
    readonly params: Record<string, unknown>;
    readonly origin?: string;
    readonly signal?: AbortSignal;
  }): Promise<T>;
}

export interface ChainStateProviderPort extends SupportProbe {
  getCoins?(query: Record<string, unknown>): Promise<unknown>;
  getCoin?(coinId: string): Promise<unknown>;
  getProof?(coinId: string): Promise<unknown>;
  getTip?(): Promise<unknown>;
  broadcastTxPoW?(txpowHex: string): Promise<unknown>;
}

export interface WotsLeasePort extends SupportProbe {
  reserveKeyUse(params: Record<string, unknown>): Promise<unknown>;
  releaseReservation?(reservationId: string, reason?: string): Promise<unknown>;
  burnReservation?(reservationId: string, reason: string): Promise<unknown>;
}

/**
 * Injected execution dispatch seam.
 *
 * This is a **host-supplied** port. A consent wallet supplies a plain dispatch
 * adapter over its SDK/chain clients (consent-gated by the approval port). A
 * host that runs an autonomous runtime (an agent or industrial edge device) may
 * supply a governed edge dispatch instead. The browser wallets never construct a
 * mandate-bound governed runtime themselves (RFC-014 §6.4).
 */
export interface EdgeDispatchPort {
  executeAction(input: {
    action: string;
    subject: string;
    payload?: Record<string, unknown>;
    context?: Record<string, unknown>;
  }): Promise<{ ok: boolean; data?: unknown; error?: string; errorCode?: string }>;
}

export interface StatechainClientPort extends SupportProbe {
  create?(params: Record<string, unknown>): Promise<unknown>;
  transfer?(params: Record<string, unknown>): Promise<unknown>;
  claim?(params: Record<string, unknown>): Promise<unknown>;
  verify?(params: Record<string, unknown>): Promise<unknown>;
}

/**
 * Consent-gated Omnia construction/execution client (RFC-014 §6.3). The wallet
 * supplies this (or a host injects it); `@totemsdk/connect/wallet` depends on no
 * concrete Omnia runtime. Each method builds/signs/broadcasts via the wallet's
 * signer + approval surface.
 */
export interface OmniaClientPort extends SupportProbe {
  getChannels?(params: Record<string, unknown>): Promise<unknown>;
  openChannel?(params: Record<string, unknown>): Promise<unknown>;
  pay?(params: Record<string, unknown>): Promise<unknown>;
  settle?(params: Record<string, unknown>): Promise<unknown>;
  closeChannel?(params: Record<string, unknown>): Promise<unknown>;
  getRoute?(params: Record<string, unknown>): Promise<unknown>;
  payMultiHop?(params: Record<string, unknown>): Promise<unknown>;
  getSwapRate?(params: Record<string, unknown>): Promise<unknown>;
  createFactory?(params: Record<string, unknown>): Promise<unknown>;
  openVirtualChannel?(params: Record<string, unknown>): Promise<unknown>;
  closeFactory?(params: Record<string, unknown>): Promise<unknown>;
  spliceIn?(params: Record<string, unknown>): Promise<unknown>;
  spliceOut?(params: Record<string, unknown>): Promise<unknown>;
}

export interface KissvmClientPort extends SupportProbe {
  simulate?(params: Record<string, unknown>): Promise<unknown>;
  validate?(params: Record<string, unknown>): Promise<unknown>;
}

export interface AgentBridgePort extends SupportProbe {
  propose?(params: Record<string, unknown>): Promise<unknown>;
  explain?(params: Record<string, unknown>): Promise<unknown>;
  createReceipt?(params: Record<string, unknown>): Promise<unknown>;
}

export interface ReceiptStorePort extends SupportProbe {
  getStatus(txpowId: string): Promise<unknown>;
  getReceipt(txpowId: string): Promise<unknown>;
}

export interface PaymentRequestPort extends SupportProbe {
  create(params: Record<string, unknown>): Promise<unknown>;
  pay(params: Record<string, unknown>): Promise<unknown>;
}

export interface SelfHostedPort extends SupportProbe {
  setChainProvider(params: Record<string, unknown>): Promise<unknown>;
}

export interface WalletHandlerContext {
  readonly info: WalletInfoPort;
  readonly signer?: WalletSignerPort;
  readonly approvals?: ApprovalPort;
  readonly chain?: ChainStateProviderPort;
  readonly lease?: WotsLeasePort;
  readonly edge?: EdgeDispatchPort;
  readonly omnia?: OmniaClientPort;
  readonly statechain?: StatechainClientPort;
  readonly kissvm?: KissvmClientPort;
  readonly agent?: AgentBridgePort;
  readonly receipts?: ReceiptStorePort;
  readonly paymentRequests?: PaymentRequestPort;
  readonly selfHosted?: SelfHostedPort;
  readonly now?: () => number;
}

// ── Handler contract ───────────────────────────────────────────────────────

export interface WalletMethodHandler {
  readonly method: string;
  readonly requiredCapabilities: readonly string[];
  readonly requiresApproval?: boolean;
  handle(
    params: Record<string, unknown>,
    ctx: WalletHandlerContext,
    signal?: AbortSignal,
  ): Promise<unknown>;
}

const UNSUPPORTED_CODE = 'UNSUPPORTED';

function unsupported(message: string): { success: false; error: string; errorCode: string } {
  return { success: false, error: message, errorCode: UNSUPPORTED_CODE };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

type PortMethod = (params: Record<string, unknown>) => Promise<unknown>;

/** Build a handler that delegates to `ctx[key][fn]`, or returns UNSUPPORTED. */
function delegate(
  method: ConnectMethod,
  getFn: (ctx: WalletHandlerContext) => PortMethod | undefined,
  unsupportedReason: string,
  prefixParams: (params: Record<string, unknown>) => Record<string, unknown> = (p) => p,
): WalletMethodHandler {
  const descriptor = DESCRIPTOR_BY_METHOD.get(method) as WalletMethodDescriptor;
  return {
    method,
    requiredCapabilities: descriptor.requiredCapabilities,
    ...(descriptor.requiresApproval ? { requiresApproval: true } : {}),
    async handle(params, ctx, _signal) {
      const fn = getFn(ctx);
      if (!fn) return unsupported(unsupportedReason);
      return fn(prefixParams(params));
    },
  };
}

/** Every connect method gets a handler; unsupported ones return an explicit reason. */
export function createDefaultHandlers(): WalletMethodHandler[] {
  const handlers: WalletMethodHandler[] = [
    delegate('TOTEM_CONNECT', (c) => c.signer?.connect?.bind(c.signer), 'Wallet does not expose a connect signer port.'),
    delegate('TOTEM_VERIFY', (c) => c.signer?.verify?.bind(c.signer), 'Wallet does not expose a verify signer port.'),
    delegate('TOTEM_GET_ACCOUNTS', (c) => c.signer?.getAccounts?.bind(c.signer), 'Wallet does not expose accounts.'),
    delegate('TOTEM_SEND_TRANSACTION', (c) => c.signer?.sendTransaction?.bind(c.signer), 'Wallet does not expose a transaction signer port.'),
    delegate('TOTEM_GET_COINS', (c) => c.signer?.getCoins?.bind(c.signer), 'Wallet does not expose a chain read port.'),
    delegate('TOTEM_SEND_COMPLEX', (c) => c.signer?.sendComplex?.bind(c.signer), 'Wallet does not expose a complex-transaction builder.'),
    delegate('TOTEM_TOKENCREATE', (c) => c.signer?.createToken?.bind(c.signer), 'Wallet does not expose a token creation port.'),
    delegate('TOTEM_SIGN_DATA', (c) => c.signer?.signData?.bind(c.signer), 'Wallet does not expose a data signer port.'),
    delegate('TOTEM_BROADCAST_HEX', (c) => c.signer?.broadcastHex?.bind(c.signer), 'Wallet does not expose a broadcast port.'),
    delegate('TOTEM_GRANT_TX_PERMISSION', (c) => c.signer?.grantTxPermission?.bind(c.signer), 'Wallet does not manage tx permissions.'),
    delegate('TOTEM_REVOKE_TX_PERMISSION', (c) => c.signer?.revokeTxPermission?.bind(c.signer), 'Wallet does not manage tx permissions.'),
    delegate('TOTEM_GET_TX_PERMISSIONS', (c) => c.signer?.getTxPermissions?.bind(c.signer), 'Wallet does not manage tx permissions.'),

    {
      method: 'totem_getCapabilities',
      requiredCapabilities: [],
      async handle(_params, ctx) {
        return buildWalletCapabilityManifest(ctx);
      },
    },
    {
      method: 'totem_getProviderStatus',
      requiredCapabilities: [],
      async handle(_params, ctx) {
        return ctx.info.status;
      },
    },
    delegate('totem_setChainProvider', (c) => c.selfHosted?.setChainProvider?.bind(c.selfHosted), 'Self-hosted chain selection is not configured.'),

    delegate('totem_getWotsStatus', (c) => c.signer?.getWotsStatus?.bind(c.signer), 'Wallet does not expose WOTS status.'),
    delegate('totem_reserveWotsLease', (c) => c.lease?.reserveKeyUse?.bind(c.lease), 'Wallet does not coordinate a WOTS lease.'),
    {
      method: 'totem_releaseWotsLease',
      requiredCapabilities: [],
      async handle(params, ctx) {
        if (!ctx.lease?.releaseReservation) return unsupported('Wallet does not coordinate a WOTS lease.');
        return ctx.lease.releaseReservation(
          String(params.reservationId ?? ''),
          params.reason === undefined ? undefined : String(params.reason),
        );
      },
    },

    delegate('totem_signTransaction', (c) => c.signer?.signTransaction?.bind(c.signer), 'Wallet does not expose a transaction signer port.'),
    delegate('totem_mineTxPoW', (c) => c.signer?.mineTxPoW?.bind(c.signer), 'Wallet does not mine TxPoW.'),
    delegate('totem_broadcastTxPoW', (c) => c.signer?.broadcastTxPoW?.bind(c.signer), 'Wallet does not expose a broadcast port.'),

    delegate('totem_createPaymentRequest', (c) => c.paymentRequests?.create?.bind(c.paymentRequests), 'Wallet cannot create payment requests.'),

    // Payment request redemption goes through the governed edge payment action.
    {
      method: 'totem_payPaymentRequest',
      requiredCapabilities: ['payment:send'],
      requiresApproval: true,
      async handle(params, ctx) {
        if (ctx.paymentRequests?.pay) return ctx.paymentRequests.pay(params);
        if (!ctx.edge) return unsupported('No governed Edge dispatch available for payments.');
        return edgeResult(await ctx.edge.executeAction({ action: 'payment:send', subject: String(params.paymentUri ?? ''), payload: params }));
      },
    },
    delegate('totem_getTransactionStatus', (c) => (c.receipts ? (p) => c.receipts!.getStatus(String(p.txpowId)) : undefined), 'Wallet does not persist transaction status.'),
    delegate('totem_getReceipt', (c) => (c.receipts ? (p) => c.receipts!.getReceipt(String(p.txpowId)) : undefined), 'Wallet does not persist receipts.'),

    // Omnia — consent-gated SDK client (RFC-014 §6.3); a host that runs an
    // autonomous runtime may route the same methods through its governed `edge`
    // port instead.
    ...Object.keys(OMNIA_ACTION_BY_METHOD).map<WalletMethodHandler>((method) => {
      const descriptor = DESCRIPTOR_BY_METHOD.get(method) as WalletMethodDescriptor;
      const clientMethod = OMNIA_CLIENT_METHOD_BY_METHOD[method];
      return {
        method,
        requiredCapabilities: descriptor.requiredCapabilities,
        ...(descriptor.requiresApproval ? { requiresApproval: true } : {}),
        async handle(params, ctx) {
          const fn = ctx.omnia?.[clientMethod];
          if (fn) return fn(params);
          if (ctx.edge) {
            return edgeResult(await ctx.edge.executeAction({
              action: OMNIA_ACTION_BY_METHOD[method],
              subject: String(params.channelId ?? params.remotePartyId ?? ''),
              payload: params,
            }));
          }
          return unsupported(
            ctx.omnia
              ? `Omnia client does not implement ${String(clientMethod)}.`
              : 'Omnia client not configured.',
          );
        },
      };
    }),

    delegate('totem_statechainCreate', (c) => c.statechain?.create?.bind(c.statechain), 'Statechain client not configured.'),
    delegate('totem_statechainTransfer', (c) => c.statechain?.transfer?.bind(c.statechain), 'Statechain client not configured.'),
    delegate('totem_statechainClaim', (c) => c.statechain?.claim?.bind(c.statechain), 'Statechain client not configured.'),
    delegate('totem_statechainVerify', (c) => c.statechain?.verify?.bind(c.statechain), 'Statechain client not configured.'),

    delegate('totem_kissvmSimulate', (c) => c.kissvm?.simulate?.bind(c.kissvm), 'KISSVM client not configured.'),
    delegate('totem_kissvmValidate', (c) => c.kissvm?.validate?.bind(c.kissvm), 'KISSVM client not configured.'),

    delegate('totem_agentProposePayment', (c) => c.agent?.propose?.bind(c.agent), 'Agent bridge not configured.'),
    delegate('totem_agentExplainTransaction', (c) => c.agent?.explain?.bind(c.agent), 'Agent bridge not configured.'),
    delegate('totem_agentCreateReceipt', (c) => c.agent?.createReceipt?.bind(c.agent), 'Agent bridge not configured.'),
  ];
  return handlers;
}

function edgeResult(result: { ok: boolean; data?: unknown; error?: string; errorCode?: string }): unknown {
  if (result.ok) {
    const data = asRecord(result.data);
    return { success: true, ...data };
  }
  return { success: false, error: result.error ?? 'Edge execution failed', errorCode: result.errorCode ?? 'EXECUTION_FAILED' };
}

// ── Capability / method-support manifest ───────────────────────────────────

export interface WalletCapabilityManifest {
  readonly wallet: string;
  readonly version: string;
  readonly methods: Record<string, 'supported' | 'unsupported'>;
  readonly capabilities: string[];
  readonly reasons?: Record<string, string>;
}

/** A port that satisfies `key` refuses `method` (with an optional reason). */
function portDeclines(
  key: WalletPortKey,
  method: string,
  ctx: WalletHandlerContext,
): { present: boolean; supported: boolean; reason?: string } {
  const port = ctx[key] as SupportProbe | undefined;
  if (port === undefined) return { present: false, supported: false };
  if (typeof port.supports !== 'function') return { present: true, supported: true };
  const verdict = port.supports(method);
  return typeof verdict === 'boolean'
    ? { present: true, supported: verdict }
    : { present: true, supported: verdict.supported, reason: verdict.reason };
}

/**
 * Evaluate one required port-set (RFC-014 Amendment A).
 *
 * Returns `undefined` when any port in the set is **absent** (set not satisfied),
 * otherwise the affirmation verdict: satisfied only when **every** port in the
 * set is present and affirms the method (AND). The first declining port's reason
 * is retained.
 */
function setVerdict(
  keys: readonly WalletPortKey[],
  method: string,
  ctx: WalletHandlerContext,
): { satisfied: boolean; reason?: string } | undefined {
  let reason: string | undefined;
  let satisfied = true;
  for (const key of keys) {
    const v = portDeclines(key, method, ctx);
    if (!v.present) return undefined;
    if (!v.supported) {
      satisfied = false;
      if (reason === undefined && v.reason !== undefined) reason = v.reason;
    }
  }
  return { satisfied, ...(reason !== undefined ? { reason } : {}) };
}

export function isMethodSupported(
  descriptor: WalletMethodDescriptor,
  ctx: WalletHandlerContext,
): boolean {
  if (descriptor.disposition === 'unsupported') return false;
  const primary = setVerdict(descriptor.requires, descriptor.method, ctx);
  if (primary?.satisfied) return true;
  // Alternative port set (e.g. Omnia via a consent client *or* a host edge port).
  const alt = descriptor.orRequires;
  if (!alt || alt.length === 0) return false;
  const altVerdict = setVerdict(alt, descriptor.method, ctx);
  return altVerdict?.satisfied === true;
}

/** The first reason a required/alternative port declines `descriptor.method`. */
function probeReason(
  descriptor: WalletMethodDescriptor,
  ctx: WalletHandlerContext,
): string | undefined {
  for (const keys of [descriptor.requires, descriptor.orRequires ?? []] as const) {
    if (keys.length === 0) continue;
    const verdict = setVerdict(keys, descriptor.method, ctx);
    if (verdict && !verdict.satisfied && verdict.reason) return verdict.reason;
  }
  return undefined;
}

/** Build the capability/method-support manifest for a context. */
export function buildWalletCapabilityManifest(
  ctx: WalletHandlerContext,
  overrides: Record<string, 'supported' | 'unsupported'> = {},
): WalletCapabilityManifest {
  const methods: Record<string, 'supported' | 'unsupported'> = {};
  const reasons: Record<string, string> = {};
  const capabilities = new Set<string>();
  for (const descriptor of WALLET_METHODS) {
    const override = overrides[descriptor.method];
    const supported = override ?? (isMethodSupported(descriptor, ctx) ? 'supported' : 'unsupported');
    methods[descriptor.method] = supported;
    if (supported === 'unsupported') {
      reasons[descriptor.method] = probeReason(descriptor, ctx)
        ?? descriptor.reason
        ?? 'Required wallet port not configured.';
    } else {
      for (const cap of descriptor.requiredCapabilities) capabilities.add(cap);
    }
  }
  return {
    wallet: ctx.info.wallet,
    version: ctx.info.version,
    methods,
    capabilities: [...capabilities].sort(),
    ...(Object.keys(reasons).length > 0 ? { reasons } : {}),
  };
}

// ── Runtime ────────────────────────────────────────────────────────────────

export interface WalletRuntimeOptions {
  /** Override or extend the default handlers (keyed by method). */
  readonly handlers?: readonly WalletMethodHandler[];
  /** Approval enforcement: return false to reject an approval-required method. */
  readonly approve?: (request: {
    readonly method: string;
    readonly params: Record<string, unknown>;
    readonly origin?: string;
  }) => Promise<boolean>;
  readonly info?: TotemWalletInfo;
}

export interface WalletRuntimeMeta {
  readonly manifest: WalletCapabilityManifest;
  readonly handled: readonly string[];
  readonly unsupported: readonly string[];
}

export interface WalletRuntime {
  /** The `TotemProvider`-compatible dispatch surface. */
  readonly provider: TotemProvider;
  /** Manifest + per-method disposition for the current context. */
  meta(): WalletRuntimeMeta;
}

/**
 * Compose a wallet runtime over the shared handlers. Every canonical connect
 * method is addressable; methods whose ports are absent resolve to an explicit
 * `unsupported` response (and are listed in the manifest), never a silent no-op.
 */
export function createWalletRuntime(
  ctx: WalletHandlerContext,
  options: WalletRuntimeOptions = {},
): WalletRuntime {
  const handlers = new Map<string, WalletMethodHandler>();
  for (const handler of createDefaultHandlers()) handlers.set(handler.method, handler);
  for (const handler of options.handlers ?? []) handlers.set(handler.method, handler);

  async function dispatch(method: string, params: Record<string, unknown>, origin?: string, signal?: AbortSignal): Promise<unknown> {
    const handler = handlers.get(method);
    if (!handler) {
      return unsupported(`Unsupported method: ${method}`);
    }
    const descriptor = DESCRIPTOR_BY_METHOD.get(method);
    if (descriptor && !isMethodSupported(descriptor, ctx)) {
      return unsupported(
        probeReason(descriptor, ctx) ?? descriptor.reason ?? `${method} is not supported by this wallet.`,
      );
    }
    if (handler.requiresApproval) {
      // RFC-020 H2: approval is mandatory for approval-required methods — an
      // absent approval callback must fail closed, never silently execute.
      if (!options.approve) {
        return {
          success: false,
          error: `Method ${method} requires an approval callback, but none is configured`,
          errorCode: 'APPROVAL_REQUIRED',
        };
      }
      const approved = await options.approve({ method, params, ...(origin ? { origin } : {}) });
      if (!approved) return { success: false, error: 'User rejected the request', errorCode: 'USER_REJECTED' };
    }
    try {
      return await handler.handle(params, ctx, signal);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        errorCode: 'HANDLER_ERROR',
      };
    }
  }

  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  const provider = {
    isTotem: true as const,
    async request(args: TotemRequest): Promise<unknown> {
      const method = args?.method;
      if (typeof method !== 'string') {
        return unsupported('Malformed request: missing method');
      }
      // RFC-020 H2: forward the requesting origin to the approval callback.
      const origin = typeof (args as { origin?: unknown })?.origin === 'string'
        ? (args as { origin: string }).origin
        : undefined;
      return dispatch(method, asRecord(args.params), origin);
    },
    on(event: string, handler: (...args: unknown[]) => void): void {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    },
    removeListener(event: string, handler: (...args: unknown[]) => void): void {
      listeners.get(event)?.delete(handler);
    },
    async enable(): Promise<unknown> {
      return dispatch('TOTEM_CONNECT', {});
    },
    async send(method: string, params?: unknown[]): Promise<unknown> {
      return dispatch(method, asRecord(params));
    },
    async getCoins(params?: Record<string, unknown>): Promise<unknown> {
      return dispatch('TOTEM_GET_COINS', asRecord(params));
    },
    async sendComplex(buildParams: Record<string, unknown>, mode?: 'build' | 'submit'): Promise<unknown> {
      return dispatch('TOTEM_SEND_COMPLEX', { ...buildParams, ...(mode ? { mode } : {}) });
    },
    async createToken(request: Record<string, unknown>): Promise<unknown> {
      return dispatch('TOTEM_TOKENCREATE', asRecord(request));
    },
    async signData(params: Record<string, unknown>): Promise<unknown> {
      return dispatch('TOTEM_SIGN_DATA', params);
    },
    async broadcastHex(params: Record<string, unknown>): Promise<unknown> {
      return dispatch('TOTEM_BROADCAST_HEX', params);
    },
  } as unknown as TotemProvider;

  return {
    provider,
    meta(): WalletRuntimeMeta {
      const manifest = buildWalletCapabilityManifest(ctx);
      const handled: string[] = [];
      const unsupportedMethods: string[] = [];
      for (const [method, status] of Object.entries(manifest.methods)) {
        (status === 'supported' ? handled : unsupportedMethods).push(method);
      }
      return { manifest, handled: handled.sort(), unsupported: unsupportedMethods.sort() };
    },
  };
}

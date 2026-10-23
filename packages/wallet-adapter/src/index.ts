/**
 * @totemsdk/wallet-adapter
 *
 * Abstract base class for building Totem-compatible wallets.
 *
 * This package is a thin binding over the shared wallet runtime in
 * `@totemsdk/connect/wallet`. That runtime supplies:
 * - the full 48-method connect surface (legacy `TOTEM_*` + `totem_*`),
 * - mandatory, fail-closed approvals for approval-required methods,
 * - the WOTS lease port and the optional Omnia / statechain / KISSVM / agent /
 *   receipts / payment-request / chain / edge ports,
 * - per-method capability support and explicit `UNSUPPORTED` reasons.
 *
 * Subclasses implement the three signer methods (`getAccounts`,
 * `signTransaction`, `signData`) and declare an `approve` callback (and a
 * trusted `getOrigin`). Approval-required methods are **unsupported** when no
 * `approve` callback is configured, so a wallet can never silently execute
 * them by default.
 *
 * @example
 * ```ts
 * class MyWallet extends TotemWalletAdapter {
 *   async getAccounts(origin) { return { accounts: [...], activeIndex: 0 }; }
 *   async signTransaction(origin, params) { return myDevice.sign(params.unsignedHex); }
 *   async signData(origin, params) { return myDevice.sign(params.unsignedHex); }
 * }
 *
 * const wallet = new MyWallet({
 *   walletInfo: { id: 'my-wallet', name: 'My Wallet', version: '1.0.0' },
 *   getOrigin: () => window.location.origin,
 *   approve: async ({ method, origin, params }) => myUi.confirm(method, origin, params),
 * });
 * wallet.inject();
 * ```
 */
import {
  TOTEM_ANNOUNCE,
  TOTEM_REQUEST_ANNOUNCE,
  type TotemCapabilities,
  type TotemConnectResponse,
  type TotemProvider,
  type TotemProviderStatus,
  type TotemWalletInfo,
} from '@totemsdk/connect';
import {
  createWalletRuntime,
  type AgentBridgePort,
  type ApprovalPort,
  type ChainStateProviderPort,
  type EdgeDispatchPort,
  type KissvmClientPort,
  type OmniaClientPort,
  type PaymentRequestPort,
  type ReceiptStorePort,
  type SelfHostedPort,
  type StatechainClientPort,
  type WalletHandlerContext,
  type WalletMethodHandler,
  type WalletRuntime,
  type WalletRuntimeMeta,
  type WalletSignerPort,
  type WotsLeasePort,
} from '@totemsdk/connect/wallet';

// ─── Public type aliases (aligned with @totemsdk/connect) ────────────────────

export type WalletInfo = TotemWalletInfo;
export type WalletCapabilities = TotemCapabilities;
export type AdapterProvider = TotemProvider;
export type ConnectResponse = TotemConnectResponse;

// ─── Subclass-facing parameter / return types ────────────────────────────────

export interface AccountEntry {
  address: string;
  addressIndex: number;
  /** WOTS public key hex. Required for TOTEM_VERIFY. */
  publicKey: string | null;
  balance?: string;
}

/**
 * Internal/subclass account shape. `TOTEM_GET_ACCOUNTS` is normalised on the
 * wire to the canonical connect shape (`{ accounts: [{ index, address, balance }] }`).
 */
export interface GetAccountsResponse {
  accounts: AccountEntry[];
  activeIndex: number;
}

export interface SignTransactionParams {
  unsignedHex: string;
  inputAddresses: string[];
  inputIndices?: number[];
  returnFormat?: 'hex' | 'json';
}

export interface SignTransactionResponse {
  success: boolean;
  signedHex?: string;
  signatures?: object[];
  error?: string;
  errorCode?: string;
}

export interface SignDataParams {
  unsignedHex: string;
  inputAddresses: string[];
  inputIndices?: number[];
  returnFormat?: 'hex' | 'json';
}

export interface SignDataResponse {
  success: boolean;
  signedHex?: string;
  signatures?: object[];
  error?: string;
  errorCode?: string;
}

export interface VerifyResponse {
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

export interface DisconnectResponse {
  success: boolean;
  error?: string;
  errorCode?: string;
}

// ─── Chain provider (structural / duck-typed) ─────────────────────────────────

export interface ChainProviderLike {
  getCoins(query: Record<string, unknown>): Promise<unknown[]>;
  getCoin?(coinId: string): Promise<unknown>;
  getProof?(coinId: string): Promise<unknown>;
  getTip?(): Promise<{ block: number; hash: string; time?: string }>;
  getToken?(tokenId: string): Promise<unknown>;
  searchTokens?(query: Record<string, unknown>): Promise<unknown[]>;
  getTokensByCreator?(address: string): Promise<unknown[]>;
  broadcastTxPoW(txpowHex: string): Promise<{ success: boolean; txpowid?: string; message?: string }>;
}

export type ChainProviderFactory = (
  providerType: 'hosted' | 'pure_rpc' | 'hybrid',
  rpcEndpoint?: string,
) => ChainProviderLike;

// ─── Configuration ────────────────────────────────────────────────────────────

export interface WalletAdapterApprovalRequest {
  method: string;
  params: Record<string, unknown>;
  /** Trusted requesting origin (resolved by the host, never by the dApp). */
  origin?: string;
}

export interface WalletAdapterConfig {
  walletInfo: WalletInfo;
  capabilities?: DeepPartial<Omit<WalletCapabilities, 'version'>>;

  /** Trusted origin resolver. Defaults to `window.location.origin` in a browser. */
  getOrigin?: (method?: string) => string | undefined;
  /**
   * Fall back to the dApp-supplied `params.origin` when no trusted origin is
   * available. NOT recommended; off by default.
   */
  allowUntrustedOrigin?: boolean;

  /**
   * Approval callback. Required for approval-required methods; without it they
   * are reported unsupported (fail closed). The `origin` passed here is the
   * trusted origin.
   */
  approve?: (request: WalletAdapterApprovalRequest) => Promise<boolean>;

  /** Allow signing inputs that are not in the connected account list. */
  allowExternalInputs?: boolean;

  chainProvider?: ChainProviderLike;
  chainProviderFactory?: ChainProviderFactory;
  network?: string;
  providerStatus?: Partial<TotemProviderStatus>;

  // Optional execution ports for the full connect surface.
  chain?: ChainStateProviderPort;
  lease?: WotsLeasePort;
  omnia?: OmniaClientPort;
  statechain?: StatechainClientPort;
  kissvm?: KissvmClientPort;
  agent?: AgentBridgePort;
  receipts?: ReceiptStorePort;
  paymentRequests?: PaymentRequestPort;
  selfHosted?: SelfHostedPort;
  edge?: EdgeDispatchPort;

  /** Extra/override method handlers. */
  handlers?: readonly WalletMethodHandler[];
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

// ─── RPC error (kept for compatibility) ───────────────────────────────────────

export class TotemAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: number = -32000,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = 'TotemAdapterError';
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ORIGIN_METHODS = new Set([
  'TOTEM_CONNECT',
  'TOTEM_VERIFY',
  'TOTEM_GET_ACCOUNTS',
  'TOTEM_GET_COINS',
  'TOTEM_SEND_TRANSACTION',
  'TOTEM_SEND_COMPLEX',
  'TOTEM_TOKENCREATE',
  'TOTEM_SIGN_DATA',
  'TOTEM_BROADCAST_HEX',
  'TOTEM_GRANT_TX_PERMISSION',
  'TOTEM_REVOKE_TX_PERMISSION',
  'TOTEM_GET_TX_PERMISSIONS',
  'totem_signTransaction',
]);

function notConnectedError(): { success: false; error: string; errorCode: string } {
  return {
    success: false,
    error: 'Site not connected. Call TOTEM_CONNECT first.',
    errorCode: 'SITE_NOT_CONNECTED',
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

// ─── TotemWalletAdapter ───────────────────────────────────────────────────────

export abstract class TotemWalletAdapter {
  protected _chainProvider: ChainProviderLike | null;
  private readonly _config: WalletAdapterConfig;
  private readonly _connectedOrigins = new Set<string>();
  private readonly _eventListeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private readonly _usedVerifyNonces = new Set<string>();
  private _currentProviderType: 'hosted' | 'pure_rpc' | 'hybrid' = 'hosted';
  private _announceListener?: () => void;
  private _injected = false;
  private readonly _runtime: WalletRuntime;

  constructor(config: WalletAdapterConfig) {
    this._config = config;
    this._chainProvider = config.chainProvider ?? null;
    this._runtime = this._createRuntime();
  }

  // ── Abstract methods ───────────────────────────────────────────────────────

  protected abstract getAccounts(origin: string): Promise<GetAccountsResponse>;

  protected abstract signTransaction(origin: string, params: SignTransactionParams): Promise<SignTransactionResponse>;

  protected abstract signData(origin: string, params: SignDataParams): Promise<SignDataResponse>;

  // ── Optional hooks for the remaining signer-side surface ───────────────────

  protected sendTransaction?(origin: string, params: Record<string, unknown>): Promise<unknown>;
  protected sendComplex?(origin: string, params: Record<string, unknown>): Promise<unknown>;
  protected createToken?(origin: string, params: Record<string, unknown>): Promise<unknown>;
  protected broadcastHex?(origin: string, params: Record<string, unknown>): Promise<unknown>;
  protected grantTxPermission?(origin: string, params: Record<string, unknown>): Promise<unknown>;
  protected revokeTxPermission?(origin: string, params: Record<string, unknown>): Promise<unknown>;
  protected getTxPermissions?(origin: string, params: Record<string, unknown>): Promise<unknown>;
  protected getWotsStatus?(origin: string, params: Record<string, unknown>): Promise<unknown>;
  protected mineTxPoW?(origin: string, params: Record<string, unknown>): Promise<unknown>;
  protected broadcastTxPoW?(origin: string, params: Record<string, unknown>): Promise<unknown>;
  protected proveOwnership?(origin: string, params: Record<string, unknown>): Promise<unknown>;

  // ── Public API ─────────────────────────────────────────────────────────────

  /** WOTS lease port for subclasses that coordinate key-use budgets. */
  protected get lease(): WotsLeasePort | undefined {
    return this._config.lease;
  }

  inject(): void {
    if (typeof window === 'undefined' || this._injected) return;
    this._injected = true;
    const announce = () => this._announce();
    this._announceListener = announce;
    window.addEventListener(TOTEM_REQUEST_ANNOUNCE, announce);
    this._announce();
  }

  destroy(): void {
    if (typeof window !== 'undefined' && this._announceListener) {
      window.removeEventListener(TOTEM_REQUEST_ANNOUNCE, this._announceListener);
    }
    this._injected = false;
    this._connectedOrigins.clear();
    this._eventListeners.clear();
    this._usedVerifyNonces.clear();
  }

  /** The composed provider (full `TotemProvider` surface). */
  get provider(): AdapterProvider {
    return this._buildProvider();
  }

  /** Method-support manifest (handled vs unsupported + reasons). */
  meta(): WalletRuntimeMeta {
    return this._runtime.meta();
  }

  /**
   * Dispatch a request. `origin` is the host-resolved trusted origin; when
   * omitted it is resolved from `getOrigin` (or `window.location.origin`).
   */
  async handleRequest(
    method: string,
    params: Record<string, unknown> = {},
    origin?: string,
  ): Promise<unknown> {
    const trusted = this._resolveOrigin(method, origin);
    const fallback = this._config.allowUntrustedOrigin && typeof params.origin === 'string'
      ? params.origin
      : undefined;
    const effective = trusted ?? fallback;
    if (effective === undefined && ORIGIN_METHODS.has(method)) {
      return {
        success: false,
        error: `A verified origin is required for ${method}`,
        errorCode: 'ORIGIN_REQUIRED',
      };
    }
    const merged = effective === undefined ? params : { ...params, origin: effective };
    return this._runtime.provider.request({
      method,
      params: merged,
      ...(effective === undefined ? {} : { origin: effective }),
    } as never);
  }

  protected emit(event: string, ...args: unknown[]): void {
    const listeners = this._eventListeners.get(event);
    if (!listeners) return;
    listeners.forEach(cb => {
      try { cb(...args); } catch { /* noop */ }
    });
  }

  protected isConnected(origin: string): boolean {
    return this._connectedOrigins.has(origin);
  }

  // ── Runtime construction ───────────────────────────────────────────────────

  private _createRuntime(): WalletRuntime {
    const self = this;
    const info = {
      wallet: this._config.walletInfo.name ?? this._config.walletInfo.id,
      version: this._config.walletInfo.version ?? '1.0.0',
      capabilities: this._buildCapabilities(),
      get status(): TotemProviderStatus {
        return self._providerStatus();
      },
    };
    const signer = this._buildSigner();
    const approve = this._config.approve;

    const ctx: WalletHandlerContext = {
      info,
      signer,
      ...(approve
        ? {
            approvals: {
              request: ((req) => approve({
                method: req.method,
                params: req.params,
                ...(req.origin === undefined ? {} : { origin: req.origin }),
              })) as ApprovalPort['request'],
            },
          }
        : {}),
      ...(this._config.chain ? { chain: this._config.chain } : {}),
      ...(this._config.lease ? { lease: this._config.lease } : {}),
      ...(this._config.omnia ? { omnia: this._config.omnia } : {}),
      ...(this._config.statechain ? { statechain: this._config.statechain } : {}),
      ...(this._config.kissvm ? { kissvm: this._config.kissvm } : {}),
      ...(this._config.agent ? { agent: this._config.agent } : {}),
      ...(this._config.receipts ? { receipts: this._config.receipts } : {}),
      ...(this._config.paymentRequests ? { paymentRequests: this._config.paymentRequests } : {}),
      ...(this._config.edge ? { edge: this._config.edge } : {}),
      ...(this._config.selfHosted || this._config.chainProviderFactory
        ? {
            selfHosted: {
              setChainProvider: async (p: Record<string, unknown>) => {
                if (this._config.selfHosted?.setChainProvider) {
                  return this._config.selfHosted.setChainProvider(p);
                }
                return this._setChainProvider(p);
              },
            },
          }
        : {}),
    };

    const handlers: WalletMethodHandler[] = [
      {
        method: 'TOTEM_DISCONNECT',
        requiredCapabilities: [],
        handle: async (params) => self._disconnect(params),
      },
      {
        method: 'totem_getCapabilities',
        requiredCapabilities: [],
        handle: async () => self._buildCapabilities(),
      },
      {
        method: 'TOTEM_GET_CAPABILITIES',
        requiredCapabilities: [],
        handle: async () => self._buildCapabilities(),
      },
      {
        method: 'totem_setChainProvider',
        requiredCapabilities: [],
        requiresApproval: true,
        handle: async (params) => self._setChainProvider(params),
      },
      {
        method: 'TOTEM_PROVE_OWNERSHIP',
        requiredCapabilities: [],
        handle: async (params) => self._proveOwnership(params),
      },
      {
        method: 'GET_CONNECTED_SITES',
        requiredCapabilities: [],
        handle: async () => ({ sites: [...self._connectedOrigins] }),
      },
      {
        method: 'DISCONNECT_SITE',
        requiredCapabilities: [],
        handle: async (params) => self._disconnect(params),
      },
      {
        method: 'DISCONNECT_ALL_SITES',
        requiredCapabilities: [],
        handle: async () => self._disconnectAll(),
      },
      ...(this._config.handlers ?? []),
    ];

    return createWalletRuntime(ctx, {
      ...(approve
        ? {
            approve: (request) => approve({
              method: request.method,
              params: request.params,
              ...(request.origin === undefined ? {} : { origin: request.origin }),
            }),
          }
        : {}),
      handlers,
    });
  }

  private _buildSigner(): WalletSignerPort {
    const self = this;
    const signer: WalletSignerPort = {
      supports(method: string) {
        return self._supportsSignerMethod(method);
      },
      connect: (params) => self._connect(String(params.origin ?? '')),
      verify: (params) => self._verify(params),
      getAccounts: async (params) => {
        const origin = String(params.origin ?? '');
        if (!self._connectedOrigins.has(origin)) return notConnectedError();
        const result = await self.getAccounts(origin);
        return {
          accounts: result.accounts.map((account) => ({
            index: account.addressIndex,
            address: account.address,
            balance: account.balance ?? '0',
          })),
        };
      },
      signData: (params) => self._signData(String(params.origin ?? ''), params as unknown as SignDataParams),
      signTransaction: (params) => self._signTransaction(String(params.origin ?? ''), params as unknown as SignTransactionParams),
    };

    const chainGetCoins = this._config.chain?.getCoins?.bind(this._config.chain)
      ?? this._chainProvider?.getCoins?.bind(this._chainProvider);
    if (chainGetCoins) signer.getCoins = (params) => chainGetCoins(params);

    const chainBroadcast = this._config.chain?.broadcastTxPoW?.bind(this._config.chain)
      ?? this._chainProvider?.broadcastTxPoW?.bind(this._chainProvider);
    if (chainBroadcast) {
      signer.broadcastTxPoW = (params) =>
        chainBroadcast(String(params.txpowHex ?? params.signedHex ?? params.hex ?? ''));
    }

    if (this.sendTransaction) {
      signer.sendTransaction = async (params) => {
        const origin = String(params.origin ?? '');
        if (!self._connectedOrigins.has(origin)) return notConnectedError();
        const auth = await self._authorizeInputs(origin, params.inputAddresses as string[] | undefined);
        if (auth !== true) return auth;
        return self.sendTransaction!(origin, params);
      };
    }
    if (this.sendComplex) {
      signer.sendComplex = async (params) => {
        const origin = String(params.origin ?? '');
        if (!self._connectedOrigins.has(origin)) return notConnectedError();
        return self.sendComplex!(origin, params);
      };
    }
    if (this.createToken) {
      signer.createToken = async (params) => {
        const origin = String(params.origin ?? '');
        if (!self._connectedOrigins.has(origin)) return notConnectedError();
        return self.createToken!(origin, params);
      };
    }
    if (this.broadcastHex) {
      signer.broadcastHex = async (params) => {
        const origin = String(params.origin ?? '');
        if (!self._connectedOrigins.has(origin)) return notConnectedError();
        return self.broadcastHex!(origin, params);
      };
    }
    if (this.grantTxPermission) {
      signer.grantTxPermission = async (params) => {
        const origin = String(params.origin ?? '');
        if (!self._connectedOrigins.has(origin)) return notConnectedError();
        return self.grantTxPermission!(origin, params);
      };
    }
    if (this.revokeTxPermission) {
      signer.revokeTxPermission = async (params) => {
        const origin = String(params.origin ?? '');
        if (!self._connectedOrigins.has(origin)) return notConnectedError();
        return self.revokeTxPermission!(origin, params);
      };
    }
    if (this.getTxPermissions) {
      signer.getTxPermissions = async (params) => {
        const origin = String(params.origin ?? '');
        if (!self._connectedOrigins.has(origin)) return notConnectedError();
        return self.getTxPermissions!(origin, params);
      };
    }
    if (this.getWotsStatus) {
      signer.getWotsStatus = async (params) => {
        const origin = String(params.origin ?? '');
        if (!self._connectedOrigins.has(origin)) return notConnectedError();
        return self.getWotsStatus!(origin, params);
      };
    }
    if (this.mineTxPoW) {
      signer.mineTxPoW = async (params) => {
        const origin = String(params.origin ?? '');
        if (!self._connectedOrigins.has(origin)) return notConnectedError();
        return self.mineTxPoW!(origin, params);
      };
    }
    if (this.broadcastTxPoW) {
      signer.broadcastTxPoW = async (params) => {
        const origin = String(params.origin ?? '');
        if (!self._connectedOrigins.has(origin)) return notConnectedError();
        return self.broadcastTxPoW!(origin, params);
      };
    }
    if (this.proveOwnership) {
      signer.proveOwnership = async (params) => {
        const origin = String(params.origin ?? '');
        if (!self._connectedOrigins.has(origin)) return notConnectedError();
        return self.proveOwnership!(origin, params);
      };
    }

    return signer;
  }

  private _supportsSignerMethod(method: string): boolean {
    switch (method) {
      case 'TOTEM_GET_COINS':
        return Boolean(this._config.chain?.getCoins || this._chainProvider);
      case 'TOTEM_SEND_TRANSACTION':
        return typeof this.sendTransaction === 'function';
      case 'TOTEM_SEND_COMPLEX':
        return typeof this.sendComplex === 'function';
      case 'TOTEM_TOKENCREATE':
        return typeof this.createToken === 'function';
      case 'TOTEM_BROADCAST_HEX':
        return typeof this.broadcastHex === 'function';
      case 'TOTEM_GRANT_TX_PERMISSION':
        return typeof this.grantTxPermission === 'function';
      case 'TOTEM_REVOKE_TX_PERMISSION':
        return typeof this.revokeTxPermission === 'function';
      case 'TOTEM_GET_TX_PERMISSIONS':
        return typeof this.getTxPermissions === 'function';
      case 'totem_getWotsStatus':
        return typeof this.getWotsStatus === 'function';
      case 'totem_mineTxPoW':
        return typeof this.mineTxPoW === 'function';
      case 'totem_broadcastTxPoW':
        return typeof this.broadcastTxPoW === 'function'
          || Boolean(this._config.chain?.broadcastTxPoW || this._chainProvider?.broadcastTxPoW);
      default:
        return true;
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private async _connect(origin: string): Promise<ConnectResponse | { success: false; error: string; errorCode: string }> {
    if (!origin) {
      return { success: false, error: 'A verified origin is required for TOTEM_CONNECT', errorCode: 'ORIGIN_REQUIRED' };
    }
    const result = await this.getAccounts(origin);
    const first = result.accounts[result.activeIndex] ?? result.accounts[0];
    if (!first) {
      return { success: false, error: 'No accounts available', errorCode: 'NO_ACCOUNTS' };
    }
    const isReconnect = this._connectedOrigins.has(origin);
    this._connectedOrigins.add(origin);
    this.emit('connect', { origin, address: first.address, addressIndex: first.addressIndex });
    return {
      connected: true,
      address: first.address,
      addressIndex: first.addressIndex,
      publicKey: first.publicKey,
      isReconnect,
    };
  }

  private _disconnect(params: Record<string, unknown>): DisconnectResponse {
    const origin = String(params.origin ?? '');
    if (!this._connectedOrigins.has(origin)) {
      return { success: false, error: 'Site not connected.', errorCode: 'SITE_NOT_CONNECTED' };
    }
    this._connectedOrigins.delete(origin);
    this.emit('accountsChanged', []);
    this.emit('disconnect', { origin });
    return { success: true };
  }

  private _disconnectAll(): { success: true } {
    this._connectedOrigins.clear();
    this.emit('accountsChanged', []);
    this.emit('disconnect', { origin: null });
    return { success: true };
  }

  private async _verify(
    params: Record<string, unknown>,
  ): Promise<VerifyResponse | { success: false; error: string; errorCode: string }> {
    const origin = String(params.origin ?? '');
    if (!this._connectedOrigins.has(origin)) return notConnectedError();

    const challenge = asRecord(params.challenge);
    const domain = typeof challenge.domain === 'string' ? challenge.domain : undefined;
    if (domain !== undefined && domain !== origin) {
      return { success: false, error: 'Challenge domain does not match the requesting origin', errorCode: 'ORIGIN_MISMATCH' };
    }
    const uri = typeof challenge.uri === 'string' ? challenge.uri : undefined;
    if (uri !== undefined && uri !== origin) {
      return { success: false, error: 'Challenge URI does not match the requesting origin', errorCode: 'ORIGIN_MISMATCH' };
    }

    const statement = String(challenge.statement ?? `Sign in to ${origin}`);
    const nonce = String(challenge.nonce ?? this._randomHex(8));
    if (this._usedVerifyNonces.has(nonce)) {
      return { success: false, error: 'Challenge nonce has already been used', errorCode: 'NONCE_REPLAY' };
    }
    const expiryMs = Number(challenge.expiryMs ?? 300_000);
    if (!Number.isSafeInteger(expiryMs) || expiryMs <= 0) {
      return { success: false, error: 'Challenge expiryMs must be a positive integer', errorCode: 'INVALID_CHALLENGE' };
    }
    const expiresAt = Date.now() + expiryMs;

    const message = [
      `${origin} wants you to sign in with your Minima wallet.`,
      '',
      statement,
      '',
      `URI: ${origin}`,
      `Nonce: ${nonce}`,
      `Issued At: ${new Date().toISOString()}`,
      `Expiration Time: ${new Date(expiresAt).toISOString()}`,
    ].join('\n');

    const messageHex = '0x' + Array.from(
      new TextEncoder().encode(message),
      b => b.toString(16).padStart(2, '0'),
    ).join('');

    const accountsResult = await this.getAccounts(origin);
    const first = accountsResult.accounts[accountsResult.activeIndex] ?? accountsResult.accounts[0];
    if (!first) {
      return { success: false, error: 'No accounts available', errorCode: 'NO_ACCOUNTS' };
    }
    if (!first.publicKey) {
      return {
        success: false,
        error: 'Active account has no public key — TOTEM_VERIFY requires a WOTS public key.',
        errorCode: 'NO_PUBLIC_KEY',
      };
    }

    const signResult = await this.signData(origin, {
      unsignedHex: messageHex,
      inputAddresses: [first.address],
      returnFormat: 'hex',
    });
    if (!signResult.success) {
      return {
        success: false,
        error: signResult.error ?? 'Sign failed',
        errorCode: signResult.errorCode ?? 'SIGN_FAILED',
      };
    }

    this._usedVerifyNonces.add(nonce);
    if (this._usedVerifyNonces.size > 1024) this._usedVerifyNonces.clear();

    return {
      verified: true,
      verificationId: `verify-${Date.now()}-${this._randomHex(8)}`,
      address: first.address,
      message,
      signature: signResult.signedHex ?? '',
      publicKey: first.publicKey,
      expiresAt,
      sessionToken: this._randomHex(32),
      sessionExpiresAt: expiresAt,
    };
  }

  private async _signTransaction(
    origin: string,
    params: SignTransactionParams,
  ): Promise<SignTransactionResponse> {
    if (!this._connectedOrigins.has(origin)) return notConnectedError();
    const auth = await this._authorizeInputs(origin, params.inputAddresses);
    if (auth !== true) return auth;
    return this.signTransaction(origin, {
      unsignedHex: String(params.unsignedHex ?? ''),
      inputAddresses: Array.isArray(params.inputAddresses) ? params.inputAddresses : [],
      ...(params.inputIndices === undefined ? {} : { inputIndices: params.inputIndices }),
      returnFormat: params.returnFormat ?? 'hex',
    });
  }

  private async _signData(
    origin: string,
    params: SignDataParams,
  ): Promise<SignDataResponse> {
    if (!this._connectedOrigins.has(origin)) return notConnectedError();
    const auth = await this._authorizeInputs(origin, params.inputAddresses);
    if (auth !== true) return auth;
    return this.signData(origin, {
      unsignedHex: String(params.unsignedHex ?? ''),
      inputAddresses: Array.isArray(params.inputAddresses) ? params.inputAddresses : [],
      ...(params.inputIndices === undefined ? {} : { inputIndices: params.inputIndices }),
      returnFormat: params.returnFormat ?? 'hex',
    });
  }

  private async _authorizeInputs(
    origin: string,
    inputAddresses: string[] | undefined,
  ): Promise<true | { success: false; error: string; errorCode: string }> {
    if (this._config.allowExternalInputs) return true;
    const inputs = Array.isArray(inputAddresses) ? inputAddresses : [];
    if (inputs.length === 0) return true;
    const result = await this.getAccounts(origin);
    const allowed = new Set(result.accounts.map(account => account.address.toLowerCase()));
    const unauthorized = inputs.find(address => !allowed.has(String(address).toLowerCase()));
    if (unauthorized) {
      return {
        success: false,
        error: `Input address ${unauthorized} is not a connected account`,
        errorCode: 'ADDRESS_NOT_AUTHORIZED',
      };
    }
    return true;
  }

  private async _proveOwnership(
    params: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.proveOwnership) {
      return { success: false, error: 'Wallet does not expose ownership proofs.', errorCode: 'UNSUPPORTED' };
    }
    const origin = String(params.origin ?? '');
    if (!this._connectedOrigins.has(origin)) return notConnectedError();
    return this.proveOwnership(origin, params);
  }

  private _setChainProvider(
    params: Record<string, unknown>,
  ): { success: boolean; providerType?: string; error?: string; errorCode?: string } {
    const providerType = String(params.providerType ?? '');
    if (providerType !== 'hosted' && providerType !== 'pure_rpc' && providerType !== 'hybrid') {
      return { success: false, error: `Invalid provider type: ${providerType}`, errorCode: 'INVALID_PROVIDER_TYPE' };
    }
    if (!this._config.chainProviderFactory) {
      return { success: false, error: 'No chain provider factory configured', errorCode: 'UNSUPPORTED' };
    }
    try {
      const rpcEndpoint = typeof params.rpcEndpoint === 'string' ? params.rpcEndpoint : undefined;
      this._chainProvider = this._config.chainProviderFactory(providerType, rpcEndpoint);
      this._currentProviderType = providerType;
      this.emit('chainChanged', { providerType });
      return { success: true, providerType };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        errorCode: 'PROVIDER_ERROR',
      };
    }
  }

  // ── Announcement / provider ────────────────────────────────────────────────

  private _announce(): void {
    const provider = this._buildProvider();
    window.dispatchEvent(
      new CustomEvent(TOTEM_ANNOUNCE, {
        detail: { info: this._config.walletInfo, provider },
      }),
    );
  }

  private _buildProvider(): AdapterProvider {
    const self = this;
    return {
      isTotem: true,
      request: (args: { method: string; params?: Record<string, unknown>; origin?: string }) =>
        self.handleRequest(args.method, args.params ?? {}, args.origin),
      on: (event: string, callback: (...args: unknown[]) => void) => {
        if (!self._eventListeners.has(event)) self._eventListeners.set(event, new Set());
        self._eventListeners.get(event)!.add(callback);
      },
      removeListener: (event: string, callback: (...args: unknown[]) => void) => {
        self._eventListeners.get(event)?.delete(callback);
      },
      enable: () => self.handleRequest('TOTEM_CONNECT', {}),
      send: (method: string, params?: unknown[]) => self.handleRequest(method, asRecord(params)),
      getCoins: (params?: Record<string, unknown>) => self.handleRequest('TOTEM_GET_COINS', asRecord(params)),
      sendComplex: (buildParams: Record<string, unknown>, mode?: 'build' | 'submit') =>
        self.handleRequest('TOTEM_SEND_COMPLEX', { ...buildParams, ...(mode ? { mode } : {}) }),
      signData: (params: Record<string, unknown>) => self.handleRequest('TOTEM_SIGN_DATA', params),
      broadcastHex: (params: Record<string, unknown>) => self.handleRequest('TOTEM_BROADCAST_HEX', params),
    } as AdapterProvider;
  }

  private _resolveOrigin(method: string, explicit?: string): string | undefined {
    if (explicit) return explicit;
    const fromConfig = this._config.getOrigin?.(method);
    if (fromConfig) return fromConfig;
    if (
      typeof window !== 'undefined' &&
      window.location &&
      window.location.origin &&
      window.location.origin !== 'null'
    ) {
      return window.location.origin;
    }
    return undefined;
  }

  private _buildCapabilities(): WalletCapabilities {
    const { walletInfo, capabilities: caps } = this._config;
    return {
      version: walletInfo.version ?? '1.0.0',
      wallet: {
        selfCustody: false,
        wotsTreeKey: false,
        rootIdentity: false,
        treeKeyDepth: null,
        maxAddresses: null,
        seedExport: false,
        custodyType: 'hosted',
        ...(caps?.wallet ?? {}),
      },
      account: {
        multiAddress: false,
        accountSwitcher: false,
        ...(caps?.account ?? {}),
      },
      chain: {
        hostedProvider: this._chainProvider !== null,
        pureMinimaRpc: false,
        lookupNode: false,
        localProofVerify: false,
        pearRuntime: false,
        hyperswarm: false,
        ...(caps?.chain ?? {}),
      },
      txpow: {
        localMining: false,
        progressEvents: false,
        ...(caps?.txpow ?? {}),
      },
      omnia: {
        channels: false,
        routing: false,
        multiHop: false,
        crossTokenSwap: false,
        factory: false,
        virtualChannels: false,
        splicing: false,
        hyperswarm: false,
        ...(caps?.omnia ?? {}),
      },
      statechain: {
        supported: false,
        blindSE: false,
        ...(caps?.statechain ?? {}),
      },
      scripting: {
        kissvm: false,
        ...(caps?.scripting ?? {}),
      },
      qvac: {
        paymentIntents: false,
        explanations: false,
        ...(caps?.qvac ?? {}),
      },
    };
  }

  private _providerStatus(): TotemProviderStatus {
    return {
      network: this._config.network ?? 'mainnet',
      relayAvailable: false,
      localMiningAvailable: false,
      pearRuntime: false,
      lookupLatencyMs: null,
      ...(this._config.providerStatus ?? {}),
      providerType: this._currentProviderType,
    };
  }

  private _randomHex(bytes: number): string {
    const cryptoObj = (globalThis as { crypto?: { getRandomValues?: <T extends ArrayBufferView>(array: T) => T } }).crypto;
    if (!cryptoObj?.getRandomValues) {
      throw new Error('A secure random source is required for TOTEM_VERIFY');
    }
    const buffer = new Uint8Array(bytes);
    cryptoObj.getRandomValues(buffer);
    return Array.from(buffer, b => b.toString(16).padStart(2, '0')).join('');
  }
}

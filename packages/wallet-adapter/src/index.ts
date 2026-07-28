/**
 * @totemsdk/wallet-adapter
 *
 * Abstract base class for building Totem-compatible wallets.
 * Hardware wallet bridges, mobile companion apps, institutional custody
 * wallets — any third-party signer that wants to be discoverable by dApps
 * using the TOTEM_ANNOUNCE multi-wallet discovery protocol.
 *
 * Usage: subclass TotemWalletAdapter, implement the three abstract methods,
 * then call adapter.inject() from your content script or page context.
 *
 * @example
 * ```ts
 * import { TotemWalletAdapter } from '@totemsdk/wallet-adapter';
 *
 * class MyWallet extends TotemWalletAdapter {
 *   async getAccounts(origin) {
 *     return { accounts: [{ address: 'Mx...', addressIndex: 0, publicKey: 'deadbeef...' }], activeIndex: 0 };
 *   }
 *   async signTransaction(origin, params) {
 *     const signed = await myHardwareDevice.sign(params.unsignedHex);
 *     return { success: true, signedHex: signed };
 *   }
 *   async signData(origin, params) {
 *     const signed = await myHardwareDevice.sign(params.unsignedHex);
 *     return { success: true, signedHex: signed };
 *   }
 * }
 *
 * const wallet = new MyWallet({
 *   walletInfo: { id: 'my-wallet', name: 'My Wallet', version: '1.0.0' },
 * });
 * wallet.inject();
 * ```
 */

// ─── TOTEM_ANNOUNCE protocol constants ────────────────────────────────────────
// Inlined so this package has zero runtime dependencies.

const TOTEM_ANNOUNCE_EVENT = 'totem:announce';
const TOTEM_REQUEST_ANNOUNCE_EVENT = 'totem:requestAnnounce';

// ─── Wallet identity ──────────────────────────────────────────────────────────

export interface WalletInfo {
  id: string;
  name: string;
  icon?: string;
  version?: string;
}

// ─── Capability declaration ───────────────────────────────────────────────────
// Mirrors TotemCapabilities from @totemsdk/connect — inlined so consumers
// don't need @totemsdk/connect installed.

export interface WalletCapabilities {
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

// ─── Abstract method parameter and return types ───────────────────────────────

export interface AccountEntry {
  address: string;
  addressIndex: number;
  /** WOTS public key hex. Required for TOTEM_VERIFY — return null only for accounts that will not be used for verification. */
  publicKey: string | null;
  balance?: string;
}

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

// ─── Chain provider (structural / duck-typed) ─────────────────────────────────
// Using a structural interface so @totemsdk/chain-provider is a true optional
// peer dep — the adapter never imports it at runtime. Pass any object that
// satisfies ChainProviderLike and it will work.

export interface ChainProviderLike {
  getCoins(query: Record<string, unknown>): Promise<unknown[]>;
  getCoin(coinId: string): Promise<unknown>;
  getProof(coinId: string): Promise<unknown>;
  getTip(): Promise<{ block: number; hash: string; time?: string }>;
  getToken(tokenId: string): Promise<unknown>;
  searchTokens(query: Record<string, unknown>): Promise<unknown[]>;
  getTokensByCreator(address: string): Promise<unknown[]>;
  broadcastTxPoW(txpowHex: string): Promise<{ success: boolean; txpowid?: string; message?: string }>;
}

// Factory signature for dynamic provider switching (totem_setChainProvider).
// If you use @totemsdk/chain-provider, return the appropriate provider class:
//
//   import { HostedProvider, PureMinimaRpcProvider } from '@totemsdk/chain-provider';
//   chainProviderFactory: (type, rpcEndpoint) => {
//     if (type === 'pure_rpc' && rpcEndpoint) return new PureMinimaRpcProvider({ endpoint: rpcEndpoint });
//     return new HostedProvider({ baseUrl: 'https://api.axia.to', apiKey: '...' });
//   }

export type ChainProviderFactory = (
  providerType: 'hosted' | 'pure_rpc' | 'hybrid',
  rpcEndpoint?: string,
) => ChainProviderLike;

// ─── Adapter configuration ────────────────────────────────────────────────────

export interface WalletAdapterConfig {
  walletInfo: WalletInfo;
  capabilities?: DeepPartial<Omit<WalletCapabilities, 'version'>>;
  chainProvider?: ChainProviderLike;
  chainProviderFactory?: ChainProviderFactory;
}

// Utility type — allows partial nesting in capability overrides
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

// ─── TotemProvider shape (what dApps receive) ─────────────────────────────────

export interface AdapterProvider {
  isTotem: true;
  request(args: { method: string; params?: Record<string, unknown> }): Promise<unknown>;
  on(event: string, callback: (...args: unknown[]) => void): void;
  removeListener(event: string, callback: (...args: unknown[]) => void): void;
}

// ─── RPC error ────────────────────────────────────────────────────────────────

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

// ─── Protocol response shapes (canonical TOTEM_CONNECT v4.x) ─────────────────

export interface ConnectResponse {
  connected: true;
  address: string;
  addressIndex: number;
  isReconnect?: boolean;
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

// ─── Not-connected error helper ───────────────────────────────────────────────

function notConnectedError(): { success: false; error: string; errorCode: string } {
  return {
    success: false,
    error: 'Site not connected. Call TOTEM_CONNECT first.',
    errorCode: 'SITE_NOT_CONNECTED',
  };
}

// ─── TotemWalletAdapter ───────────────────────────────────────────────────────

/**
 * Abstract base class for third-party Totem-compatible wallets.
 *
 * Subclass this and implement only three methods:
 * - `getAccounts(origin)` — return the list of accounts for a dApp origin
 * - `signTransaction(origin, params)` — sign an unsigned transaction hex
 * - `signData(origin, params)` — sign arbitrary data hex
 *
 * Everything else — TOTEM_CONNECT handshake, TOTEM_GET_CAPABILITIES,
 * connected-site gating, chain provider switching, and the totem:announce
 * injection — is handled automatically by the base class.
 *
 * Call `adapter.inject()` once from your extension content script or page
 * context to make the wallet discoverable by any dApp using WalletDiscovery
 * from @totemsdk/connect.
 */
export abstract class TotemWalletAdapter {
  protected _chainProvider: ChainProviderLike | null;
  private readonly _config: WalletAdapterConfig;
  private readonly _connectedOrigins = new Set<string>();
  private readonly _eventListeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private _currentProviderType: 'hosted' | 'pure_rpc' | 'hybrid' = 'hosted';
  private _announceListener?: () => void;
  private _injected = false;

  constructor(config: WalletAdapterConfig) {
    this._config = config;
    this._chainProvider = config.chainProvider ?? null;
  }

  // ── Abstract methods ───────────────────────────────────────────────────────

  /**
   * Return the accounts this wallet manages for the given dApp origin.
   * Called on TOTEM_CONNECT and TOTEM_GET_ACCOUNTS.
   *
   * Note: `publicKey` must be a non-null hex string for any account that
   * will be used with TOTEM_VERIFY. Return null only for accounts that
   * will never need to produce verification signatures.
   */
  protected abstract getAccounts(origin: string): Promise<GetAccountsResponse>;

  /**
   * Sign an unsigned Minima transaction hex.
   * Called on totem_signTransaction.
   * The base class does NOT perform coin selection — if you need it, handle
   * TOTEM_SEND_TRANSACTION as a future extension point in your subclass.
   */
  protected abstract signTransaction(origin: string, params: SignTransactionParams): Promise<SignTransactionResponse>;

  /**
   * Sign arbitrary data (used for TOTEM_SIGN_DATA and TOTEM_VERIFY).
   */
  protected abstract signData(origin: string, params: SignDataParams): Promise<SignDataResponse>;

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Fire `totem:announce` and register a `totem:requestAnnounce` listener
   * so the wallet re-announces on demand. Safe to call from a content script
   * or an injected MAIN-world script.
   *
   * No-op if called more than once — call `destroy()` first to re-inject.
   */
  inject(): void {
    if (typeof window === 'undefined' || this._injected) return;
    this._injected = true;
    const announce = () => this._announce();
    this._announceListener = announce;
    window.addEventListener(TOTEM_REQUEST_ANNOUNCE_EVENT, announce);
    this._announce();
  }

  /**
   * Remove the `totem:requestAnnounce` listener and clear all state.
   * After calling destroy() the adapter will no longer respond to dApp
   * discovery requests.
   */
  destroy(): void {
    if (typeof window !== 'undefined' && this._announceListener) {
      window.removeEventListener(TOTEM_REQUEST_ANNOUNCE_EVENT, this._announceListener);
    }
    this._injected = false;
    this._connectedOrigins.clear();
    this._eventListeners.clear();
  }

  /**
   * Dispatch a single RPC request as if it came from a dApp provider.request() call.
   * Useful for testing without a real browser environment.
   */
  async handleRequest(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<unknown> {
    switch (method) {
      case 'TOTEM_CONNECT':
        return this._handleConnect(params);
      case 'TOTEM_DISCONNECT':
        return this._handleDisconnect(params);
      case 'TOTEM_VERIFY':
        return this._handleVerify(params);
      case 'TOTEM_GET_ACCOUNTS':
        return this._handleGetAccounts(params);
      case 'TOTEM_SIGN_DATA':
        return this._handleSignData(params);
      case 'totem_signTransaction':
        return this._handleSignTransaction(params);
      case 'TOTEM_GET_CAPABILITIES':
      case 'totem_getCapabilities':
        return this._handleGetCapabilities();
      case 'totem_setChainProvider':
        return this._handleSetChainProvider(params);
      case 'totem_getProviderStatus':
        return this._handleGetProviderStatus();
      default:
        throw new TotemAdapterError(
          `Method not supported: ${method}`,
          -32601,
          'METHOD_UNSUPPORTED',
        );
    }
  }

  /**
   * Emit an event to all dApp listeners subscribed via provider.on().
   * Call this from your subclass when wallet state changes (e.g. account changed).
   */
  protected emit(event: string, ...args: unknown[]): void {
    const listeners = this._eventListeners.get(event);
    if (!listeners) return;
    listeners.forEach(cb => {
      try { cb(...args); } catch { /* noop */ }
    });
  }

  /**
   * Check whether a given origin has called TOTEM_CONNECT.
   * Useful in subclass implementations that want to gate custom behaviour.
   */
  protected isConnected(origin: string): boolean {
    return this._connectedOrigins.has(origin);
  }

  // ── Private: announcement ──────────────────────────────────────────────────

  private _announce(): void {
    const provider = this._buildProvider();
    window.dispatchEvent(
      new CustomEvent(TOTEM_ANNOUNCE_EVENT, {
        detail: { info: this._config.walletInfo, provider } satisfies {
          info: WalletInfo;
          provider: AdapterProvider;
        },
      }),
    );
  }

  private _buildProvider(): AdapterProvider {
    return {
      isTotem: true,
      request: async (args: { method: string; params?: Record<string, unknown> }) =>
        this.handleRequest(args.method, args.params ?? {}),
      on: (event: string, cb: (...args: unknown[]) => void) => {
        if (!this._eventListeners.has(event)) {
          this._eventListeners.set(event, new Set());
        }
        this._eventListeners.get(event)!.add(cb);
      },
      removeListener: (event: string, cb: (...args: unknown[]) => void) => {
        this._eventListeners.get(event)?.delete(cb);
      },
    };
  }

  // ── Private: built-in handlers ─────────────────────────────────────────────

  private async _handleConnect(params: Record<string, unknown>): Promise<ConnectResponse> {
    const origin = String(params.origin ?? 'unknown');
    const isReconnect = this._connectedOrigins.has(origin);
    this._connectedOrigins.add(origin);

    const result = await this.getAccounts(origin);
    const first = result.accounts[0] ?? { address: '', addressIndex: 0, publicKey: null };
    return {
      connected: true,
      address: first.address,
      addressIndex: first.addressIndex,
      isReconnect,
    };
  }

  private _handleDisconnect(params: Record<string, unknown>): DisconnectResponse {
    const origin = String(params.origin ?? '');
    if (!this._connectedOrigins.has(origin)) {
      return {
        success: false,
        error: 'Site not connected.',
        errorCode: 'SITE_NOT_CONNECTED',
      };
    }
    this._connectedOrigins.delete(origin);
    // Notify any listeners that accounts are now empty
    this.emit('accountsChanged', []);
    return { success: true };
  }

  private async _handleVerify(
    params: Record<string, unknown>,
  ): Promise<VerifyResponse | { success: false; error: string; errorCode: string }> {
    const origin = String(params.origin ?? '');

    if (!this._connectedOrigins.has(origin)) {
      return notConnectedError();
    }

    const challenge = params.challenge as Record<string, unknown> | undefined;
    const statement = String(challenge?.statement ?? `Sign in to ${origin}`);
    const nonce = String(challenge?.nonce ?? Math.random().toString(36).slice(2));
    const expiryMs = Number(challenge?.expiryMs ?? 300_000);
    const expiresAt = Date.now() + expiryMs;

    // Build the canonical sign-in message (EIP-4361-style but Minima-native)
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

    const messageHex =
      '0x' +
      Array.from(new TextEncoder().encode(message), b =>
        b.toString(16).padStart(2, '0'),
      ).join('');

    const accountsResult = await this.getAccounts(origin);
    const first = accountsResult.accounts[0];
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

    const verifyBuf = crypto.getRandomValues(new Uint8Array(8));
    const verificationId = `verify-${Date.now()}-${Array.from(verifyBuf, b => b.toString(16).padStart(2, '0')).join('')}`;

    return {
      verified: true,
      verificationId,
      address: first.address,
      message,
      signature: signResult.signedHex ?? '',
      publicKey: first.publicKey,
      expiresAt,
    };
  }

  private async _handleGetAccounts(
    params: Record<string, unknown>,
  ): Promise<GetAccountsResponse | { success: false; error: string; errorCode: string }> {
    const origin = String(params.origin ?? '');
    if (!this._connectedOrigins.has(origin)) {
      return notConnectedError();
    }
    return this.getAccounts(origin);
  }

  private async _handleSignTransaction(
    params: Record<string, unknown>,
  ): Promise<SignTransactionResponse> {
    const origin = String(params.origin ?? '');
    if (!this._connectedOrigins.has(origin)) {
      return notConnectedError();
    }
    return this.signTransaction(origin, {
      unsignedHex: String(params.unsignedHex ?? ''),
      inputAddresses: (params.inputAddresses as string[]) ?? [],
      inputIndices: params.inputIndices as number[] | undefined,
      returnFormat: (params.returnFormat as 'hex' | 'json') ?? 'hex',
    });
  }

  private async _handleSignData(
    params: Record<string, unknown>,
  ): Promise<SignDataResponse> {
    const origin = String(params.origin ?? '');
    if (!this._connectedOrigins.has(origin)) {
      return notConnectedError();
    }
    return this.signData(origin, {
      unsignedHex: String(params.unsignedHex ?? ''),
      inputAddresses: (params.inputAddresses as string[]) ?? [],
      inputIndices: params.inputIndices as number[] | undefined,
      returnFormat: (params.returnFormat as 'hex' | 'json') ?? 'hex',
    });
  }

  private _handleGetCapabilities(): WalletCapabilities {
    const { walletInfo, capabilities: caps } = this._config;
    return {
      version: walletInfo.version ?? '1.0.0',
      wallet: {
        selfCustody: true,
        wotsTreeKey: false,
        rootIdentity: false,
        treeKeyDepth: null,
        maxAddresses: null,
        seedExport: false,
        custodyType: 'self',
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

  private _handleSetChainProvider(
    params: Record<string, unknown>,
  ): { success: boolean; providerType: string } {
    const providerType = String(
      params.providerType ?? 'hosted',
    ) as 'hosted' | 'pure_rpc' | 'hybrid';
    const rpcEndpoint = params.rpcEndpoint as string | undefined;

    this._currentProviderType = providerType;

    if (this._config.chainProviderFactory) {
      this._chainProvider = this._config.chainProviderFactory(providerType, rpcEndpoint);
    }

    return { success: true, providerType };
  }

  private _handleGetProviderStatus(): {
    providerType: string;
    network: string;
    relayAvailable: boolean;
    localMiningAvailable: boolean;
    pearRuntime: boolean;
    lookupLatencyMs: null;
  } {
    return {
      providerType: this._currentProviderType,
      network: 'mainnet',
      relayAvailable: false,
      localMiningAvailable: false,
      pearRuntime: false,
      lookupLatencyMs: null,
    };
  }
}

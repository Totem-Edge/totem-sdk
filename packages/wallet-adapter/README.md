# @totemsdk/wallet-adapter

Abstract base class for building Totem-compatible wallets. Hardware wallet bridges, mobile companion apps, institutional custody wallets — any third-party signer that wants to be discoverable by dApps using the **TOTEM_ANNOUNCE** multi-wallet discovery protocol.

## Installation

```bash
npm install @totemsdk/wallet-adapter
```

## Quick start — complete custom wallet in ~50 lines

```ts
import { TotemWalletAdapter } from '@totemsdk/wallet-adapter';

class MyHardwareWallet extends TotemWalletAdapter {
  // ── You implement these three methods ─────────────────────────────────────

  async getAccounts(origin: string) {
    // Ask your hardware device / custody backend for the active address
    const { address, publicKey } = await myDevice.getAccount();
    return {
      accounts: [{ address, addressIndex: 0, publicKey }],
      activeIndex: 0,
    };
  }

  async signTransaction(origin: string, params) {
    // Show a confirmation prompt, then sign on the device
    const approved = await myUI.confirm(`Sign transaction for ${origin}?`);
    if (!approved) return { success: false, error: 'User rejected', errorCode: 'USER_REJECTED' };

    const signedHex = await myDevice.signTransaction(params.unsignedHex, params.inputAddresses);
    return { success: true, signedHex };
  }

  async signData(origin: string, params) {
    const signedHex = await myDevice.signData(params.unsignedHex, params.inputAddresses);
    return { success: true, signedHex };
  }
}

// ── Inject once from your content script or page context ──────────────────────
const wallet = new MyHardwareWallet({
  walletInfo: {
    id: 'my-hardware-wallet',
    name: 'My Hardware Wallet',
    version: '1.0.0',
    icon: 'https://example.com/icon.png',   // optional
  },
});

wallet.inject();
// dApps using WalletDiscovery from @totemsdk/connect now see this wallet.
```

## What the builder must implement

| Method | Called by | Description |
|---|---|---|
| `getAccounts(origin)` | TOTEM_CONNECT, TOTEM_GET_ACCOUNTS | Return accounts for this dApp. `publicKey` must be non-null for any account used with TOTEM_VERIFY. |
| `signTransaction(origin, params)` | totem_signTransaction | Sign an unsigned Minima transaction hex |
| `signData(origin, params)` | TOTEM_SIGN_DATA, TOTEM_VERIFY | Sign arbitrary data (authentication, sign-in, etc.) |

## What the base class handles automatically

| TOTEM_CONNECT v4.x method | Behaviour |
|---|---|
| `TOTEM_CONNECT` | Registers the origin as connected; calls `getAccounts()` and returns `{ connected, address, addressIndex, isReconnect }` |
| `TOTEM_DISCONNECT` | Removes origin from connected set; emits `accountsChanged([])`; returns `{ success }`. Returns `SITE_NOT_CONNECTED` error if origin was not connected. |
| `TOTEM_VERIFY` | **Requires prior TOTEM_CONNECT.** Builds a sign-in message (Minima-native SIWE-style), calls `signData()`, returns canonical `{ verified, verificationId, address, message, signature, publicKey, expiresAt }`. |
| `TOTEM_GET_ACCOUNTS` | **Requires prior TOTEM_CONNECT.** Delegates to `getAccounts()`. |
| `TOTEM_SIGN_DATA` | **Requires prior TOTEM_CONNECT.** Delegates to `signData()`. |
| `totem_signTransaction` | **Requires prior TOTEM_CONNECT.** Delegates to `signTransaction()`. |
| `TOTEM_GET_CAPABILITIES` / `totem_getCapabilities` | Returns the capabilities declared in config (all default to safe/false). No connection required. |
| `totem_setChainProvider` | Switches providers via `chainProviderFactory` (if provided). No connection required. |
| `totem_getProviderStatus` | Returns current provider type and network. No connection required. |

**Connection gating**: Methods that require prior TOTEM_CONNECT return `{ success: false, error: 'Site not connected. Call TOTEM_CONNECT first.', errorCode: 'SITE_NOT_CONNECTED' }` if the origin has not yet connected.

Unknown methods throw a `TotemAdapterError` with code `-32601` (`METHOD_UNSUPPORTED`).

## TOTEM_VERIFY response shape

The base class produces the canonical TOTEM_CONNECT v4.x verify response:

```ts
{
  verified: true,
  verificationId: 'verify-1718540400000-deadbeef...',  // unique per call
  address: 'Mx...',
  message: 'https://example.com wants you to sign in with your Minima wallet.\n\n...',
  signature: '0xdeadbeef...',  // hex signature from signData()
  publicKey: 'deadbeef...',    // from getAccounts()
  expiresAt: 1718540700000,    // Date.now() + challenge.expiryMs (default 5 min)
}
```

`publicKey` is taken from `getAccounts()` — return a non-null hex string for accounts that support sign-in.

## Configuration

```ts
new MyWallet({
  walletInfo: {
    id: 'my-wallet',        // unique, stable ID (used for deduplication in WalletDiscovery)
    name: 'My Wallet',
    version: '1.0.0',
    icon: 'https://...',    // optional — shown in wallet picker UIs
  },

  // Override specific capability flags (all default to false / safe defaults)
  capabilities: {
    wallet: {
      selfCustody: true,
      wotsTreeKey: true,
      custodyType: 'self',
    },
    account: {
      multiAddress: true,
      accountSwitcher: true,
    },
  },

  // Optional: initial chain provider (used for coin lookups if needed)
  chainProvider: myChainProvider,

  // Optional: factory called when a dApp requests totem_setChainProvider
  chainProviderFactory: (providerType, rpcEndpoint) => {
    if (providerType === 'pure_rpc' && rpcEndpoint) {
      return new PureMinimaRpcProvider({ endpoint: rpcEndpoint });
    }
    return new HostedProvider({ baseUrl: 'https://api.axia.to', apiKey: '...' });
  },
});
```

## Chain provider switching

If you pass a `chainProviderFactory`, the base class calls it whenever a dApp
issues `totem_setChainProvider`. The constructed provider is stored as
`this._chainProvider` (accessible in your subclass) for any chain data lookups
you need in `getAccounts()` or `signTransaction()`.

```ts
import { HostedProvider } from '@totemsdk/chain-provider';

class MyWallet extends TotemWalletAdapter {
  async getAccounts(origin: string) {
    // this._chainProvider is set automatically when the dApp calls setChainProvider
    if (this._chainProvider) {
      const tip = await this._chainProvider.getTip();
      console.log('Chain tip:', tip.block);
    }
    return { accounts: [...], activeIndex: 0 };
  }
}
```

## Emitting wallet events

Use `this.emit(eventName, ...args)` from inside your subclass to push events
to all dApps currently listening via `provider.on()`:

```ts
class MyWallet extends TotemWalletAdapter {
  onDeviceAccountChanged(newAddress: string) {
    // Tell dApps the account changed
    this.emit('accountsChanged', [newAddress]);
  }
}
```

## Checking connection state

Use `this.isConnected(origin)` inside your subclass to check whether a
given origin has called TOTEM_CONNECT:

```ts
class MyWallet extends TotemWalletAdapter {
  async getAccounts(origin: string) {
    if (!this.isConnected(origin)) {
      // safe to return empty — TOTEM_CONNECT will call getAccounts() again
      return { accounts: [], activeIndex: 0 };
    }
    // ... fetch accounts
  }
}
```

## Lifecycle

```ts
const wallet = new MyWallet({ walletInfo: { ... } });

wallet.inject();    // fires totem:announce, listens for totem:requestAnnounce

// ... wallet is active ...

wallet.destroy();   // removes listener, clears state (connected origins, event listeners)
wallet.inject();    // safe to re-inject after destroy
```

## Testing without a browser

`handleRequest()` is public, so you can test your subclass in Node.js
without needing a real browser environment:

```ts
import { MyWallet } from './my-wallet';

const wallet = new MyWallet({ walletInfo: { id: 'test', name: 'Test' } });

// Connect the site first
const connectResult = await wallet.handleRequest('TOTEM_CONNECT', { origin: 'https://example.com' });
// { connected: true, address: 'Mx...', addressIndex: 0, isReconnect: false }

// Now get accounts (requires prior connect)
const accounts = await wallet.handleRequest('TOTEM_GET_ACCOUNTS', { origin: 'https://example.com' });

// Check capabilities (no connect required)
const caps = await wallet.handleRequest('totem_getCapabilities');

// Unknown method throws TotemAdapterError
try {
  await wallet.handleRequest('totem_unknownMethod', {});
} catch (e) {
  // e.code === -32601, e.errorCode === 'METHOD_UNSUPPORTED'
}
```

## Out of scope

- **TOTEM_SEND_TRANSACTION with coin selection** — full coin selection requires WOTS slot management and a deep understanding of the wallet's UTXO set. Implement your own `case 'TOTEM_SEND_TRANSACTION':` handler by overriding `handleRequest()`, or wait for a future `@totemsdk/coin-selector` package.
- **Mobile / React Native** — `inject()` requires `window.dispatchEvent`. For React Native, call `handleRequest()` directly from your provider bridge.
- **Implementing any specific wallet** — this package is the scaffold, not the wallet.

## Protocol reference

For the full TOTEM_CONNECT v4.x protocol spec (all request/response shapes,
error codes, security model), see
[packages/totem-extension/docs/TOTEM_CONNECT.md](../../totem-extension/docs/TOTEM_CONNECT.md)
in the monorepo.

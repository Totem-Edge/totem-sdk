# @totemsdk/wallet-adapter

Abstract base class for building Totem-compatible wallets. Hardware wallet
bridges, mobile companion apps, institutional custody wallets — any third-party
signer discoverable by dApps using the **TOTEM_ANNOUNCE** multi-wallet discovery
protocol.

The adapter is a thin binding over the shared wallet runtime in
`@totemsdk/connect/wallet`. You implement the signer; the runtime supplies the
full 48-method connect surface, mandatory approvals, WOTS lease coordination and
explicit `UNSUPPORTED` dispositions.

## Installation

```bash
npm install @totemsdk/wallet-adapter
```

## Quick start

```ts
import { TotemWalletAdapter } from '@totemsdk/wallet-adapter';

class MyHardwareWallet extends TotemWalletAdapter {
  async getAccounts(origin: string) {
    const { address, publicKey } = await myDevice.getAccount();
    return {
      accounts: [{ address, addressIndex: 0, publicKey }],
      activeIndex: 0,
    };
  }

  async signTransaction(origin: string, params) {
    const signedHex = await myDevice.signTransaction(params.unsignedHex, params.inputAddresses);
    return { success: true, signedHex };
  }

  async signData(origin: string, params) {
    const signedHex = await myDevice.signData(params.unsignedHex, params.inputAddresses);
    return { success: true, signedHex };
  }
}

const wallet = new MyHardwareWallet({
  walletInfo: { id: 'my-hardware-wallet', name: 'My Hardware Wallet', version: '1.0.0' },

  // Trusted origin (host-resolved — never the dApp-supplied value).
  getOrigin: () => window.location.origin,

  // Mandatory for approval-required methods; absent ⇒ they are UNSUPPORTED.
  approve: async ({ method, origin, params }) => myUi.confirm(method, origin, params),
});

wallet.inject();
```

## What you implement

| Method | Used by | Notes |
|---|---|---|
| `getAccounts(origin)` | `TOTEM_CONNECT`, `TOTEM_GET_ACCOUNTS`, `TOTEM_VERIFY` | Return accounts; `publicKey` must be non-null for sign-in. |
| `signTransaction(origin, params)` | `totem_signTransaction` | Sign an unsigned Minima transaction. |
| `signData(origin, params)` | `TOTEM_SIGN_DATA`, `TOTEM_VERIFY` | Sign arbitrary data. |

Optional hooks unlock the rest of the signer-side surface:
`sendTransaction`, `sendComplex`, `createToken`, `broadcastHex`,
`grantTxPermission`, `revokeTxPermission`, `getTxPermissions`, `getWotsStatus`,
`mineTxPoW`, `broadcastTxPoW`, `proveOwnership`. Implement only what your wallet
supports; the manifest reports the rest as `unsupported` with a reason.

## Security model

- **Approvals are fail-closed.** Every approval-required method (connect, verify,
  signing, payments, Omnia/statechain mutations, token creation, permissions,
  agent proposals) is `unsupported` unless an `approve` callback is configured.
  The callback receives the **trusted** `origin`.
- **Trusted origin.** The dApp-supplied `params.origin` is ignored unless
  `allowUntrustedOrigin: true`. By default the origin comes from `getOrigin` (or
  `window.location.origin`). Requests with no resolvable origin fail with
  `ORIGIN_REQUIRED`.
- **Input authorization.** `signTransaction`, `signData` and `sendTransaction`
  reject inputs outside the connected accounts (`ADDRESS_NOT_AUTHORIZED`) unless
  `allowExternalInputs: true`.
- **Verify binding.** `TOTEM_VERIFY` rejects a challenge whose `domain`/`uri`
  does not match the trusted origin (`ORIGIN_MISMATCH`), rejects reused nonces
  (`NONCE_REPLAY`), and issues a session token/expiry.
- **WOTS lease.** Pass a `lease` port to expose `totem_getWotsStatus`,
  `totem_reserveWotsLease` and `totem_releaseWotsLease`; subclasses can read it
  via `this.lease` and must reserve/commit/burn around signing.

## Full method surface

All canonical connect methods are addressable. Families and the port that enables
them:

| Family | Ports | Examples |
|---|---|---|
| Legacy core | `signer`, `approvals` | connect, verify, sendTransaction, getCoins, sendComplex, createToken, signData, broadcastHex, tx permissions |
| Discovery / chain | `info`, `selfHosted` | getCapabilities, getProviderStatus, setChainProvider |
| WOTS | `signer`, `lease` | getWotsStatus, reserve/releaseWotsLease |
| Transaction flow | `signer`, `approvals` | signTransaction, mineTxPoW, broadcastTxPoW |
| Payments / receipts | `paymentRequests`, `receipts`, `edge` | create/payPaymentRequest, getTransactionStatus, getReceipt |
| Omnia | `omnia` (or `edge`) | get/open/pay/settle/close, route, multi-hop, swap rate, factory, virtual channel, splice |
| Statechain | `statechain`, `approvals` | create/transfer/claim/verify |
| KISSVM | `kissvm` | simulate/validate |
| Agent | `agent` | propose/explain/createReceipt |

Inspect the live disposition with `wallet.meta()`:

```ts
const { manifest } = wallet.meta();
// manifest.methods: Record<method, 'supported' | 'unsupported'>
// manifest.reasons: Record<method, string>   (for unsupported methods)
```

## Configuration

```ts
new MyWallet({
  walletInfo: { id: 'my-wallet', name: 'My Wallet', version: '1.0.0' },

  getOrigin: (method) => window.location.origin,
  approve: async ({ method, origin, params }) => myUi.confirm(method, origin, params),

  // Capabilities default to safe/false; declare what you actually support.
  capabilities: {
    wallet: { selfCustody: true, wotsTreeKey: true, custodyType: 'self' },
    account: { multiAddress: true, accountSwitcher: true },
    omnia: { channels: true, routing: true },
  },

  chainProvider: myChainProvider,
  chainProviderFactory: (providerType, rpcEndpoint) => makeProvider(providerType, rpcEndpoint),

  // Optional execution ports (see table above).
  lease: myWotsLease,
  omnia: myOmniaClient,
  statechain: myStatechainClient,
  kissvm: myKissvmClient,
  agent: myAgentBridge,
  receipts: myReceiptStore,
  paymentRequests: myPaymentRequestStore,
  selfHosted: mySelfHostedPort,
  edge: myGovernedEdgeDispatch,
  chain: myChainStateProvider,
});
```

## Response shapes

`TOTEM_CONNECT` returns the canonical shape including the WOTS public key:

```ts
{ connected: true, address: 'Mx…', addressIndex: 0, publicKey: '…', isReconnect: false }
```

`TOTEM_GET_ACCOUNTS` is normalised to the connect wire shape:

```ts
{ accounts: [{ index: 0, address: 'Mx…', balance: '0' }] }
```

`TOTEM_VERIFY` returns the canonical sign-in response plus a session:

```ts
{
  verified: true,
  verificationId: 'verify-…',
  address: 'Mx…',
  message: 'https://example.com wants you to sign in…',
  signature: '0x…',
  publicKey: '…',
  expiresAt: 1718540700000,
  sessionToken: '…',
  sessionExpiresAt: 1718540700000,
}
```

Unsupported/unknown methods return `{ success: false, error, errorCode }` (e.g.
`UNSUPPORTED`, `APPROVAL_REQUIRED`, `USER_REJECTED`, `ORIGIN_REQUIRED`,
`ADDRESS_NOT_AUTHORIZED`, `SITE_NOT_CONNECTED`) — they never throw.

## Events

`this.emit(event, ...args)` pushes to dApp listeners. The adapter emits
`connect`, `disconnect`, `accountsChanged` and `chainChanged`.

## Testing without a browser

```ts
const wallet = new MyWallet({
  walletInfo: { id: 'test', name: 'Test' },
  approve: async () => true,
  allowUntrustedOrigin: true, // tests only
});

await wallet.handleRequest('TOTEM_CONNECT', { origin: 'https://example.com' });
const accounts = await wallet.handleRequest('TOTEM_GET_ACCOUNTS', { origin: 'https://example.com' });
```

## Lifecycle

```ts
wallet.inject();    // fires totem:announce, listens for totem:requestAnnounce
wallet.destroy();   // removes listener, clears connected sites and listeners
wallet.inject();    // safe to re-inject
```


## Testing

Tests live outside the published package in `tests/unit/wallet-adapter/`. Package `test:*` scripts are repository delegates.

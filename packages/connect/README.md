# @totemsdk/connect

**The dApp gateway — everything a web app needs to talk to the Totem wallet extension.**

`@totemsdk/connect` is the programmatic API surface for the Totem browser extension. It covers wallet connection, WOTS signature auth, full transaction building, Omnia payment channels, statechain transfers, KISSVM simulation, and an AI agent payment layer.

> **Note:** Every function that requires user interaction takes an `origin` string as its first argument (e.g. `'https://my-dapp.example.com'`). The extension uses this to display the requesting site to the user.

## Install

```bash
npm install @totemsdk/connect
```

No bundler configuration needed — ships as ESM, works in any modern browser.

## What's inside

### Core wallet

| Export | Signature |
|--------|-----------|
| `isTotemInstalled()` | `() → boolean` |
| `getProvider()` | `() → TotemProvider` |
| `connect(origin)` | `(origin: string) → Promise<TotemConnectResponse>` |
| `verify(origin, challenge?)` | `(origin, { statement?, nonce?, expiryMs? }?) → Promise<TotemVerifyResponse>` |
| `requestSignature` | alias for `verify` |
| `getAccounts(origin)` | `(origin: string) → Promise<TotemGetAccountsResponse>` |
| `sendTransaction(origin, request)` | `(origin, { address, amount, tokenid, ... }) → Promise<TotemSendTransactionResponse>` |
| `sendComplex(origin, buildParams)` | `(origin, EnhancedBuildParams, ...) → Promise<...>` |
| `signData(origin, params)` | `(origin, { data, address? }) → Promise<TotemSignDataResponse>` |
| `broadcastHex(origin, params)` | `(origin, { hex }) → Promise<TotemBroadcastHexResponse>` |
| `getCapabilities()` | `() → Promise<TotemGetCapabilitiesResponse>` |
| `getProviderStatus()` | `() → Promise<TotemGetProviderStatusResponse>` |

### Permissions

| Export | Signature |
|--------|-----------|
| `grantTxPermission(origin, config)` | `(origin, { allowedIntents, limits, expiryMs }) → Promise<...>` |
| `revokeTxPermission(origin)` | `(origin: string) → Promise<...>` |
| `getTxPermissions()` | `() → Promise<TotemGetTxPermissionsResponse>` |

### WOTS key management

| Export | Signature |
|--------|-----------|
| `getWotsStatus(params?)` | `({ address? }?) → Promise<TotemGetWotsStatusResponse>` |
| `reserveWotsLease(params?)` | `({ addressIndex?, count? }?) → Promise<TotemReserveWotsLeaseResponse>` |
| `releaseWotsLease(params)` | `({ leaseId: string }) → Promise<TotemReleaseWotsLeaseResponse>` |

### Transaction pipeline

| Export | Signature |
|--------|-----------|
| `signTransaction(origin, params)` | `(origin, { hex, addressIndex? }) → Promise<TotemSignTransactionResponse>` |
| `mineTxPoW(origin, params)` | `(origin, { hex, difficulty? }) → Promise<TotemMineTxPoWResponse>` |
| `broadcastTxPoW(origin, params)` | `(origin, { hex }) → Promise<TotemBroadcastTxPoWResponse>` |

### Payment requests

| Export | Signature |
|--------|-----------|
| `createPaymentRequest(origin, params)` | `(origin, { amount, tokenId?, hashlock?, timelock? }) → Promise<...>` |
| `payPaymentRequest(origin, params)` | `(origin, { uri }) → Promise<...>` |

### Omnia payment channels

`omniaOpenChannel`, `omniaPay`, `omniaSettle`, `omniaCloseChannel`, `omniaGetChannels`, `omniaGetRoute`, `omniaPayMultiHop`, `omniaGetSwapRate`, `omniaCreateFactory`, `omniaOpenVirtualChannel`, `omniaCloseFactory`, `omniaSpliceIn`, `omniaSpliceOut` — all take `origin` as the first argument.

### Statechain

`statechainCreate`, `statechainTransfer`, `statechainClaim`, `statechainVerify` — all take `origin` as the first argument.

### KISSVM scripting

| Export | Signature |
|--------|-----------|
| `kissvmSimulate(params)` | `({ script, txContext, witness? }) → Promise<TotemKissvmSimulateResponse>` |
| `kissvmValidate(script)` | `(script: string) → Promise<TotemKissvmValidateResponse>` |

### AI agent layer

| Export | Signature |
|--------|-----------|
| `agentProposePayment(origin, params)` | `(origin, { amount, recipient, intent?, ... }) → Promise<...>` |
| `agentExplainTransaction(origin, params)` | `(origin, { txpowId?, unsignedHex?, context? }) → Promise<...>` |
| `agentCreateReceipt(origin, params)` | `(origin, { txpowId, metadata? }) → Promise<...>` |

## Usage

### Connect and verify

```typescript
import { connect, verify, isTotemInstalled } from '@totemsdk/connect';

if (!isTotemInstalled()) {
  alert('Please install the Totem wallet extension');
}

const origin = 'https://my-dapp.example.com';

// 1. Request connection — prompts the user in the extension
const { address } = await connect(origin);
console.log('Connected:', address);

// 2. Authenticate with a WOTS challenge
const { verified, signature, publicKey } = await verify(origin, {
  statement: 'Sign in to MyDApp',
  expiryMs: 5 * 60 * 1000,
});
```

### Send a transaction

```typescript
import { sendTransaction, getCapabilities } from '@totemsdk/connect';

const origin = 'https://my-dapp.example.com';

const caps = await getCapabilities();
if (caps.wallet?.canSend) {
  const result = await sendTransaction(origin, {
    address: 'MxDEF456...',
    amount: '1.5',
    tokenid: '0x00',
  });
  console.log('TxPoW ID:', result.txpowid);
}
```

### Grant spending permission to an agent

```typescript
import { grantTxPermission } from '@totemsdk/connect';

const origin = 'https://my-dapp.example.com';

await grantTxPermission(origin, {
  allowedIntents: ['payment', 'swap'],
  limits: { '0x00': '100' }, // max 100 MIN
  expiryMs: 3_600_000,
});
```

### Full 3-step transaction pipeline

```typescript
import { signTransaction, mineTxPoW, broadcastTxPoW } from '@totemsdk/connect';

const origin = 'https://my-dapp.example.com';

const { hex: signedHex } = await signTransaction(origin, { hex: unsignedTxHex });
const { hex: minedHex }  = await mineTxPoW(origin, { hex: signedHex });
const result             = await broadcastTxPoW(origin, { hex: minedHex });
console.log('TxPoW ID:', result.txpowid);
```

## Error types

| Export | Description |
|--------|-------------|
| `TotemNotInstalledError` | Extension is not installed |
| `TotemConnectionError` | Connection was rejected or failed |

## See also

- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — cryptographic primitives
- [`@totemsdk/tx-builder`](https://www.npmjs.com/package/@totemsdk/tx-builder) — `EnhancedBuildParams` used by `sendComplex`
- [`@totemsdk/omnia`](https://www.npmjs.com/package/@totemsdk/omnia) — payment channel state machine
- [`@totemsdk/statechain`](https://www.npmjs.com/package/@totemsdk/statechain) — off-chain UTXO transfers
- [`@totemsdk/kissvm`](https://www.npmjs.com/package/@totemsdk/kissvm) — KISSVM script evaluator
- [`@totemsdk/agent-policy`](https://www.npmjs.com/package/@totemsdk/agent-policy) — AI agent payment contracts

# Totem Connect Protocol — Red Paper

**The dApp-wallet wire protocol for the Totem ecosystem. A formal specification for building compatible wallets, dApps, and tooling on the Minima network.**

**Version:** 1.0
**Date:** 2026-07-27
**Status:** Active
**Supersedes:** `TOTEM_CONNECT.md` (all versions), `DAPP_BUILDER_GUIDE.md`, `TOTEM_CONNECT_SPEC.md`, `TOTEM_TX_SPEC.md`

---

## Table of Contents

1. [Protocol Overview](#1-protocol-overview)
2. [Transport Layer](#2-transport-layer)
3. [Connection Lifecycle](#3-connection-lifecycle)
4. [Core Wallet Methods](#4-core-wallet-methods)
5. [Transaction Methods](#5-transaction-methods)
6. [Permission System](#6-permission-system)
7. [Omnia Payment Channels](#7-omnia-payment-channels)
8. [Statechain Operations](#8-statechain-operations)
9. [KISSVM Scripting](#9-kissvm-scripting)
10. [QVAC Agent Layer](#10-qvac-agent-layer)
11. [WOTS Key Management](#11-wots-key-management)
12. [Chain Provider & Capabilities](#12-chain-provider--capabilities)
13. [Events](#13-events)
14. [Error Codes](#14-error-codes)
15. [Security Model](#15-security-model)
16. [Reference Implementation](#16-reference-implementation)

---

## 1. Protocol Overview

The Totem Connect Protocol defines the complete wire-level contract between decentralized applications (dApps) and Totem-compatible wallets on the Minima network. It specifies every method a wallet may expose, every parameter shape, every response shape, every error code, and the security invariants that govern all interactions.

### 1.1 Design Principles

- **The wallet is a signing provider, not a balance oracle.** The wallet signs transactions and proves ownership. dApps fetch chain state from their own infrastructure (Axia API, lookup node, PureMinima RPC).
- **Private keys never leave the wallet.** All signing happens client-side. The dApp receives only signed transactions and public keys.
- **Origin-based security.** Every dApp is identified by its browser origin. Permissions are scoped per-origin. Sensitive operations derive origin from the browser, not from dApp-supplied parameters.
- **Intent-based permissions.** dApps request specific intents (`send`, `multisig`, `htlc`, `sign_data`, etc.). The user grants or denies each intent. The wallet enforces these grants on every transaction.
- **QVAC-ready.** The protocol includes an AI agent seam that lets external inference engines propose actions without ever touching signing keys.

### 1.2 Method Taxonomy

The protocol defines **49 methods** across 8 domains:

| Domain | Methods | Description |
|--------|---------|-------------|
| **Core Wallet** | 13 | Connection, verification, accounts, disconnect, ownership proofs |
| **Transactions** | 4 | Simple send, complex send, sign data, broadcast hex |
| **Permissions** | 3 | Grant, revoke, query transaction permissions |
| **Omnia Channels** | 13 | Open, pay, settle, close, route, multi-hop, swap, factory, virtual channels, splice |
| **Statechain** | 4 | Create, transfer, claim, verify |
| **KISSVM** | 2 | Simulate, validate scripts |
| **QVAC Agent** | 3 | Propose payment, explain transaction, create receipt |
| **Infrastructure** | 7 | Capabilities, provider status, chain provider, WOTS status/lease, transaction status/receipt |

### 1.3 Message Format

All dApp-wallet communication uses a JSON-RPC-inspired message format over `window.postMessage` (browser) or equivalent transport:

**Request (dApp → Wallet):**
```typescript
{
  type: 'TOTEM_REQUEST';
  id: string;           // unique request ID for response correlation
  method: string;       // e.g. 'TOTEM_CONNECT', 'totem_omniaOpenChannel'
  params: Record<string, unknown>;
}
```

**Response (Wallet → dApp):**
```typescript
// Success
{
  type: 'TOTEM_RESPONSE';
  id: string;           // matches request ID
  ok: true;
  result: object;
}

// Error
{
  type: 'TOTEM_RESPONSE';
  id: string;
  ok: false;
  error: string;
  errorCode?: string;
}
```

**Event (Wallet → dApp):**
```typescript
{
  type: 'TOTEM_EVENT';
  eventName: string;    // 'accountsChanged', 'disconnect', 'connect'
  data: unknown;
}
```

### 1.4 Method Naming Convention

- **Core wallet methods** use `TOTEM_` prefix with UPPER_SNAKE_CASE: `TOTEM_CONNECT`, `TOTEM_VERIFY`, `TOTEM_SEND_TRANSACTION`
- **Extended methods** use `totem_` prefix with camelCase: `totem_omniaOpenChannel`, `totem_kissvmSimulate`, `totem_getCapabilities`

### 1.5 Reference Implementation

The canonical client-side implementation is `@totemsdk/connect` (npm). The canonical server-side implementation is the Totem Browser Extension (Chrome MV3). Both are in the [Totem SDK monorepo](https://github.com/Totem-Edge/totem-sdk).

---

## 2. Transport Layer

### 2.1 Browser Extension Transport

In browser environments, the Totem extension uses a content script relay:

```
dApp page ──window.postMessage──→ content-script ──chrome.runtime.sendMessage──→ background service worker
                                                                                        │
                                                                                isDAppSender(sender)?
                                                                                DAPP_ALLOWED_METHODS.has(method)?
                                                                                        │
                                                                                ┌───────┴──────────┐
                                                                                │  Handle & Respond │
                                                                                └──────────────────┘
```

**Content script gates:**
- **`ALLOWED_DAPP_METHODS`**: Only methods in this set are forwarded from dApp pages to the background. Currently 13 methods.
- **`ALLOWED_DAPP_EVENTS`**: Only events in this set are forwarded from background to dApp pages. Currently 3 events.

**Intentionally excluded from dApp access:**
- `TOTEM_CONNECT_APPROVE` — internal extension-only, used by popup UI
- `TOTEM_GET_WALLET_MODE` — removed in v4.2.0; all wallets use unified hierarchical key scheme
- `walletModeChanged` event — removed; wallet mode no longer exists
- `balanceChanged` event — internal wallet-UI event; dApps must use Axia API for balance data

### 2.2 Origin Handling

The protocol uses two origin derivation strategies depending on the security requirements of the method:

**Trust-based origin** (used by connection, verification, and transaction methods):
The dApp supplies `origin` in `params`. The content script sets this to `window.location.origin` before forwarding, preventing spoofing at the page level. The background handler trusts the content script's value.

**Browser-verified origin** (used by permission and coin-query methods):
The background handler derives origin from `sender.tab.url` (a browser-verified value that cannot be spoofed by the dApp). The `params.origin` field is ignored for these methods.

| Method | Origin Source |
|--------|--------------|
| `TOTEM_CONNECT` | Trust-based (`params.origin`) |
| `TOTEM_VERIFY` | Trust-based |
| `TOTEM_GET_ACCOUNTS` | Trust-based |
| `TOTEM_DISCONNECT` | Hybrid (`params.origin` \|\| `sender.tab.url`) |
| `TOTEM_SEND_TRANSACTION` | Trust-based |
| `TOTEM_SEND_COMPLEX` | Trust-based |
| `TOTEM_SIGN_DATA` | Trust-based |
| `TOTEM_BROADCAST_HEX` | Trust-based |
| `TOTEM_PROVE_OWNERSHIP` | Trust-based |
| `TOTEM_GRANT_TX_PERMISSION` | Browser-verified (`sender.tab.url`) |
| `TOTEM_REVOKE_TX_PERMISSION` | Browser-verified |
| `TOTEM_GET_TX_PERMISSIONS` | Browser-verified |
| `TOTEM_GET_COINS` | Browser-verified |

---

## 3. Connection Lifecycle

### 3.1 Connection Flow

```
dApp                                    Wallet
 │                                        │
 │── TOTEM_CONNECT { origin } ──────────→│
 │                                        │── Check: wallet unlocked?
 │                                        │── Check: site already connected?
 │                                        │── If reconnect: return immediately
 │                                        │── If new: show address picker popup
 │←── { connected, address, publicKey } ─│
 │                                        │
 │── TOTEM_VERIFY { origin, challenge } ─→│
 │                                        │── Build SIWE challenge
 │                                        │── Show approval popup
 │                                        │── Sign with WOTS (auth key index 63)
 │←── { verified, signature, publicKey } │
 │                                        │
 │── ... dApp operations ... ────────────→│
 │                                        │
 │── TOTEM_DISCONNECT { origin } ────────→│
 │←── { success: true } ─────────────────│
 │←── accountsChanged event (empty []) ──│
```

### 3.2 Session Management

After `TOTEM_VERIFY`, the wallet may issue a session token. Subsequent connections within the token's TTL skip re-verification. The session token contract:

- **TTL:** 24 hours
- **Max lifetime:** 7 days (refreshable)
- **Scope:** Single origin
- **Storage:** Client-side only

### 3.3 Reserved Auth Address

Address index `63` (`TOTEM_AUTH_ADDRESS_INDEX`) is permanently reserved for `TOTEM_VERIFY` authentication signing. It never holds funds and is never used for transaction signing. A guard in the transaction signing path rejects any attempt to use index 63 for send operations. This ensures repeated logins consume leaves from the auth key pool without eroding spending capacity.

---

## 4. Core Wallet Methods

### 4.1 `TOTEM_CONNECT`

Request a wallet connection. The user selects which address to share.

**Request:**
```typescript
{
  method: 'TOTEM_CONNECT';
  params: {
    origin: string;   // dApp origin, e.g. 'https://my-dapp.example.com'
  }
}
```

**Success Response:**
```typescript
{
  connected: true;
  address: string;         // Mx-prefixed Minima address
  addressIndex: number;    // 0-63
  publicKey: string | null; // hex-encoded per-address TreeKey root public key
  isReconnect?: true;      // present only on reconnect (site was already connected)
}
```

**Error Responses:**
| Error | Condition |
|-------|-----------|
| `Origin is required` | `origin` is missing or empty |
| `Wallet is locked` | Wallet is locked; user must unlock first |
| `Wallet not initialized` | No wallet exists; user must create or import |
| `User rejected connection` | User dismissed the connection popup |
| `Address index N not found` | Selected address index does not exist in wallet |

### 4.2 `TOTEM_VERIFY`

Sign-In With Wallet (SIWE). Prove ownership of the connected address by signing a challenge. Uses the reserved auth key (index 63).

**Request:**
```typescript
{
  method: 'TOTEM_VERIFY';
  params: {
    origin: string;
    challenge?: {
      statement?: string;   // human-readable sign-in statement
      nonce?: string;       // dApp-provided nonce for replay protection
      expiryMs?: number;    // challenge expiry in milliseconds
    };
  }
}
```

**Success Response:**
```typescript
{
  verified: true;
  verificationId: string;    // "verify-{timestamp}-{randomHex}"
  address: string;           // Mx-prefixed
  message: string;           // the full challenge message that was signed
  signature: string;         // "0x"-prefixed hex of serialized TreeSignature
  publicKey: string;         // "0x"-prefixed hex of per-address TreeKey root
  expiresAt: number;         // unix ms
  rootPublicKey?: string;    // global root public key, if available
  sessionToken?: string;     // opaque session token for skip-reverify
  sessionExpiresAt?: number; // unix ms
}
```

**Error Responses:**
| Error | Condition |
|-------|-----------|
| `Origin is required` | `origin` is missing |
| `Wallet is locked` | Wallet is locked |
| `Site not connected. Call TOTEM_CONNECT first.` | No active connection for this origin |
| `Site does not have verification permission` | Connection exists but `canVerify` is false |
| `Connected address not found in wallet` | Address was removed after connection |
| `Per-address TreeKey not available` | Wallet locked during signing |
| `No available signing indices for this address (exhausted)` | All 262,144 auth keys used |
| `User rejected verification request` | User dismissed the popup |
| `Challenge expired` | Challenge TTL exceeded |

### 4.3 `TOTEM_GET_ACCOUNTS`

Get the connected account for the requesting origin. **Balance is intentionally excluded** — the wallet is a signing provider, not a balance oracle. dApps must fetch balances from their own chain data source.

**Request:**
```typescript
{
  method: 'TOTEM_GET_ACCOUNTS';
  params: {
    origin: string;
  }
}
```

**Success Response:**
```typescript
{
  accounts: [{
    index: number;           // 0-63
    address: string;         // Mx-prefixed
    chainId: string;         // TOTEM_CHAIN_ID constant
    addressType: 'standard'; // always 'standard'
    capabilities: [];        // reserved for future use
  }]
}
```

**Error Responses:**
| Error | Condition |
|-------|-----------|
| `Origin is required` | `origin` is missing |
| `Wallet not initialized` | No wallet exists |
| `Wallet is locked` | Wallet is locked |
| `Site not connected. Call TOTEM_CONNECT first.` | No active connection |
| `Connected account no longer exists in wallet` | Address was removed |

### 4.4 `TOTEM_DISCONNECT`

Disconnect the dApp from the wallet. Clears all permissions and triggers an `accountsChanged` event with an empty array.

**Request:**
```typescript
{
  method: 'TOTEM_DISCONNECT';
  params: {
    origin?: string;  // optional; falls back to browser-verified origin
  }
}
```

**Success Response:**
```typescript
{ success: true }
```

**Error Responses:**
| Error | Condition |
|-------|-----------|
| `Origin is required` | No origin available from params or browser |
| `Site not connected` | No active connection for this origin |

### 4.5 `TOTEM_PROVE_OWNERSHIP`

Prove ownership of child addresses derived from the wallet's root identity. Returns a cryptographic proof that the wallet controls the specified child indices.

**Request:**
```typescript
{
  method: 'TOTEM_PROVE_OWNERSHIP';
  params: {
    origin: string;
    childIndices: number[];  // non-empty array of non-negative integers
  }
}
```

**Success Response:**
```typescript
{
  // OwnershipProof object from walletManager.generateOwnershipProof()
  // Structure depends on root-identity implementation
}
```

**Error Responses:**
| Error | Condition |
|-------|-----------|
| `Origin is required` | `origin` is missing |
| `childIndices must be a non-empty array of numbers` | Invalid or empty indices |
| `Invalid child index: N` | Index out of valid range |
| `Wallet is locked` | Wallet is locked |
| `Site not connected. Call TOTEM_CONNECT first.` | No active connection |
| `Root identity not available` | Wallet locked or not initialized |
| `User rejected ownership proof request` | User dismissed the popup |

---

## 5. Transaction Methods

### 5.1 `TOTEM_SEND_TRANSACTION`

Send a simple payment. The wallet handles coin selection, transaction building, WOTS signing, TxPoW mining, and broadcast.

**Request:**
```typescript
{
  method: 'TOTEM_SEND_TRANSACTION';
  params: {
    origin: string;
    request: {
      version: 1;                    // must be 1
      intent?: DAppTransactionIntent; // defaults to 'send'
      outputs: Array<{
        address: string;              // Mx-prefixed recipient
        amount: string;               // decimal string, e.g. '1.5'
        tokenId?: string;             // defaults to '0x00' (native MINIMA)
      }>;
    };
  }
}
```

**Success Response:**
```typescript
{
  success: true;
  txpowid: string;     // transaction proof-of-work ID
  status: 'submitted';
}
```

**Error Responses:**
| Error | Error Code | Condition |
|-------|-----------|-----------|
| `Origin is required` | `INVALID_REQUEST` | `origin` missing |
| `Site not connected` | `SITE_NOT_CONNECTED` | No active connection |
| `Invalid transaction request` | `INVALID_REQUEST` | `request` is not an object |
| `Unsupported version: N. Expected 1` | `INVALID_REQUEST` | Wrong version |
| `outputs must be a non-empty array` | `INVALID_REQUEST` | No outputs |
| `outputs[i].address is required` | `INVALID_REQUEST` | Missing address |
| `outputs[i].amount is required` | `INVALID_REQUEST` | Missing amount |
| `Transaction permission required` | `PERMISSION_DENIED` | No permission grant; includes `requiresApproval`, `requestedIntent`, `requestedToken`, `requestedAmount` |
| `<reason>` | `PERMISSION_DENIED` | Permission exists but is insufficient |
| `Transaction rejected by user` | `USER_REJECTED` | User dismissed popup |
| `Connected address not found in wallet` | `BUILD_FAILED` | Address removed |
| `<wots error>` | `BUILD_FAILED` | Signing failure |

### 5.2 `TOTEM_SEND_COMPLEX`

Build and/or submit a complex transaction with full script descriptor support. Supports all 12 contract types: signedby, multisig, multisig_mofn, timelock, htlc, mast, exchange, vault, flashcash, slowcash, stateful, custom.

**Request:**
```typescript
{
  method: 'TOTEM_SEND_COMPLEX';
  params: {
    origin: string;
    buildParams: {
      inputs: Array<{
        coinId: string;
        address: string;
        amount: string;
        tokenId?: string;
        scriptDescriptor: {
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
        };
      }>;
      outputs: Array<{
        address: string;
        amount: string;
        tokenId?: string;
        state?: StateVariable[];
      }>;
      transactionState?: StateVariable[];
      linkHash?: string;
    };
    mode?: 'build' | 'submit';  // defaults to 'submit'
  }
}
```

**`ScriptType`:** `'signedby' | 'multisig' | 'multisig_mofn' | 'timelock' | 'htlc' | 'mast' | 'exchange' | 'vault' | 'flashcash' | 'slowcash' | 'stateful' | 'custom'`

**`StateVariable`:**
```typescript
{
  port: number;
  value: string;
  type?: 'number' | 'string' | 'hex' | 'bool';
}
```

**Build Mode Response (`mode: 'build'`):**
```typescript
{
  success: true;
  mode: 'build';
  unsignedHex: string;       // unsigned transaction hex
  digestTx: string;          // SHA3-256 digest of unsigned transaction
  plan: {
    inputs: Array<{ coinId: string; amount: string; tokenId: string; address: string }>;
    outputs: Array<{ address: string; amount: string; tokenId: string }>;
    change: { address: string; amount: string; tokenId: string } | null;
    fee: string | null;
  };
  inputCoinProofs: Array<{
    coinId: string;
    amount: string;
    tokenId: string;
    address: string;
    proof: object | null;
  }>;
  scriptDescriptors: Array<{
    scriptType: string;
    script: string;
    root?: string;
    branchScript?: string;
    proofPath?: string[];
    extraScripts?: string[];
    requiredSignatures?: number;
    totalSigners?: number;
    signerKeys?: string[];
  }>;
  chainId: string;
  blobHash: string;          // SHA3-256 of canonical {digestTx, sorted inputs} JSON
  detectedIntent: string;
  scriptTypes: string[];
}
```

**Submit Mode Response (`mode: 'submit'`):**
```typescript
{
  success: true;
  mode: 'submit';
  txpowid: string;
  status: 'submitted';
  detectedIntent: string;
  scriptTypes: string[];
  inputCount: number;
  outputCount: number;
}
```

**Intent Detection:**
| Script Type | Detected Intent |
|-------------|----------------|
| `multisig`, `multisig_mofn` | `multisig` |
| `htlc` | `htlc` |
| `exchange` | `swap` |
| `mast` | `contract_call` |
| anything else | `complex_send` |

**Error Responses:**
| Error | Error Code |
|-------|-----------|
| `Origin is required` | `INVALID_REQUEST` |
| `Wallet is locked` | `WALLET_LOCKED` |
| `Site not connected` | `SITE_NOT_CONNECTED` |
| `buildParams object required` | `INVALID_REQUEST` |
| `buildParams.inputs must be a non-empty array` | `INVALID_REQUEST` |
| `buildParams.outputs must be a non-empty array` | `INVALID_REQUEST` |
| `inputs[i] requires coinId, address, and amount` | `INVALID_REQUEST` |
| `inputs[i].scriptDescriptor requires scriptType and script` | `INVALID_REQUEST` |
| `outputs[i] requires address and amount` | `INVALID_REQUEST` |
| `Connected account not found` | `ACCOUNT_NOT_FOUND` |
| `None of the input addresses belong to the connected wallet` | `INPUT_OWNERSHIP_VIOLATION` |
| `Permission required for "X" transactions` | `PERMISSION_DENIED` |
| `Transaction rejected by user` | `USER_REJECTED` |
| `<build error>` | `BUILD_FAILED` |

### 5.3 `TOTEM_SIGN_DATA`

Sign a pre-built transaction without broadcasting. Used for multisig coordination where multiple parties must sign before broadcast. The dApp provides a `signingManifest` that cryptographically binds the transaction digest to its inputs.

**Request:**
```typescript
{
  method: 'TOTEM_SIGN_DATA';
  params: {
    origin: string;
    unsignedHex: string;         // hex-encoded unsigned transaction
    inputIndices?: number[];     // which inputs to sign (defaults to all wallet-owned)
    returnFormat?: 'hex' | 'json'; // defaults to 'hex'
    signingManifest: {
      blobHash: string;          // SHA3-256 of canonical {digestTx, sorted inputs} JSON
      digestTx: string;          // SHA3-256 of unsignedHex
      inputs: Array<{
        inputIndex: number;
        coinId: string;
        address: string;
        amount: string;
        tokenId: string;
      }>;
    };
  }
}
```

**Success Response:**
```typescript
{
  success: true;
  signedHex: string;         // hex-encoded signed transaction
  signatures: object[];      // array of SignatureProof objects
  signerAddress: string;     // Mx-prefixed
  signerIndex: number;
  inputsSigned: number[];    // which input indices were signed
  digestTx: string;          // SHA3-256 of unsignedHex (echoed for verification)
  status: 'signed';
}
```

**Signing Manifest Validation (all must pass):**
1. `unsignedHex` is valid hex (even length, valid characters)
2. `signingManifest` is an object with `blobHash`, `digestTx`, `inputs[]`
3. `blobHash` is a 64-hex-char SHA3-256 digest
4. `unsignedHex` parses as a valid Minima transaction
5. `digestTx` matches SHA3-256 of the hex bytes
6. `blobHash` matches SHA3-256 of canonical `{digestTx, sorted inputs}` JSON
7. Every manifest input matches the parsed transaction at the same index (coinId + address)
8. At least one input address belongs to the wallet

**Error Responses:**
| Error | Error Code |
|-------|-----------|
| `Origin is required` | `INVALID_REQUEST` |
| `Wallet is locked` | `WALLET_LOCKED` |
| `Site not connected` | `SITE_NOT_CONNECTED` |
| `Connected account not found` | `ACCOUNT_NOT_FOUND` |
| Various validation errors | `INVALID_HEX`, `MISSING_SIGNING_MANIFEST`, `INVALID_SIGNING_MANIFEST`, `DIGEST_MISMATCH`, `BLOB_HASH_MISMATCH`, `MANIFEST_INPUT_MISMATCH`, `INPUT_OWNERSHIP_VIOLATION` |
| `Signing permission required` | `PERMISSION_DENIED` |
| `Signing rejected by user` | `USER_REJECTED` |
| `<sign error>` | `SIGN_FAILED` |

### 5.4 `TOTEM_BROADCAST_HEX`

Broadcast a pre-signed transaction hex to the Minima network. The wallet does not validate the transaction beyond computing its digest for user preview.

**Request:**
```typescript
{
  method: 'TOTEM_BROADCAST_HEX';
  params: {
    origin: string;
    signedHex: string;           // hex-encoded signed transaction
    expectedDigestTx?: string;   // optional: warn if computed digest doesn't match
  }
}
```

**Success Response:**
```typescript
{
  success: true;
  txpowid: string;
}
```

**Error Responses:**
| Error | Error Code |
|-------|-----------|
| `Origin is required` | `INVALID_REQUEST` |
| `Wallet is locked` | `WALLET_LOCKED` |
| `Site not connected` | `SITE_NOT_CONNECTED` |
| `signedHex is required` | `INVALID_REQUEST` |
| `Permission required for broadcasting` | `PERMISSION_DENIED` |
| `Broadcast rejected by user` | `USER_REJECTED` |
| `<broadcast error>` | `BROADCAST_FAILED` |

---

## 6. Permission System

### 6.1 Intent Model

dApps request permission to execute specific transaction intents. The user grants or denies each intent. The wallet enforces these grants on every transaction.

**Available Intents:**
| Intent | Required By |
|--------|-------------|
| `send` | `TOTEM_SEND_TRANSACTION` (default) |
| `token_send` | `TOTEM_SEND_TRANSACTION` (default) |
| `utxo_read` | `TOTEM_GET_COINS` |
| `complex_send` | `TOTEM_SEND_COMPLEX` (fallback) |
| `multisig` | `TOTEM_SEND_COMPLEX` (detected from script type) |
| `htlc` | `TOTEM_SEND_COMPLEX` (detected) |
| `swap` | `TOTEM_SEND_COMPLEX` (detected) |
| `contract_call` | `TOTEM_SEND_COMPLEX` (detected) |
| `sign_data` | `TOTEM_SIGN_DATA` |
| `broadcast_tx` | `TOTEM_BROADCAST_HEX` |

### 6.2 `TOTEM_GRANT_TX_PERMISSION`

Grant transaction permissions to the dApp. **Origin is browser-verified** — the dApp cannot spoof its origin for this method.

**Request:**
```typescript
{
  method: 'TOTEM_GRANT_TX_PERMISSION';
  params: {
    config: {
      allowedIntents?: DAppTransactionIntent[];  // defaults to ['send', 'token_send']
      tokenLimits?: Array<{
        tokenId: string;
        tokenSymbol: string;
        maxAmountPerTx: string;    // decimal string
        maxDailyAmount: string;    // decimal string
      }>;
      expiresInDays?: number;      // defaults to 30
    };
  }
}
```

**Success Response:**
```typescript
{ success: true }
```

**Error Responses:**
| Error | Condition |
|-------|-----------|
| `Cannot determine caller origin` | Browser origin unavailable |
| `Config is required` | `config` is missing |
| `Permission request denied by user` | User dismissed popup |

### 6.3 `TOTEM_REVOKE_TX_PERMISSION`

Revoke all transaction permissions for the calling origin.

**Request:**
```typescript
{
  method: 'TOTEM_REVOKE_TX_PERMISSION';
  params: {}  // origin derived from browser, not params
}
```

**Success Response:**
```typescript
{ success: true }
```

### 6.4 `TOTEM_GET_TX_PERMISSIONS`

Query current transaction permissions. **Origin-scoped** — returns only the calling origin's permissions, not all connected sites.

**Request:**
```typescript
{
  method: 'TOTEM_GET_TX_PERMISSIONS';
  params: {}  // origin derived from browser
}
```

**Success Response:**
```typescript
[{
  origin: string;
  address: string;          // Mx-prefixed
  permissions: {
    grantedAt: number;      // unix ms
    expiresAt: number;      // unix ms
    allowedIntents: DAppTransactionIntent[];
    tokenLimits: Array<{
      tokenId: string;
      tokenSymbol: string;
      maxAmountPerTx: string;
      maxDailyAmount: string;
    }>;
    totalTransactions: number;
    lastTransactionAt?: number;
  };
}]
```

### 6.5 `TOTEM_GET_COINS`

Query spendable UTXOs. Requires `utxo_read` permission.

**Request:**
```typescript
{
  method: 'TOTEM_GET_COINS';
  params: {
    tokenId?: string;      // defaults to '0x00'
    address?: string;      // filter to specific address
    minAmount?: string;    // minimum coin amount
  }
}
```

**Success Response:**
```typescript
{
  success: true;
  coins: Array<{
    coinId: string;
    address: string;       // Mx-prefixed
    amount: string;
    tokenId: string;
    created: string;       // block number
  }>;
  totalCoins: number;
  queriedAddresses: number;
  tokenId: string;
}
```

---

## 7. Omnia Payment Channels

All Omnia methods use the `totem_` prefix and camelCase naming. Every method that modifies state requires `origin` as the first parameter.

### 7.1 `totem_omniaGetChannels`

List active payment channels.

**Request:**
```typescript
{
  method: 'totem_omniaGetChannels';
  params: {
    origin: string;
    tokenId?: string;
    status?: string;      // filter by channel status
  }
}
```

**Response:**
```typescript
{
  channels: Array<{
    channelId: string;
    status: string;          // 'opening' | 'active' | 'closing_mutual' | 'closing_unilateral' | 'disputing' | 'closed' | 'spliced'
    tokenId: string;
    totalValue: string;
    localBalance: string;
    remoteBalance: string;
    currentSequence: number;
  }>;
}
```

### 7.2 `totem_omniaOpenChannel`

Open a new eltoo payment channel with a remote party.

**Request:**
```typescript
{
  method: 'totem_omniaOpenChannel';
  params: {
    origin: string;
    remotePartyId: string;     // remote party's public key or identity
    localAmount: string;       // decimal string
    remoteAmount: string;      // decimal string
    tokenId?: string;          // defaults to '0x00'
    fundingCoinId: string;     // coin to fund the channel from
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  channelId?: string;
  fundingTxId?: string;
  error?: string;
  errorCode?: string;
}
```

### 7.3 `totem_omniaPay`

Make a payment within an existing channel.

**Request:**
```typescript
{
  method: 'totem_omniaPay';
  params: {
    origin: string;
    channelId: string;
    amount: string;        // decimal string
    tokenId?: string;
    memo?: string;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  channelId?: string;
  sequence?: number;         // new channel sequence number
  localBalance?: string;
  remoteBalance?: string;
  error?: string;
  errorCode?: string;
}
```

### 7.4 `totem_omniaSettle`

Settle a channel cooperatively.

**Request:**
```typescript
{
  method: 'totem_omniaSettle';
  params: {
    origin: string;
    channelId: string;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  channelId?: string;
  settlementTxId?: string;
  finalBalances?: Record<string, string>;
  error?: string;
  errorCode?: string;
}
```

### 7.5 `totem_omniaCloseChannel`

Close a channel, cooperatively or forcefully.

**Request:**
```typescript
{
  method: 'totem_omniaCloseChannel';
  params: {
    origin: string;
    channelId: string;
    force?: boolean;      // force close (unilateral) if true
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  channelId?: string;
  closingTxId?: string;
  error?: string;
  errorCode?: string;
}
```

### 7.6 `totem_omniaGetRoute`

Find a multi-hop payment route through the channel network.

**Request:**
```typescript
{
  method: 'totem_omniaGetRoute';
  params: {
    origin: string;
    fromPartyId: string;
    toPartyId: string;
    amount: string;
    tokenId: string;
    targetTokenId?: string;    // for cross-token swaps
    maxHops?: number;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  route?: {
    hops: Array<RoutingHop | SwapHop>;
    totalFees: string;
    tokenIn: string;
    tokenOut: string;
    estimatedBlocks: number;
  };
  error?: string;
  errorCode?: string;
}
```

**`RoutingHop`:**
```typescript
{
  channelId: string;
  from: string;
  to: string;
  amount: string;
  tokenId: string;
  htlcId?: string;
}
```

**`SwapHop` (extends `RoutingHop`):**
```typescript
{
  channelId: string;
  from: string;
  to: string;
  amount: string;
  tokenId: string;
  htlcId?: string;
  isSwap: true;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  rate: string;
  inboundChannelId: string;
  outboundChannelId: string;
}
```

### 7.7 `totem_omniaPayMultiHop`

Execute a multi-hop payment along a pre-computed route.

**Request:**
```typescript
{
  method: 'totem_omniaPayMultiHop';
  params: {
    origin: string;
    route: Route;              // from omniaGetRoute
    hashlock: string;          // HTLC hashlock for atomicity
    timeoutBlocks?: number;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  preimage?: string;           // HTLC preimage on success
  settledHops?: string[];      // channel IDs that settled
  error?: string;
  errorCode?: string;
}
```

### 7.8 `totem_omniaGetSwapRate`

Query available cross-token swap rates from intermediary nodes.

**Request:**
```typescript
{
  method: 'totem_omniaGetSwapRate';
  params: {
    origin: string;
    tokenIn: string;
    tokenOut: string;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  announcements?: Array<{
    intermediaryPubKey: string;
    tokenIn: string;
    tokenOut: string;
    rate: string;
    inboundChannelId: string;
    outboundChannelId: string;
    maxAmountIn: string;
  }>;
  error?: string;
  errorCode?: string;
}
```

### 7.9 `totem_omniaCreateFactory`

Create an N-of-N channel factory. One on-chain UTXO backs multiple virtual channels.

**Request:**
```typescript
{
  method: 'totem_omniaCreateFactory';
  params: {
    origin: string;
    partyIds: string[];          // all participant public keys
    amounts: string[];           // corresponding funding amounts
    tokenId?: string;
    fundingCoinIds?: string[];   // coins to fund the factory
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  factoryId?: string;
  fundingTxId?: string;
  error?: string;
  errorCode?: string;
}
```

### 7.10 `totem_omniaOpenVirtualChannel`

Open a virtual channel between two participants within a factory.

**Request:**
```typescript
{
  method: 'totem_omniaOpenVirtualChannel';
  params: {
    origin: string;
    factoryId: string;
    remotePartyId: string;
    localAmount: string;
    remoteAmount: string;
    tokenId?: string;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  channelId?: string;
  error?: string;
  errorCode?: string;
}
```

### 7.11 `totem_omniaCloseFactory`

Close a channel factory and settle all virtual channels.

**Request:**
```typescript
{
  method: 'totem_omniaCloseFactory';
  params: {
    origin: string;
    factoryId: string;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  factoryId?: string;
  settlementTxId?: string;
  finalAllocations?: Record<string, string>;
  error?: string;
  errorCode?: string;
}
```

### 7.12 `totem_omniaSpliceIn`

Add funds to an active channel without closing it.

**Request:**
```typescript
{
  method: 'totem_omniaSpliceIn';
  params: {
    origin: string;
    channelId: string;
    newTotalValue: string;
    newBalances: Record<string, string>;
    additionalCoinId: string;    // coin providing the additional funds
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  channelId?: string;
  newTotalValue?: string;
  updatedChannelState?: string;
  spliceTxId?: string;
  error?: string;
  errorCode?: string;
}
```

### 7.13 `totem_omniaSpliceOut`

Withdraw funds from an active channel without closing it.

**Request:**
```typescript
{
  method: 'totem_omniaSpliceOut';
  params: {
    origin: string;
    channelId: string;
    newTotalValue: string;
    newBalances: Record<string, string>;
    withdrawAmount: string;
    withdrawAddress: string;     // Mx-prefixed on-chain address
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  channelId?: string;
  newTotalValue?: string;
  updatedChannelState?: string;
  spliceTxId?: string;
  error?: string;
  errorCode?: string;
}
```

---

## 8. Statechain Operations

### 8.1 `totem_statechainCreate`

Create a new statechain for off-chain UTXO ownership transfer.

**Request:**
```typescript
{
  method: 'totem_statechainCreate';
  params: {
    origin: string;
    coinId: string;
    ownerPublicKeyDigest: string;
    seEndpoint: string;          // Statechain Entity endpoint URL
    reclaimTimelock?: number;    // blocks until unilateral reclaim (default: 2016)
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  chainId?: string;
  lockingAddress?: string;
  lockTxId?: string;
  error?: string;
  errorCode?: string;
}
```

### 8.2 `totem_statechainTransfer`

Transfer statechain ownership to a new owner.

**Request:**
```typescript
{
  method: 'totem_statechainTransfer';
  params: {
    origin: string;
    chainId: string;
    newOwnerPublicKeyDigest: string;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  chainId?: string;
  transferRecord?: {
    from: string;
    to: string;
    fromPublicKeyDigest: string;
    toPublicKeyDigest: string;
    blindedSignature: string;    // SE blind co-signature
    ownerSignature: string;      // current owner's WOTS signature
    signedDigest: string;
    txBodyHex: string;
    txHex: string;
    timestamp: number;
  };
  error?: string;
  errorCode?: string;
}
```

### 8.3 `totem_statechainClaim`

Claim a statechain UTXO on-chain.

**Request:**
```typescript
{
  method: 'totem_statechainClaim';
  params: {
    origin: string;
    chainId: string;
    claimAddress: string;        // Mx-prefixed on-chain address
    cooperative?: boolean;       // cooperative claim with SE co-signature
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  chainId?: string;
  txpowId?: string;
  cooperative?: boolean;
  error?: string;
  errorCode?: string;
}
```

### 8.4 `totem_statechainVerify`

Verify a statechain's transfer history off-chain.

**Request:**
```typescript
{
  method: 'totem_statechainVerify';
  params: {
    origin: string;
    chainId: string;
    transferHistory: StatechainTransferEntry[];  // full transfer chain
  }
}
```

**Response:**
```typescript
{
  valid: boolean;
  chainId: string;
  hopsVerified: number;      // number of transfers verified
  error?: string;
}
```

---

## 9. KISSVM Scripting

### 9.1 `totem_kissvmSimulate`

Simulate a KISSVM script against a transaction context. Returns pass/fail, execution trace, and instruction count.

**Request:**
```typescript
{
  method: 'totem_kissvmSimulate';
  params: {
    script: string;              // KISSVM script source
    txContext: {
      block: number;
      inputIndex: number;
      inputs: Array<{
        amount: number;
        tokenId: string;
        coinId: string;
        address: string;
        coinCreatedBlock?: number;
        scriptHash?: string;
      }>;
      outputs: Array<{
        address: string;
        amount: number;
        tokenId: string;
        keepState: boolean;
      }>;
      state: Record<number, string>;
      prevState: Record<number, string>;
      txDigest?: string;
      simulationMode?: boolean;
    };
    witness?: {
      signatures: Record<string, string>;
      preimages?: Record<string, string>;
    };
  }
}
```

**Response:**
```typescript
{
  passed: boolean;
  trace: string[];             // execution trace
  instructionsUsed: number;
  error?: string;
}
```

### 9.2 `totem_kissvmValidate`

Validate KISSVM script syntax without executing it.

**Request:**
```typescript
{
  method: 'totem_kissvmValidate';
  params: {
    script: string;
  }
}
```

**Response:**
```typescript
{
  valid: boolean;
  errors: Array<{
    message: string;
    line?: number;
    column?: number;
  }>;
}
```

---

## 10. QVAC Agent Layer

The QVAC (Query-Verify-Approve-Commit) agent layer is the seam between external AI inference engines and the wallet. QVAC agents propose actions; the wallet's agent policy evaluates and gates them. **QVAC never touches signing keys.**

### 10.1 `totem_agentProposePayment`

An AI agent proposes a payment. The wallet evaluates the proposal against its agent policy and returns approved, pending_user, or rejected.

**Request:**
```typescript
{
  method: 'totem_agentProposePayment';
  params: {
    origin: string;
    amount: string;
    tokenId?: string;
    recipient: string;          // Mx-prefixed
    intent?: string;            // e.g. 'subscription_renewal', 'api_call'
    context?: Record<string, unknown>;  // agent-provided context
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  proposalId?: string;
  status?: 'approved' | 'pending_user' | 'rejected';
  error?: string;
  errorCode?: string;
}
```

### 10.2 `totem_agentExplainTransaction`

Request a human-readable explanation of a transaction from the agent.

**Request:**
```typescript
{
  method: 'totem_agentExplainTransaction';
  params: {
    origin: string;
    txpowId?: string;            // explain a confirmed transaction
    unsignedHex?: string;        // or explain an unsigned transaction
    context?: Record<string, unknown>;
  }
}
```

**Response:**
```typescript
{
  explanation: string;
  riskLevel?: 'low' | 'medium' | 'high';
  warnings?: string[];
}
```

### 10.3 `totem_agentCreateReceipt`

Create a cryptographically linkable receipt for an agent-initiated transaction.

**Request:**
```typescript
{
  method: 'totem_agentCreateReceipt';
  params: {
    origin: string;
    txpowId: string;
    metadata?: Record<string, unknown>;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  receiptId?: string;
  receiptUri?: string;
  error?: string;
  errorCode?: string;
}
```

---

## 11. WOTS Key Management

### 11.1 `totem_getWotsStatus`

Query WOTS key usage for an address.

**Request:**
```typescript
{
  method: 'totem_getWotsStatus';
  params: {
    address?: string;        // Mx-prefixed
    addressIndex?: number;   // 0-63
  }
}
```

**Response:**
```typescript
{
  address: string;
  addressIndex: number;
  totalSlots: number;        // 262,144 per address
  usedSlots: number;
  availableSlots: number;
  nearExhaustion: boolean;   // true when < 1000 slots remain
}
```

### 11.2 `totem_reserveWotsLease`

Reserve WOTS signing indices for an upcoming transaction. Prevents double-use across concurrent operations.

**Request:**
```typescript
{
  method: 'totem_reserveWotsLease';
  params: {
    address?: string;
    addressIndex?: number;
    purpose?: string;        // human-readable purpose for the lease
    ttlMs?: number;          // lease time-to-live in milliseconds
  }
}
```

**Response:**
```typescript
{
  reservationId: string;
  addressIndex: number;
  l1: number;                // L1 index within per-address TreeKey
  l2: number;                // L2 leaf index
  expiresAt: number;         // unix ms
}
```

### 11.3 `totem_releaseWotsLease`

Release a previously reserved WOTS lease.

**Request:**
```typescript
{
  method: 'totem_releaseWotsLease';
  params: {
    reservationId: string;
    reason?: string;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  reservationId: string;
}
```

---

## 12. Chain Provider & Capabilities

### 12.1 `totem_getCapabilities`

Query the wallet's capabilities. dApps use this to determine which features are available before calling them.

**Request:**
```typescript
{
  method: 'totem_getCapabilities';
  params: {}  // no params
}
```

**Response:**
```typescript
{
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
```

### 12.2 `totem_getProviderStatus`

Query the wallet's current chain provider configuration.

**Request:**
```typescript
{
  method: 'totem_getProviderStatus';
  params: {}
}
```

**Response:**
```typescript
{
  providerType: 'hosted' | 'pure_rpc' | 'hybrid';
  network: string;
  relayAvailable: boolean;
  localMiningAvailable: boolean;
  pearRuntime: boolean;
  lookupLatencyMs: number | null;
}
```

### 12.3 `totem_setChainProvider`

Configure the wallet's chain data source.

**Request:**
```typescript
{
  method: 'totem_setChainProvider';
  params: {
    providerType: 'hosted' | 'pure_rpc' | 'hybrid';
    rpcEndpoint?: string;    // required for 'pure_rpc'
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  providerType: string;
}
```

### 12.4 `totem_signTransaction`

Sign a transaction without broadcasting (step 1 of the 3-step pipeline).

**Request:**
```typescript
{
  method: 'totem_signTransaction';
  params: {
    origin: string;
    unsignedHex: string;
    inputAddresses: string[];
    inputIndices?: number[];
    returnFormat?: 'hex' | 'json';
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  signedHex?: string;
  signatures?: object[];
  error?: string;
  errorCode?: string;
}
```

### 12.5 `totem_mineTxPoW`

Mine proof-of-work for a signed transaction (step 2 of the 3-step pipeline).

**Request:**
```typescript
{
  method: 'totem_mineTxPoW';
  params: {
    origin: string;
    signedHex: string;
    difficulty?: number;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  minedHex?: string;
  txpowId?: string;
  error?: string;
  errorCode?: string;
}
```

### 12.6 `totem_broadcastTxPoW`

Broadcast a mined transaction (step 3 of the 3-step pipeline).

**Request:**
```typescript
{
  method: 'totem_broadcastTxPoW';
  params: {
    origin: string;
    minedHex: string;
    expectedTxpowId?: string;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  txpowId?: string;
  status?: 'submitted';
  error?: string;
  errorCode?: string;
}
```

### 12.7 `totem_createPaymentRequest`

Create a payment request (Lightning-style invoice).

**Request:**
```typescript
{
  method: 'totem_createPaymentRequest';
  params: {
    origin: string;
    amount: string;
    tokenId?: string;
    description?: string;
    expiryMs?: number;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  requestId?: string;
  hashlock?: string;
  paymentUri?: string;
  expiresAt?: number;
  error?: string;
  errorCode?: string;
}
```

### 12.8 `totem_payPaymentRequest`

Pay a payment request.

**Request:**
```typescript
{
  method: 'totem_payPaymentRequest';
  params: {
    origin: string;
    paymentUri: string;
    maxFeePercent?: number;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  txpowId?: string;
  preimage?: string;
  status?: 'paid' | 'pending' | 'failed';
  error?: string;
  errorCode?: string;
}
```

### 12.9 `totem_getTransactionStatus`

Query the status of a broadcast transaction.

**Request:**
```typescript
{
  method: 'totem_getTransactionStatus';
  params: {
    txpowId: string;
  }
}
```

**Response:**
```typescript
{
  txpowId: string;
  status: 'pending' | 'confirmed' | 'failed' | 'unknown';
  blockNumber?: number;
  confirmedAt?: number;
}
```

### 12.10 `totem_getReceipt`

Get a transaction receipt.

**Request:**
```typescript
{
  method: 'totem_getReceipt';
  params: {
    txpowId: string;
  }
}
```

**Response:**
```typescript
{
  txpowId: string;
  amount: string;
  tokenId: string;
  from: string;
  to: string;
  timestamp: number;
  blockNumber?: number;
  description?: string;
}
```

---

## 13. Events

The wallet emits events to connected dApps. Events are forwarded through the content script relay and dispatched as `window.postMessage` with `type: 'TOTEM_EVENT'`.

### 13.1 Allowed Events

| Event | Payload | Description |
|-------|---------|-------------|
| `accountsChanged` | `string[]` | Connected accounts changed. Empty array on disconnect. |
| `disconnect` | `{ origin: string }` | Wallet initiated disconnect for the given origin. |
| `connect` | `{ address: string; chainId: string }` | New connection established. |

### 13.2 Intentionally Excluded Events

These events are internal to the wallet and must never reach dApp pages:

- `balanceChanged` — internal wallet-UI event. dApps must fetch balances from their own chain data source (Axia API, lookup node, PureMinima RPC).
- `walletModeChanged` — removed in v4.2.0. All wallets use the unified hierarchical key scheme; dApps need no mode re-gating.

---

## 14. Error Codes

All error responses include an `errorCode` string for programmatic handling.

| Error Code | Meaning | Typical Methods |
|-----------|---------|----------------|
| `INVALID_REQUEST` | Missing or malformed required parameter | All |
| `SITE_NOT_CONNECTED` | No active connection for this origin | Transaction methods |
| `WALLET_LOCKED` | Wallet is locked; user must unlock | All state-changing methods |
| `PERMISSION_DENIED` | Site lacks required transaction permission intent | Transaction methods |
| `USER_REJECTED` | User dismissed the approval popup | All user-facing methods |
| `BUILD_FAILED` | Transaction construction failed (coin selection, signing) | `TOTEM_SEND_TRANSACTION`, `TOTEM_SEND_COMPLEX` |
| `SIGN_FAILED` | WOTS signing failed | `TOTEM_SIGN_DATA` |
| `BROADCAST_FAILED` | Transaction broadcast failed | `TOTEM_BROADCAST_HEX` |
| `ACCOUNT_NOT_FOUND` | Connected address no longer exists in wallet | Account-dependent methods |
| `INPUT_OWNERSHIP_VIOLATION` | None of the input addresses belong to the wallet | `TOTEM_SEND_COMPLEX`, `TOTEM_SIGN_DATA` |
| `INVALID_HEX` | Hex string is malformed | `TOTEM_SIGN_DATA` |
| `MISSING_SIGNING_MANIFEST` | `signingManifest` is missing or not an object | `TOTEM_SIGN_DATA` |
| `INVALID_SIGNING_MANIFEST` | `signingManifest` is missing required fields | `TOTEM_SIGN_DATA` |
| `DIGEST_MISMATCH` | `digestTx` does not match SHA3-256 of `unsignedHex` | `TOTEM_SIGN_DATA` |
| `BLOB_HASH_MISMATCH` | `blobHash` does not match canonical JSON hash | `TOTEM_SIGN_DATA` |
| `MANIFEST_INPUT_MISMATCH` | Manifest input does not match parsed transaction input | `TOTEM_SIGN_DATA` |
| `INVALID_INDICES` | `childIndices` is not a valid array of numbers | `TOTEM_PROVE_OWNERSHIP` |
| `FETCH_FAILED` | Coin fetch from backend failed | `TOTEM_GET_COINS` |

---

## 15. Security Model

### 15.1 Private Key Confinement

**Private keys never leave the wallet.** All WOTS signing happens client-side within the wallet's execution context. The dApp receives only:
- Signed transaction hex
- Public keys (for verification)
- Signature proofs (for on-chain validation)

The wallet never exposes seed phrases, private keys, or unencrypted key material to any dApp.

### 15.2 Origin-Based Security

Every dApp is identified by its browser origin (`https://my-dapp.example.com`). The wallet enforces:

1. **Connection scoping:** Each origin has its own connection state, selected address, and permissions.
2. **Permission scoping:** Transaction permissions are granted per-origin. Origin A's permissions do not grant access to Origin B.
3. **Browser-verified origin for sensitive operations:** Permission grants, revocations, and coin queries derive origin from `sender.tab.url` (browser-verified), not from dApp-supplied `params.origin`.

### 15.3 Intent-Based Authorization

dApps cannot execute arbitrary transactions. They must:

1. Request specific intents (`send`, `multisig`, `htlc`, `sign_data`, etc.)
2. Receive user approval for each intent
3. Stay within token spending limits (per-transaction and daily caps)
4. Renew permissions periodically (default: 30-day expiry)

The wallet enforces these grants on every transaction. A dApp with `send` permission cannot execute a `multisig` transaction without additional approval.

### 15.4 Signing Manifest Validation

`TOTEM_SIGN_DATA` requires a `signingManifest` that cryptographically binds the transaction digest to its inputs. The wallet validates all 8 checks before signing. This prevents:

- **Blind signing:** The user sees exactly which inputs are being signed.
- **Digest substitution:** The `blobHash` binds `digestTx` to the canonical input set.
- **Input spoofing:** Every manifest input is verified against the parsed transaction.

### 15.5 WOTS Key Reuse Prevention

The wallet enforces single-use WOTS keys through:

- **Watermark tracking:** Per-address high-water mark prevents index reuse.
- **Lease coordination:** Atomic reservation prevents concurrent use of the same index.
- **Auth key isolation:** Address index 63 is permanently reserved for `TOTEM_VERIFY` and never used for transactions.

### 15.6 QVAC Key Sovereignty

QVAC agents propose actions but never hold signing keys. The agent policy layer is the chokepoint:

```
QVAC proposes → agent-policy evaluates → wallet signs → Minima settles
```

If the policy rejects a proposal, no transaction is built. The agent never sees private key material.

---

## 16. Reference Implementation

### 16.1 Client-Side SDK

**Package:** `@totemsdk/connect` (npm)
**Source:** [`packages/connect`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/connect)
**Version:** 2.1.0

The connect package provides typed convenience wrappers for all 49 protocol methods. It handles provider discovery, request/response correlation, and error normalization.

```typescript
import { connect, verify, sendTransaction } from '@totemsdk/connect';

const origin = 'https://my-dapp.example.com';
const { address } = await connect(origin);
const { verified } = await verify(origin);
const { txpowid } = await sendTransaction(origin, {
  version: 1,
  outputs: [{ address: 'MxDEF456...', amount: '1.5' }],
});
```

### 16.2 Server-Side Implementation

**Extension:** Totem Browser Extension (Chrome MV3)
**Source:** [`extensions/totem-extension`](https://github.com/Totem-Edge/totem-sdk/tree/main/extensions/totem-extension)

The extension implements the full protocol as a background service worker with a content script relay. It is the reference implementation for wallet builders.

### 16.3 Related Specifications

- [Core Yellow Paper](../TOTEM_CORE_YELLOW_PAPER.md) — WOTS+ parameters, TreeKey hierarchy, MMR proofs, serialization, lease/watermark coordination
- [Omnia Blue Paper](../TOTEM_OMNIA_BLUE_PAPER.md) — Eltoo payment channel protocol (forthcoming)
- [Governance Green Paper](../TOTEM_GOVERNANCE_GREEN_PAPER.md) — Recursive MAST, authority, quadratic voting (forthcoming)
- [Edge Grey Paper](../TOTEM_EDGE_GREY_PAPER.md) — Edge runtime, port injection, MachinePay (forthcoming)

---

*The Totem Connect Protocol. Build compatible wallets, dApps, and tooling from this specification alone.*

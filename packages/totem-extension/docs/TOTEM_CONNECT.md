# Totem Wallet — DApp Integration Reference

**Version:** 4.1.1
**Date:** 2026-05-05
**Status:** Production-Ready
**Supersedes:** `DAPP_BUILDER_GUIDE.md` v1.0.0, `TOTEM_CONNECT_SPEC.md` v2.6.0, `TOTEM_TX_SPEC.md` v2.3.0

This is the single canonical reference for building decentralized applications on the Minima network using the Totem Browser Extension. Everything a dApp developer needs — from first API call to multisig coordination — is in this document.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Quick Start](#2-quick-start)
3. [RPC Contract](#3-rpc-contract)
4. [Wallet Methods](#4-wallet-methods)
   - [4.1 TOTEM_CONNECT](#41-totem_connect)
   - [4.2 TOTEM_DISCONNECT](#42-totem_disconnect)
   - [4.3 TOTEM_VERIFY (Mandatory)](#43-totem_verify-mandatory)
   - [4.4 TOTEM_GET_ACCOUNTS](#44-totem_get_accounts)
   - [4.5 TOTEM_GET_COINS](#45-totem_get_coins)
   - [4.6 TOTEM_SEND_TRANSACTION](#46-totem_send_transaction)
   - [4.7 TOTEM_SEND_COMPLEX](#47-totem_send_complex)
   - [4.8 TOTEM_BROADCAST_HEX](#48-totem_broadcast_hex)
   - [4.9 TOTEM_SIGN_DATA](#49-totem_sign_data)
   - [4.10 TOTEM_GRANT_TX_PERMISSION](#410-totem_grant_tx_permission)
   - [4.11 TOTEM_REVOKE_TX_PERMISSION](#411-totem_revoke_tx_permission)
   - [4.12 TOTEM_GET_TX_PERMISSIONS](#412-totem_get_tx_permissions)
   - [4.13 TOTEM_GET_WALLET_MODE](#413-totem_get_wallet_mode)
   - [4.14 TOTEM_PROVE_OWNERSHIP](#414-totem_prove_ownership)
5. [Events](#5-events)
   - [5.1 accountsChanged](#51-accountschanged)
   - [5.2 Balance and UTXO Updates](#52-balance-and-utxo-updates)
6. [Convenience Wrappers](#6-convenience-wrappers)
7. [Permission and Intent System](#7-permission-and-intent-system)
8. [Security Model](#8-security-model)
9. [Transaction Internals](#9-transaction-internals)
10. [Token and NFT Sends](#10-token-and-nft-sends)
11. [Contract Types](#11-contract-types)
12. [ScriptDescriptor Reference](#12-scriptdescriptor-reference)
13. [Axia API Integration](#13-axia-api-integration)
14. [React Integration](#14-react-integration)
15. [Security Checklist](#15-security-checklist)
16. [Common Mistakes](#16-common-mistakes)
17. [Source File Reference](#17-source-file-reference)
18. [Related Documentation](#18-related-documentation)
19. [Version History](#19-version-history)

---

## 1. Overview

Every dApp on Minima uses two systems. Understanding the split between them is the most important concept in this guide.

```
┌─────────────────────────────────────────────────────┐
│                  YOUR DAPP (Browser)                │
│                                                     │
│  ┌──────────────┐            ┌───────────────────┐  │
│  │  Your UI     │            │  Wallet Provider  │  │
│  │  (React,Vue) │            │  (totem:announce) │  │
│  └──────┬───────┘            └────────┬──────────┘  │
│         │ fetch()                     │ request()   │
│         ▼                             ▼             │
│  ┌──────────────┐            ┌───────────────────┐  │
│  │  YOUR        │            │  TOTEM BROWSER    │  │
│  │  BACKEND     │            │  EXTENSION        │  │
│  └──────┬───────┘            └───────────────────┘  │
└─────────┼───────────────────────────────────────────┘
          │ HTTPS + API Key
          ▼
   ┌──────────────┐
   │  AXIA API    │
   │  api.axia.to │
   └──────────────┘
```

**Layer 1 — Axia API (Data):** Your backend calls `https://api.axia.to` with an API key. This gives you chain data: balances, transaction history, UTXO sets, price feeds. Read-only, no private keys. Your API key must stay on your server — never in client-side JavaScript.

**Layer 2 — Totem Wallet (Signing):** Your frontend obtains a wallet `provider` via `WalletDiscovery` from `@totemsdk/connect`. The Totem Browser Extension announces itself via the `totem:announce` CustomEvent. All signing happens inside the extension. Private keys never leave the browser.

**The key rule:** Data flows through your backend. Signatures flow through the wallet. Never cross these boundaries.

### Consent Principle (v4.1.1)

> **Totem is a consent and signing standard — not a data oracle.**

Totem exists to do one thing: obtain the user's informed consent before any cryptographic action is taken on their behalf. It proves address ownership (`TOTEM_VERIFY`), approves transactions (`TOTEM_SEND_*`), and signs data (`TOTEM_SIGN_DATA`). It is not responsible for providing chain data.

**Balances, UTXO sets, transaction history, portfolio values, and token metadata all come from the Axia API** (or your own indexer). Do not subscribe to wallet events to power balance displays. Do not use `TOTEM_GET_ACCOUNTS` as a polling mechanism for chain state. Totem's internal balance cache exists solely to support the wallet UI — it is not a documented API surface for dApps.

### What you do NOT need

- **The `totem-sdk` package** — that is a Node.js library for server-side custody operations. DApps use a wallet provider obtained via `WalletDiscovery`, not the server-side SDK.
- **Your own cryptography libraries** — the wallet handles coin selection, WOTS key management, change outputs, and byte-exact serialization.
- **Transaction proxying through your backend** — the extension signs and broadcasts directly. Your backend is never in the signing path.

---

## 2. Quick Start

### Detect the Extension

Wallets no longer write to `window.totem`. Instead, use `WalletDiscovery` from `@totemsdk/connect`:

```javascript
import { WalletDiscovery, setActiveProvider } from '@totemsdk/connect';

// Create a discovery instance. It immediately fires totem:requestAnnounce
// so already-loaded wallets re-announce. Subscribe to receive them.
const discovery = new WalletDiscovery();

discovery.onChange((wallets) => {
  if (wallets.length === 1) {
    // Exactly one wallet present — auto-select it
    setActiveProvider(wallets[0].provider);
    console.log('Wallet ready:', wallets[0].info.name);
  } else if (wallets.length > 1) {
    // Multiple wallets — show a picker and call setActiveProvider(chosen.provider)
  }
});

// Snapshot of already-announced wallets (non-empty if script loads after the wallet)
const current = discovery.getWallets();
```

For plain JavaScript (no SDK), you can use the event directly:

```javascript
const TOTEM_ANNOUNCE = 'totem:announce';
const TOTEM_REQUEST_ANNOUNCE = 'totem:requestAnnounce';
let provider = null;

window.addEventListener(TOTEM_ANNOUNCE, (event) => {
  provider = event.detail.provider;
  onWalletReady(provider);
});

window.dispatchEvent(new CustomEvent(TOTEM_REQUEST_ANNOUNCE));
```

### The Mandatory Onboarding Sequence

```
1. Detect      →  Listen for totem:announce (WalletDiscovery) to obtain provider
2. Onboard     →  TOTEM_CONNECT + (session check) + TOTEM_VERIFY (if needed)
                  ├─ TOTEM_CONNECT: user picks address in popup
                  ├─ GET /api/auth/session: check for existing server session
                  │   ├─ valid session for same address → skip TOTEM_VERIFY entirely
                  │   └─ no valid session → POST /api/auth/refresh
                  │       ├─ refresh ok (within 7-day max-lifetime) → skip TOTEM_VERIFY
                  │       └─ refresh fail → TOTEM_VERIFY (signs one WOTS leaf from spend address)
                  └─ TOTEM_VERIFY (only when no valid session): wallet signs challenge
3. Accounts    →  TOTEM_GET_ACCOUNTS (retrieve connected wallet address and account metadata)
                  └─ Fetch balance/portfolio from your backend → Axia API (not from Totem)
4. Transact    →  TOTEM_SEND_TRANSACTION or TOTEM_SEND_COMPLEX
5. Disconnect  →  TOTEM_DISCONNECT (end session when done)
```

> **WOTS leaf conservation:** On a first visit (or after session expiry), TOTEM_VERIFY consumes exactly one WOTS leaf from the **connected spend address's** per-address TreeKey (v4.1 — there is no reserved auth-key slot). On all subsequent page loads within the 24-hour session TTL, the session check short-circuits and no leaf is consumed. See §4.3.1 for the full session token contract.

For advanced dApps that need contract interactions:

```
4a. Read UTXOs    →  TOTEM_GET_COINS (query spendable coins)
4b. Complex Tx    →  TOTEM_SEND_COMPLEX (MAST, multisig, HTLC, exchange, vault…)
4c. Build Only    →  TOTEM_SEND_COMPLEX with mode='build' (unsigned blob for offline signing)
4d. Partial Sign  →  TOTEM_SIGN_DATA (multisig coordination)
4e. Broadcast     →  TOTEM_BROADCAST_HEX (submit pre-signed transaction)
```

> **UX BEST PRACTICE — Connect and Verify are one step, not two.**
>
> `TOTEM_CONNECT` and `TOTEM_VERIFY` must always be called together as a single automatic sequence. When a user picks their address in the connect popup, they expect to be signed in — not to encounter a second popup they did not initiate. Call `TOTEM_VERIFY` immediately after `TOTEM_CONNECT` resolves, with no intermediate UI, no separate button, and no conditional logic between them. There are no known exceptions to this pattern.

> **SECURITY WARNING — Verification is mandatory, not optional.**
>
> Minima addresses and public keys are publicly visible on-chain. Without `TOTEM_VERIFY`, any user could supply someone else's address during `TOTEM_CONNECT` and call `TOTEM_GET_ACCOUNTS` without proving they control the address. **Always call `TOTEM_VERIFY` immediately after `TOTEM_CONNECT` and before `TOTEM_GET_ACCOUNTS`.**

### Complete Working Example (plain JavaScript)

```javascript
// Step 0: Obtain the provider via totem:announce discovery
const TOTEM_ANNOUNCE = 'totem:announce';
const TOTEM_REQUEST_ANNOUNCE = 'totem:requestAnnounce';

function getProvider() {
  return new Promise((resolve, reject) => {
    const found = [];

    function onAnnounce(event) {
      const { info, provider } = event.detail ?? {};
      if (info?.id && provider) found.push({ info, provider });
    }

    window.addEventListener(TOTEM_ANNOUNCE, onAnnounce);
    window.dispatchEvent(new CustomEvent(TOTEM_REQUEST_ANNOUNCE));

    setTimeout(() => {
      window.removeEventListener(TOTEM_ANNOUNCE, onAnnounce);
      if (found.length > 0) resolve(found[0].provider);
      else reject(new Error('No Totem-compatible wallet detected. Please install the extension.'));
    }, 300);
  });
}

async function onboardUser() {
  const provider = await getProvider();

  // Step 1+2: Connect and verify as one atomic operation
  const connection = await provider.request({
    method: 'TOTEM_CONNECT',
    params: { origin: location.origin }
  });

  const verification = await provider.request({
    method: 'TOTEM_VERIFY',
    params: { origin: location.origin, challenge: { statement: 'Sign in to MyDApp' } }
  });

  // Send verification proof to your backend for server-side validation
  await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: verification.address,
      signature: verification.signature,
      publicKey: verification.publicKey,
      message: verification.message
    })
  });

  // Step 3: Now safe to load account metadata (address only — no balance oracle)
  const acct = await provider.request({
    method: 'TOTEM_GET_ACCOUNTS',
    params: { origin: location.origin }
  });
  const address = acct.accounts[0].address;

  // Step 4: Fetch balance/portfolio from your backend (Axia API), not from Totem
  const portfolio = await fetch(`/api/portfolio/${address}`).then(r => r.json());

  // Step 5: Listen for disconnects
  provider.on('accountsChanged', (accounts) => {
    if (accounts.length === 0) clearSession();
  });

  return { address, portfolio };
}
```

---

## 3. RPC Contract

### Request Format

All requests use `provider.request()`, where `provider` is the object received from the `totem:announce` CustomEvent (see §2 — use `WalletDiscovery` from `@totemsdk/connect` or listen for the event directly):

```typescript
interface TotemRequest {
  method: string;      // Method name (e.g., 'TOTEM_CONNECT')
  params?: object;     // Method-specific parameters
}

const result = await provider.request({
  method: 'TOTEM_CONNECT',
  params: { origin: window.location.origin }
});
```

### Response Handling

```javascript
try {
  const result = await provider.request({ method: 'TOTEM_CONNECT', params: { origin: location.origin } });
  // result is the unwrapped response object
} catch (error) {
  // Error is thrown with error.message set
  console.error('Failed:', error.message);
}
```

**Important:** Some methods (`TOTEM_SEND_TRANSACTION`, `TOTEM_GET_COINS`, `TOTEM_SEND_COMPLEX`, `TOTEM_SIGN_DATA`) include a `success` boolean within the result object even on non-thrown responses. Always check `result.success` for these methods rather than assuming success.

### Internal Envelope Format

You do not need to handle this directly. Internally all messages follow:

```typescript
// Success
{ ok: true, result: {...}, id: string }

// Error
{ ok: false, error: string, id: string }
```

### Origin Auto-Injection

The content script bridge automatically injects `origin: window.location.origin` into every request's params before forwarding to the background. This means:

- Passing `origin` in params explicitly is redundant but harmless and improves readability.
- Convenience wrappers (e.g., `provider.getCoins()`) work without an explicit `origin` param.
- The injected origin cannot be spoofed by the page — it is set by the content script from the actual tab origin.

### Allowed Methods

The following methods are forwarded from dApp pages through the content script bridge:

| Method | Category |
|--------|----------|
| `TOTEM_CONNECT` | Connection |
| `TOTEM_DISCONNECT` | Connection |
| `TOTEM_VERIFY` | Verification |
| `TOTEM_GET_ACCOUNTS` | Account Query |
| `TOTEM_GET_COINS` | UTXO Query |
| `TOTEM_SEND_TRANSACTION` | Simple Transaction |
| `TOTEM_SEND_COMPLEX` | Complex Transaction (build or submit) |
| `TOTEM_BROADCAST_HEX` | Broadcast pre-signed transaction |
| `TOTEM_SIGN_DATA` | Partial Signing |
| `TOTEM_GRANT_TX_PERMISSION` | Permission Management |
| `TOTEM_REVOKE_TX_PERMISSION` | Permission Management |
| `TOTEM_GET_TX_PERMISSIONS` | Permission Management |
| `TOTEM_GET_WALLET_MODE` | Root Identity |
| `TOTEM_PROVE_OWNERSHIP` | Root Identity |

> **Note:** `TOTEM_CONNECT_APPROVE` is an internal method used by the Totem Browser Extension's address picker popup. It is not forwarded to dApp pages and must never be called directly — use `TOTEM_CONNECT` instead.

---

## 4. Wallet Methods

### 4.1 TOTEM_CONNECT

Establishes a connection between a dApp and the user's wallet. For first-time connections, opens an address picker popup where the user selects which address to share. For returning sites, auto-reconnects to the previously selected address without a popup.

#### Request

```typescript
{
  method: 'TOTEM_CONNECT',
  params: {
    origin: string  // The dApp's origin (e.g., 'https://myapp.com')
  }
}
```

#### Response

```typescript
{
  connected: true,
  address: string,       // Minima address (Mx... format, always normalized)
  addressIndex: number,  // Wallet address index (0–63)
  isReconnect?: boolean  // true for returning sites
}
```

#### Errors (thrown)

| Error Message | Cause |
|---------------|-------|
| `Origin is required` | Missing origin parameter |
| `Wallet not initialized` | No wallet exists in extension |
| `User rejected connection` | User closed popup or clicked reject |

#### Best Practice — Always Treat Connect + Verify as a Single Atomic Step

> **`TOTEM_VERIFY` must always be called immediately and automatically after `TOTEM_CONNECT` succeeds — without any intermediate steps, user prompts, or conditional logic between them.**

There are **no known exceptions** to this pattern. Whether your dApp is a DEX, game, dashboard, or simple token viewer, the connect-then-verify sequence must function as a single seamless onboarding flow. Do not skip `TOTEM_VERIFY` for returning users (`isReconnect: true`) — verify every session, every time.

**Reference implementation:**

```javascript
async function connectAndVerify(statement = 'Sign in to this application') {
  // Step 1: Connect — user picks address
  const connection = await provider.request({
    method: 'TOTEM_CONNECT',
    params: { origin: window.location.origin }
  });

  // Step 2: Verify immediately — no gap, no extra button
  const verification = await provider.request({
    method: 'TOTEM_VERIFY',
    params: { origin: window.location.origin, challenge: { statement } }
  });

  return { connection, verification };
}

try {
  const { connection, verification } = await connectAndVerify('Sign in to MyDApp');
  // Now call TOTEM_GET_ACCOUNTS, render the UI, etc.
} catch (error) {
  // Either step rejected — user is not onboarded
  console.log('Onboarding failed:', error.message);
}
```

---

### 4.2 TOTEM_DISCONNECT

Programmatically ends the dApp's session with the wallet. Removes the site from the user's Connected Sites list and emits an `accountsChanged` event with an empty array to all open tabs for that origin.

No popup is shown — disconnect is a silent, instantaneous operation.

#### Request

```typescript
{
  method: 'TOTEM_DISCONNECT',
  params: {
    origin: string  // Auto-injected by content script
  }
}
```

#### Response (Success)

```typescript
{
  success: true
}
```

#### Errors (thrown)

| Error Message | errorCode | Cause |
|---------------|-----------|-------|
| `Origin is required` | — | Missing origin parameter |
| `Site not connected` | `SITE_NOT_CONNECTED` | Already disconnected or never connected |

#### Events Emitted on Success

After a successful disconnect, the wallet broadcasts `accountsChanged: []` to all open tabs for the disconnected origin. DApps should listen for this event to handle both programmatic disconnects and user-initiated disconnects from the extension settings:

```javascript
provider.on('accountsChanged', (accounts) => {
  if (accounts.length === 0) {
    setConnected(false);
    setAddress(null);
    router.push('/');
  }
});
```

#### Convenience Wrapper

```javascript
await provider.disconnect();
```

#### Example

```javascript
async function disconnectWallet() {
  try {
    await provider.disconnect();
    // UI cleanup happens via the accountsChanged event
  } catch (error) {
    if (error.message === 'Site not connected') {
      console.log('Already disconnected');
    }
  }
}
```

---

### 4.3 TOTEM_VERIFY (Mandatory)

Sign-In With Wallet (SIWE) — cryptographically proves address ownership by signing a challenge message with the **connected spend address's** per-address TreeKey. Shows a confirmation popup before signing. Each call consumes one WOTS leaf from the spend address's signing pool.

> **This step is mandatory.** Call `TOTEM_VERIFY` after `TOTEM_CONNECT` and before `TOTEM_GET_ACCOUNTS`. Skipping it is a critical security vulnerability.
>
> **WOTS efficiency:** To avoid consuming a leaf on every page load, use the three-phase session flow described in §4.3.1. TOTEM_VERIFY should only be called once per distinct login event; all subsequent page loads within the session TTL skip straight to TOTEM_GET_ACCOUNTS.

#### Signing Address

`TOTEM_VERIFY` signs from the same address the dApp connected to (`site.addressIndex`). The proof's `publicKey` field is therefore the spend address's root public key, and `deriveAddress(publicKey) === address` holds — backends can verify a proof with the `@totemsdk/core` one-liner:

```javascript
import { verifySignatureDetailed } from '@totemsdk/core';
const result = verifySignatureDetailed(address, message, signature, publicKey);
if (!result.valid) throw new Error(result.error);
```

Auth and spend leaves now share the per-address watermark (262,144 total signatures per address), so be mindful of leaf budget on long-running sessions and use §4.3.1's session tokens to avoid one signature per page load.

#### Request

```typescript
{
  method: 'TOTEM_VERIFY',
  params: {
    origin: string,
    challenge?: {
      statement?: string,   // Human-readable statement (e.g., "Sign in to MyApp")
      nonce?: string,       // Server-provided nonce (auto-generated if omitted)
      expiryMs?: number     // Validity in ms (default: 5 minutes = 300000)
    }
  }
}
```

#### Response (Success)

```typescript
{
  verified: true,
  verificationId: string,   // Unique ID for this verification
  address: string,          // Signing address (Mx... format, always normalized)
  message: string,          // Full EIP-4361 style challenge message
  signature: string,        // 0x-prefixed serialized TreeSignature hex (3 WOTS proofs)
  publicKey: string,        // 0x-prefixed spend-address root public key
  expiresAt: number,        // Unix timestamp (ms) when the signature expires
  sessionToken?: string,    // Server-issued session token (if backend returns one)
  sessionExpiresAt?: number // Unix timestamp (ms) when the session token expires
}
```

> **v4.1 (breaking from v4.0):** The proof now signs from the connected spend address. `verification.publicKey` is the spend address's root public key, so `deriveAddress(publicKey) === verification.address` holds and the high-level `verifySignatureDetailed(address, message, signature, publicKey)` one-liner now accepts every valid proof. The `authKeyIndex` field has been removed — there is no reserved auth-key slot. Servers built against the v4.0 contract must drop the `authKeyIndex === 63` check and switch from `verifyTreeSignatureDetailed` to `verifySignatureDetailed`.

#### User Approval Popup

Before signing, Totem displays a popup showing:
- Requesting site origin
- Challenge statement
- Expiry countdown timer
- Risk indicators (expired, non-HTTPS)
- WOTS leaf consumption warning (one leaf from the spend address's signing pool)
- Approve / Reject buttons

#### Errors (thrown)

| Error Message | Cause |
|---------------|-------|
| `Origin is required` | Missing origin parameter |
| `Site not connected. Call TOTEM_CONNECT first.` | Must connect before verifying |
| `Site does not have verification permission` | Permission not granted |
| `Connected address not found in wallet` | Address was removed from wallet |
| `User rejected verification request` | User clicked Reject or closed popup |
| `Challenge expired` | Challenge expired before or after approval |
| `Per-address TreeKey not available (wallet locked?)` | Wallet locked |
| `No available signing indices for this address (exhausted)` | The spend address's per-address TreeKey has used all 262,144 leaves (across both verify and tx signing). Rotate to a different address. |

#### Example

```javascript
const verification = await provider.request({
  method: 'TOTEM_VERIFY',
  params: {
    origin: window.location.origin,
    challenge: {
      statement: 'Sign in to MyDApp',
      nonce: crypto.randomUUID(), // Server-generated nonce recommended
      expiryMs: 300000
    }
  }
});

// Send to your backend for server-side verification + session token issuance
const res = await fetch('/api/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: verification.message,
    signature: verification.signature,
    publicKey: verification.publicKey,
    address: verification.address
  })
});
// Server sets HttpOnly cookie and returns { sessionToken, sessionExpiresAt }
```

---

#### §4.3.1 Session Token Contract

To avoid burning a WOTS leaf on every page load, the server issues a short-lived session token after the first successful `TOTEM_VERIFY`. Subsequent page loads within the token's TTL skip `TOTEM_VERIFY` entirely.

**Three-phase connect flow (recommended):**

```
1. TOTEM_CONNECT       → get user's address
2. GET /api/auth/session → check for live session matching that address
   ├─ valid session    → skip TOTEM_VERIFY, proceed to TOTEM_GET_ACCOUNTS
   └─ no session       → POST /api/auth/refresh (if within 7-day max-lifetime)
       ├─ refresh ok   → skip TOTEM_VERIFY, proceed to TOTEM_GET_ACCOUNTS
       └─ refresh fail → call TOTEM_VERIFY → POST /api/auth/verify → get token
3. TOTEM_GET_ACCOUNTS  → load account metadata
```

**Token format:** HMAC-SHA256 signed JWT-like structure

```
base64url({"alg":"HS256","typ":"JWT"}) + "." +
base64url({ address, origin, iat, exp, jti, type, maxLifetimeExp }) + "." +
HMAC-SHA256(header + "." + payload)
```

**Token claims:**

| Claim | Type | Description |
|-------|------|-------------|
| `address` | `string` | Wallet address that was verified |
| `origin` | `string` | dApp origin that requested verification |
| `iat` | `number` | Issued-at timestamp (Unix ms) |
| `exp` | `number` | Expiry timestamp (Unix ms); default TTL = 24 hours |
| `jti` | `string` | Unique token identifier (16 random bytes, hex) |
| `type` | `string` | Always `"session"` |
| `maxLifetimeExp` | `number` | Absolute max expiry (iat + 7 days); refresh rejected after this |

**Server endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/verify` | `POST` | Receives WOTS proof; validates; mints session token; sets HttpOnly cookie |
| `/api/auth/session` | `GET` | Returns `{ valid, address, expiresAt }` — no signing required |
| `/api/auth/refresh` | `POST` | Validates token is within max-lifetime; returns new token with reset TTL |

**Session cookie:** `totem_session` — HttpOnly, SameSite=Strict, Max-Age = session TTL

The session token is also returned in the response body (`sessionToken`, `sessionExpiresAt`) so non-browser dApp backends can store and reuse it.

**Reference implementation:** see `packages/totem-dapp-starter/server/index.js` and `packages/totem-dapp-starter/src/totem-context.jsx`.

---

### 4.4 TOTEM_GET_ACCOUNTS

Returns the connected account for the calling origin. Does not open any popup.

Call this after `TOTEM_VERIFY` to retrieve the user's connected address and account metadata. Use the returned `address` to fetch balance and portfolio data from the **Axia API** — not from Totem.

> **Do not use Totem as a balance oracle.** Totem does not expose a reliable, dApp-facing balance feed. The wallet's internal balance cache exists to power the Totem UI; it is not a documented API contract. For balance, UTXO, and portfolio data, call `GET /v1/{projectId}/portfolio/:address` on the Axia API through your backend.

#### Request

```typescript
{
  method: 'TOTEM_GET_ACCOUNTS',
  params: {
    origin: string
  }
}
```

#### Response (Success)

```typescript
{
  accounts: Array<{
    index: number,          // Account index (0–63)
    address: string,        // Minima address (Mx... format)
    chainId: string,        // 'minima-mainnet'
    addressType?: string,   // Address script type (e.g. 'signedby')
    capabilities?: string[] // Supported signing capabilities
  }>
}
```

Only one account is returned per connected site (the account the user selected during `TOTEM_CONNECT`).

#### Errors (thrown)

| Error Message | Cause |
|---------------|-------|
| `Origin is required` | Missing origin parameter |
| `Wallet not initialized` | No wallet has been created/imported |
| `Wallet is locked` | User needs to unlock the wallet |
| `Site not connected. Call TOTEM_CONNECT first.` | Site has not been connected |
| `Connected account no longer exists in wallet` | Previously connected account was removed |

#### Example

```javascript
// Get the connected address — then fetch balance from Axia API
const acct = await provider.request({
  method: 'TOTEM_GET_ACCOUNTS',
  params: { origin: window.location.origin }
});
const address = acct.accounts[0].address;

// Fetch balance and portfolio from your backend (which calls Axia API)
const portfolio = await fetch(`/api/portfolio/${address}`).then(r => r.json());
console.log('Balance:', portfolio.data.minimaBalance);
```

---

### 4.5 TOTEM_GET_COINS

A permissioned, wallet-mediated spendability query intended **only for transaction construction**. Returns the subset of the connected account's UTXOs that are immediately spendable, so a dApp can pass them as inputs to `TOTEM_SEND_COMPLEX`.

> **For balance display, analytics, or portfolio views, use the Axia API instead** (`GET /v1/{projectId}/portfolio/:address` or `POST /v1/{projectId}/indexer/utxos`). `TOTEM_GET_COINS` queries only the wallet's local UTXO view and should not be used as a general-purpose chain data source.

Query spendable UTXOs (coins) for the connected account. Essential for dApps that build custom transactions using `TOTEM_SEND_COMPLEX`.

**Requires the `utxo_read` permission intent.** Grant it via `TOTEM_GRANT_TX_PERMISSION` first.

#### Request

```typescript
{
  method: 'TOTEM_GET_COINS',
  params: {
    origin: string,
    tokenId?: string,    // Filter by token (default: '0x00' for Minima)
    address?: string,    // Filter by address (default: connected account address)
    minAmount?: string   // Only return coins with amount >= this value
  }
}
```

#### Response (Success)

```typescript
{
  success: true,
  coins: Array<{
    coinId: string,    // Unique coin identifier
    address: string,   // Address holding this coin (Mx... format, normalized)
    amount: string,    // Coin amount as string
    tokenId: string,   // Token ID
    created: string    // Block height when coin was created
  }>,
  totalCoins: number,
  queriedAddresses: number,
  tokenId: string
}
```

#### Response (Error)

```typescript
{
  success: false,
  error: string,
  errorCode: string,
  requiredIntent?: string  // 'utxo_read' if permission is missing
}
```

#### Error Codes

| errorCode | Cause |
|-----------|-------|
| `INVALID_REQUEST` | Missing origin parameter |
| `SITE_NOT_CONNECTED` | Must call TOTEM_CONNECT first |
| `PERMISSION_DENIED` | Missing `utxo_read` intent |
| `ACCOUNT_NOT_FOUND` | Connected account no longer exists |
| `FETCH_FAILED` | Network or internal error fetching coins |

#### Example

```javascript
async function getSpendableCoins(tokenId = '0x00') {
  const result = await provider.request({
    method: 'TOTEM_GET_COINS',
    params: { origin: window.location.origin, tokenId, minAmount: '0.001' }
  });

  if (result.success) {
    return result.coins;
  }
  if (result.errorCode === 'PERMISSION_DENIED') {
    await provider.request({
      method: 'TOTEM_GRANT_TX_PERMISSION',
      params: { origin: window.location.origin, config: { allowedIntents: ['utxo_read'] } }
    });
    return getSpendableCoins(tokenId);
  }
  throw new Error(result.error);
}
```

---

### 4.6 TOTEM_SEND_TRANSACTION

Request user approval to send Minima tokens. Shows a transaction approval popup. This is the simplest way to send tokens — for advanced contract interactions, use `TOTEM_SEND_COMPLEX`.

Transactions are built and signed entirely client-side using per-address TreeKeys.

#### Request

```typescript
{
  method: 'TOTEM_SEND_TRANSACTION',
  params: {
    origin: string,
    request: {
      version: 1,           // Protocol version (must be 1)
      intent?: string,      // Transaction intent (default: 'send')
      outputs: Array<{
        address: string,    // Recipient address
        amount: string,     // Amount as string (e.g., '1.5')
        tokenId?: string    // Token ID (default: '0x00' for Minima)
      }>
    }
  }
}
```

#### Response (Success)

```typescript
{
  success: true,
  txpowid: string,      // Transaction proof-of-work ID
  status: 'submitted'
}
```

#### Response (Error)

```typescript
{
  success: false,
  error: string,
  errorCode: string,
  requiresApproval?: boolean,
  requestedIntent?: string,
  requestedToken?: string,
  requestedAmount?: string
}
```

#### Error Codes

| errorCode | Cause |
|-----------|-------|
| `INVALID_REQUEST` | Missing/invalid parameters or unsupported version |
| `SITE_NOT_CONNECTED` | Must call TOTEM_CONNECT first |
| `PERMISSION_DENIED` | Transaction permission not granted, exceeds limits, or intent not allowed |
| `USER_REJECTED` | User rejected in approval popup |
| `BUILD_FAILED` | Transaction building or signing failed (address not found, insufficient funds, signing error) |

#### Example

```javascript
const result = await provider.request({
  method: 'TOTEM_SEND_TRANSACTION',
  params: {
    origin: window.location.origin,
    request: {
      version: 1,
      intent: 'send',
      outputs: [{ address: toAddress, amount: '1.5', tokenId: '0x00' }]
    }
  }
});

if (result.success) {
  console.log('Transaction submitted:', result.txpowid);
} else if (result.requiresApproval) {
  // Handle permission request flow
}
```

---

### 4.7 TOTEM_SEND_COMPLEX

Build and optionally submit advanced transactions using any of Minima's 13 contract types. Accepts `EnhancedBuildParams` with full `ScriptDescriptor` support.

**Requires the `complex_send` permission intent** (or a more specific detected intent — see Intent Detection below).

#### Modes

| Mode | Default | Behavior |
|------|---------|----------|
| `submit` | Yes | Builds, signs, and broadcasts. Returns `txpowid`. |
| `build` | No | Builds the unsigned transaction blob only. Returns `unsignedHex`, `digestTx`, `plan`, `inputCoinProofs`, `scriptDescriptors`, `chainId`, `blobHash`. **No WOTS keys consumed. No leases touched.** |

Both modes require the same permission grant. The approval popup shows "Build unsigned transaction" vs "Submit transaction" copy accordingly.

#### Intent Detection

The wallet automatically detects the transaction intent from the input `ScriptDescriptor`s:

| Input scriptType | Detected Intent |
|------------------|-----------------|
| `multisig`, `multisig_mofn` | `multisig` |
| `htlc` | `htlc` |
| `exchange` | `swap` |
| `mast` | `contract_call` |
| All others | `complex_send` |

Your granted intents must include either `complex_send` (catch-all) or the specific detected intent.

#### Input Ownership Validation

At least one input address must belong to the connected wallet. This prevents dApps from constructing transactions that only spend other users' coins.

#### Request

```typescript
{
  method: 'TOTEM_SEND_COMPLEX',
  params: {
    origin: string,
    mode?: 'build' | 'submit',
    buildParams: {
      inputs: Array<{
        coinId: string,
        address: string,
        amount: string,
        tokenId?: string,
        scriptDescriptor: {
          scriptType: ScriptType,
          script: string,
          wotsRootPublicKey?: string,
          mastProof?: object,
          extraScripts?: object,
          multisigKeys?: string[],
          multisigThreshold?: number,
          externalSignatures?: object[],
          htlcHash?: string,
          htlcPreimage?: string,
          timelockBlock?: bigint,
          stateVariables?: Array<{ port: number, value: string, type: 'number' | 'string' | 'hex' | 'bool' }>,
          verifyOutExpectations?: Array<{
            inputIndex: string,
            outputAddress: string,
            amount: string,
            tokenId: string,
            keepState: boolean
          }>,
          storeState?: boolean
        }
      }>,
      outputs: Array<{
        address: string,
        amount: string,
        tokenId?: string,
        state?: Array<{ port: number, value: string, type: 'number' | 'string' | 'hex' | 'bool' }>
      }>,
      transactionState?: Array<{ port: number, value: string, type: 'number' | 'string' | 'hex' | 'bool' }>,
      linkHash?: string
    }
  }
}
```

#### Supported ScriptType Values

| ScriptType | Contract Pattern |
|------------|-----------------|
| `signedby` | `RETURN SIGNEDBY(pubkey)` — standard wallet address |
| `multisig` | `RETURN SIGNEDBY(pk1) AND SIGNEDBY(pk2)` — 2-of-2 |
| `multisig_mofn` | `RETURN MULTISIG(M pk1 pk2 ...)` — M-of-N |
| `timelock` | `RETURN SIGNEDBY(pk) AND @BLOCK GT n` |
| `htlc` | Hashed Timelock Contract (claim or refund paths) |
| `mast` | `MAST 0x<ROOT_HASH>` — Merkelized Abstract Syntax Tree |
| `exchange` | DEX offer with VERIFYOUT assertions |
| `vault` | Cold/hot key covenant with safe house cooldown |
| `flashcash` | Flash loan with same-transaction repayment |
| `slowcash` | Rate-limited withdrawal |
| `stateful` | Multi-round state machine |
| `custom` | Arbitrary Minima script |
| `custom` (RETURN TRUE) | Trivial script — use `scriptType: 'custom'` with `script: 'RETURN TRUE'` |

#### Response — Submit Mode (Success)

```typescript
{
  success: true,
  mode: 'submit',
  txpowid: string,
  status: 'submitted',
  detectedIntent: string,
  scriptTypes: string[],
  inputCount: number,
  outputCount: number
}
```

#### Response — Build Mode (Success)

```typescript
{
  success: true,
  mode: 'build',
  unsignedHex: string,      // Serialized unsigned transaction (txnexport output)
  digestTx: string,         // SHA3-256 digest — this is what signers sign
  plan: {
    inputs: Array<{ coinId: string, amount: string, tokenId: string, address: string }>,
    outputs: Array<{ address: string, amount: string, tokenId: string }>,
    change: { address: string, amount: string, tokenId: string } | null,
    fee: string | null
  },
  inputCoinProofs: Array<{
    coinId: string,
    amount: string,
    tokenId: string,
    address: string,
    proof: object | null
  }>,
  scriptDescriptors: Array<{
    scriptType: string,
    script: string,
    root?: string,
    branchScript?: string,
    proofPath?: string[],
    extraScripts?: string[],
    requiredSignatures?: number,
    totalSigners?: number,
    signerKeys?: string[]
  }>,
  chainId: string,           // 'minima-mainnet'
  blobHash: string,          // SHA3-256 integrity checksum (see below)
  detectedIntent: string,
  scriptTypes: string[]
}
```

**blobHash computation:**

```
blobHash = sha3_256(canonical_json({
  unsignedHex,
  digestTx,
  inputCoinProofs,
  scriptDescriptors,
  chainId
}))
```

`canonical_json()` recursively sorts object keys at all nesting levels for deterministic output. Cold signers and coordinators must verify `blobHash` at every stage transition.

#### Response (Error)

```typescript
{
  success: false,
  error: string,
  errorCode: string,
  detectedIntent?: string,
  scriptTypes?: string[],
  requiredIntent?: string
}
```

#### Error Codes

| errorCode | Cause |
|-----------|-------|
| `INVALID_REQUEST` | Missing or invalid buildParams, inputs, outputs, or required fields |
| `SITE_NOT_CONNECTED` | Must call TOTEM_CONNECT first |
| `ACCOUNT_NOT_FOUND` | Connected account no longer exists |
| `INPUT_OWNERSHIP_VIOLATION` | None of the input addresses belong to the connected wallet |
| `PERMISSION_DENIED` | Missing required intent |
| `USER_REJECTED` | User rejected in approval popup |
| `BUILD_FAILED` | Transaction building or signing failed |

#### Example — Taking an Exchange Offer

```javascript
const result = await provider.request({
  method: 'TOTEM_SEND_COMPLEX',
  params: {
    origin: window.location.origin,
    buildParams: {
      inputs: [{
        coinId: offerCoin.coinId,
        address: offerCoin.address,
        amount: offerCoin.amount,
        scriptDescriptor: {
          scriptType: 'exchange',
          script: offerCoin.script,
          stateVariables: [
            { port: 0, value: offerCoin.ownerPK, type: 'hex' },
            { port: 1, value: myAddress, type: 'hex' },
            { port: 2, value: offerCoin.desiredAmount, type: 'number' },
            { port: 3, value: offerCoin.desiredToken, type: 'hex' }
          ],
          verifyOutExpectations: [{
            inputIndex: '@INPUT',
            outputAddress: myAddress,
            amount: offerCoin.desiredAmount,
            tokenId: offerCoin.desiredToken,
            keepState: true
          }],
          storeState: true
        }
      }],
      outputs: [{ address: myAddress, amount: offerCoin.desiredAmount, tokenId: offerCoin.desiredToken }]
    }
  }
});
```

#### Example — Build Mode for Multisig Coordination

```javascript
const blob = await provider.sendComplex({ inputs, outputs }, 'build');
if (blob.success) {
  console.log('Unsigned blob:', blob.unsignedHex.slice(0, 40) + '...');
  console.log('Digest to sign:', blob.digestTx);
  console.log('Blob integrity:', blob.blobHash);
}
```

---

### 4.8 TOTEM_BROADCAST_HEX

Broadcast a fully-signed transaction hex to the Minima network. Accepts a pre-signed blob (from `txnexport` or assembled from partial signatures) and submits via `txnimport → txncheck → txnpost`.

**Requires the `broadcast_tx` permission intent.**

> **Lease-Broadcast Guidance:** For multisig coordination with active Axia leases, the canonical broadcast path is the Axia `/broadcast` endpoint (with `leaseTokens[]` binding), which atomically flips leases to `USED`. If you use `TOTEM_BROADCAST_HEX` with active leases, you **must** also call Axia `/broadcast` idempotently afterward to mark leases as `USED`, or consumed leases will remain in `SIGNED` status permanently. For single-signer or non-lease transactions, `TOTEM_BROADCAST_HEX` is the simplest path.

#### Request

```typescript
{
  method: 'TOTEM_BROADCAST_HEX',
  params: {
    origin: string,
    signedHex: string,            // Fully-signed transaction hex
    expectedDigestTx?: string     // Optional: expected SHA3-256 digest for sanity check
  }
}
```

#### Response (Success)

```typescript
{
  success: true,
  txpowid: string
}
```

#### Response (Error)

```typescript
{
  success: false,
  error: string,
  errorCode: string,
  requiredIntent?: string
}
```

#### Error Codes

| errorCode | Cause |
|-----------|-------|
| `INVALID_REQUEST` | Missing origin or signedHex |
| `SITE_NOT_CONNECTED` | Must call TOTEM_CONNECT first |
| `PERMISSION_DENIED` | Missing `broadcast_tx` intent |
| `USER_REJECTED` | User rejected broadcast in approval popup |
| `BROADCAST_FAILED` | txnimport, txncheck, or txnpost failed |

The approval popup shows a digest preview (SHA3-256 of raw hex bytes, truncated), hex size, and the label "This transaction is already signed. Broadcasting will submit it to the network."

#### Convenience Wrapper

```javascript
const result = await provider.broadcastHex({ signedHex, expectedDigestTx: digestTx });
```

---

### 4.9 TOTEM_SIGN_DATA

Produce a partial WOTS signature over an unsigned transaction hex, without broadcasting. Designed for multisig coordination — each signer contributes their signature and a coordinator collects them all before broadcasting.

**Requires the `sign_data` permission intent.**

#### Anti-Blind-Signing Protection

`inputAddresses[]` is **mandatory**. The dApp must explicitly list which addresses the wallet should sign for. The wallet validates that at least one of the provided addresses belongs to the connected wallet, and the approval popup shows exactly which inputs will be signed.

#### Request

```typescript
{
  method: 'TOTEM_SIGN_DATA',
  params: {
    origin: string,
    unsignedHex: string,              // Hex-encoded unsigned transaction
    inputAddresses: string[],          // REQUIRED: addresses of inputs to sign
    inputIndices?: number[],           // Optional: specific input indices to sign
    returnFormat?: 'hex' | 'json'      // Signature format (default: 'hex')
  }
}
```

#### Response (Success)

```typescript
{
  success: true,
  signedHex: string,            // Hex-encoded signed transaction (partial)
  signatures: object[],         // Individual WOTS signatures produced
  signerAddress: string,        // Address that signed (Mx... format)
  signerIndex: number,          // Wallet address index of the signer
  inputsSigned: number[],       // Which input indices were signed
  status: 'signed'
}
```

#### Response (Error)

```typescript
{
  success: false,
  error: string,
  errorCode: string,
  requiredIntent?: string
}
```

#### Error Codes

| errorCode | Cause |
|-----------|-------|
| `INVALID_REQUEST` | Missing origin, unsignedHex, inputAddresses, or invalid hex |
| `SITE_NOT_CONNECTED` | Must call TOTEM_CONNECT first |
| `ACCOUNT_NOT_FOUND` | Connected account no longer exists |
| `INPUT_OWNERSHIP_VIOLATION` | None of the provided inputAddresses belong to this wallet |
| `PERMISSION_DENIED` | Missing `sign_data` intent |
| `USER_REJECTED` | User rejected in approval popup |
| `SIGN_FAILED` | Internal signing error |

#### Example — Multisig Coordination

```javascript
const result = await provider.request({
  method: 'TOTEM_SIGN_DATA',
  params: {
    origin: window.location.origin,
    unsignedHex: unsignedTxHex,
    inputAddresses: myAddresses,
    returnFormat: 'hex'
  }
});

if (result.success) {
  // Send partial signature to coordinator
  await fetch('/api/multisig/submit-signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signedHex: result.signedHex,
      signatures: result.signatures,
      signerAddress: result.signerAddress,
      signerIndex: result.signerIndex
    })
  });
}
```

---

### 4.10 TOTEM_GRANT_TX_PERMISSION

Grant pre-approved transaction permissions to a dApp. Controls which intents the dApp can initiate and optionally sets per-token spending limits.

Even with permissions granted, security-sensitive operations still show user approval popups.

#### Request

```typescript
{
  method: 'TOTEM_GRANT_TX_PERMISSION',
  params: {
    origin: string,
    config: {
      allowedIntents?: DAppTransactionIntent[],   // Default: ['send', 'token_send']
      tokenLimits?: Array<{
        tokenId: string,
        tokenSymbol: string,
        maxAmountPerTx: string,
        maxDailyAmount: string
      }>,
      expiresInDays?: number                       // Default: 30
    }
  }
}
```

#### Response

```typescript
{ success: boolean }
```

#### Example

```javascript
await provider.request({
  method: 'TOTEM_GRANT_TX_PERMISSION',
  params: {
    origin: window.location.origin,
    config: {
      allowedIntents: ['utxo_read', 'swap', 'complex_send', 'sign_data'],
      tokenLimits: [{
        tokenId: '0x00',
        tokenSymbol: 'MINIMA',
        maxAmountPerTx: '100',
        maxDailyAmount: '1000'
      }],
      expiresInDays: 7
    }
  }
});
```

---

### 4.11 TOTEM_REVOKE_TX_PERMISSION

Revoke all transaction permissions for a dApp.

#### Request

```typescript
{
  method: 'TOTEM_REVOKE_TX_PERMISSION',
  params: { origin: string }
}
```

#### Response

```typescript
{ success: boolean }
```

#### Example

```javascript
await provider.request({
  method: 'TOTEM_REVOKE_TX_PERMISSION',
  params: { origin: window.location.origin }
});
```

---

### 4.12 TOTEM_GET_TX_PERMISSIONS

Query all connected sites that have transaction permissions, along with their full permission details including daily usage.

#### Request

```typescript
{
  method: 'TOTEM_GET_TX_PERMISSIONS',
  params: {}
}
```

#### Response

```typescript
Array<{
  origin: string,
  address: string,
  permissions: {
    grantedAt: number,
    expiresAt: number,
    allowedIntents: DAppTransactionIntent[],
    tokenLimits: Array<{
      tokenId: string,
      tokenSymbol: string,
      maxAmountPerTx: string,
      maxDailyAmount: string,
      dailyUsed: string,
      lastResetDate: string
    }>,
    totalTransactions: number,
    lastTransactionAt?: number
  }
}>
```

#### Example

```javascript
const permissions = await provider.request({
  method: 'TOTEM_GET_TX_PERMISSIONS',
  params: {}
});

permissions.forEach(site => {
  console.log(`${site.origin}: intents=${site.permissions.allowedIntents.join(', ')}`);
  console.log(`  Expires: ${new Date(site.permissions.expiresAt).toLocaleDateString()}`);
  console.log(`  Total txs: ${site.permissions.totalTransactions}`);
});
```

---

### 4.13 TOTEM_GET_WALLET_MODE

Returns the current wallet mode for the connected origin without the extra round-trip that comes from a full re-connect. Resolves immediately from the background's in-memory state.

> **Prefer reading `walletMode` from the `TOTEM_CONNECT` response** — it is included in every connection response (first-connect and reconnect) and costs nothing extra. Use `TOTEM_GET_WALLET_MODE` only when the connection response is not available in the current scope, for example after a page reload when session data comes from a server-side session check rather than a fresh `TOTEM_CONNECT` call.

#### Request

```typescript
{
  method: 'TOTEM_GET_WALLET_MODE',
  params: {}
}
```

#### Response

```typescript
{
  walletMode: 'AnonTree' | 'RootTree'
}
```

#### Errors (thrown)

| Error Message | Cause |
|---------------|-------|
| `Origin is required` | Missing origin parameter |
| `Site not connected. Call TOTEM_CONNECT first.` | Site has not connected |

#### Convenience Wrapper

```javascript
const { walletMode } = await provider.getWalletMode();
```

#### Events

Subscribe to `walletModeChanged` to be notified when the mode changes mid-session (forward-compatible — reserved for future wallet settings):

```javascript
provider.on('walletModeChanged', ({ walletMode }) => {
  console.log('Mode changed to:', walletMode);
});
```

---

### 4.14 TOTEM_PROVE_OWNERSHIP

Generates a cryptographic cross-address ownership proof demonstrating that the root key controls a set of child addresses. **Only available in RootTree mode.** The wallet shows a confirmation popup listing the child addresses before generating the proof. Rejects immediately with `WALLET_MODE_MISMATCH` if the wallet is in AnonTree mode.

The resulting `OwnershipProof` can be verified server-side without any blockchain access — it is a pure cryptographic artifact.

> **Gate on `walletMode === 'RootTree'` before calling.** If you call `TOTEM_PROVE_OWNERSHIP` on an AnonTree wallet the request throws immediately with `WALLET_MODE_MISMATCH`.

#### Request

```typescript
{
  method: 'TOTEM_PROVE_OWNERSHIP',
  params: {
    childIndices: number[]   // Which child address indices (0-based) to include.
                             // Must be non-empty. Max 64 (one per address slot).
  }
}
```

#### Response (Success)

```typescript
{
  rootAddress: string,       // Root identity address (Mx... format)
  rootPublicKey: string,     // Root public key (hex, no 0x prefix)
  childAddresses: string[],  // Child Minima addresses in childIndices order
  childPublicKeys: string[], // Child public keys in childIndices order
  rootProof: {
    address: string,         // Root address
    publicKey: string,       // Root public key
    signature: string,       // Serialized WOTS TreeSignature (hex)
    message: string,         // Canonical ownership message (JSON)
  },
  timestamp: string          // ISO 8601 timestamp (e.g. "2026-05-23T10:30:00.000Z")
}
```

#### User Approval Popup

Before generating the proof, Totem opens a confirmation popup showing:
- Requesting site origin
- Root identity address
- Full list of child addresses to be linked
- Approve / Reject buttons

#### Error Codes

| Error Message | Error Code | Cause |
|---------------|------------|-------|
| `TOTEM_PROVE_OWNERSHIP requires a RootTree wallet...` | `WALLET_MODE_MISMATCH` | Wallet is in AnonTree mode |
| `childIndices must be a non-empty array of numbers` | `INVALID_INDICES` | Empty or missing childIndices |
| `Invalid child index: N` | `INVALID_INDICES` | Negative or non-integer index |
| `User rejected ownership proof request` | `USER_REJECTED` | User clicked Reject or closed popup |
| `Site not connected. Call TOTEM_CONNECT first.` | — | Must connect before calling |

#### Server-Side Verification

Ownership proofs are **self-contained cryptographic artifacts** — no Minima node, no network call, no Axia account needed. Any backend that can install an npm package can verify them locally.

**Primary path — npm package (works on Node.js, Bare/Pear, and browsers)**

The package has zero Node.js built-in dependencies. All crypto is pure `Uint8Array` and `@noble/hashes` — the same primitives available natively in Bare/Pear, browsers, and modern runtimes.

```bash
npm install @totemsdk/root-identity
```

```javascript
import { RootIdentityWallet } from '@totemsdk/root-identity';

// verifyOwnershipProof is a static method — pure crypto, no I/O
const valid = RootIdentityWallet.verifyOwnershipProof(proof);
// → true / false
```

Full endpoint example:

```javascript
import { RootIdentityWallet } from '@totemsdk/root-identity';

app.post('/api/auth/verify-ownership', (req, res) => {
  const { proof } = req.body;
  const valid = RootIdentityWallet.verifyOwnershipProof(proof);
  if (!valid) return res.status(401).json({ valid: false });
  res.json({
    valid: true,
    rootAddress: proof.rootAddress,
    childAddresses: proof.childAddresses,
  });
});
```

The dApp Starter ships a ready-made implementation of this at `packages/totem-dapp-starter/server/index.js`.

`verifyOwnershipProof` rebuilds the canonical ownership message, verifies the root WOTS signature against the root public key, and confirms each child public key correctly derives its child Minima address — fully deterministic, no trust in any third party required.

**Optional — Axia API hosted endpoint (for dApps already using the Axia gateway)**

If your dApp is already using the Axia API and you'd rather not add a dependency, you can delegate verification to the project-scoped endpoint:

```
POST https://api.axia.to/v1/{projectId}/auth/verify-ownership
x-axia-project-secret: <your-project-secret>
Content-Type: application/json

{ "proof": <OwnershipProof> }
```

The hosted endpoint runs the exact same `verifyOwnershipProof` logic — it is a convenience wrapper, not a trust boundary. **The npm path is the recommended approach** for any backend that can install packages, as it keeps verification fully decentralised.

#### Convenience Wrapper

```javascript
const proof = await provider.proveOwnership([0, 1, 2]);
```

#### Full Usage Example

```javascript
// Frontend (dApp)
async function requestOwnershipProof(childIndices = [0, 1]) {
  // Gate: only attempt in RootTree mode
  const { walletMode } = await provider.getWalletMode();
  if (walletMode !== 'RootTree') {
    console.log('Root Identity not available — wallet is in AnonTree mode.');
    return;
  }

  // Request proof — shows consent popup in the extension
  const proof = await provider.proveOwnership(childIndices);

  // Verify server-side
  const res = await fetch('/api/auth/verify-ownership', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proof }),
  });
  const { valid, rootAddress, childAddresses } = await res.json();

  if (valid) {
    console.log('Proof verified! Root:', rootAddress);
    console.log('Controls children:', childAddresses);
  } else {
    console.warn('Proof invalid — reject request.');
  }
}
```

---

## 5. Events

Subscribe with `provider.on(eventName, callback)` and unsubscribe with `provider.removeListener(eventName, callback)`.

### 5.1 accountsChanged

Emitted when the wallet's connected account changes. Most importantly, emitted with an empty array (`[]`) when a site is disconnected — either programmatically via `TOTEM_DISCONNECT` or by the user from the extension settings.

#### Payload

```typescript
string[]  // Array of connected addresses (empty when disconnected)
```

#### Example

```javascript
provider.on('accountsChanged', (accounts) => {
  if (accounts.length === 0) {
    // Wallet disconnected — clear session state
    setConnected(false);
    setAddress(null);
  } else {
    setAddress(accounts[0]);
  }
});
```

#### Unsubscribing

```javascript
function handleAccountsChanged(accounts) {
  if (accounts.length === 0) clearSession();
}

provider.on('accountsChanged', handleAccountsChanged);
provider.removeListener('accountsChanged', handleAccountsChanged);
```

---

### 5.2 Balance and UTXO Updates

> **Balance and UTXO updates belong to the Axia API or your own dApp indexer — not to Totem.**

Totem does not emit a `balanceChanged` event as a documented dApp API. The wallet's internal balance stream exists only to keep the extension's own UI accurate; it is not a supported event surface for dApp integrations.

To display live balances and react to on-chain changes, use the Axia WebSocket or REST API from your backend:

#### Option A — Axia REST API (polling or on-demand)

```javascript
// After wallet connect, fetch and periodically refresh from your backend
async function refreshPortfolio(address) {
  const res = await fetch(`/api/portfolio/${address}`);
  const data = await res.json();
  setPortfolio(data);
}
```

#### Option B — Axia WebSocket (real-time balance stream)

Obtain a short-lived WebSocket token from your backend (which calls the Axia API with your server-side key), then open a WebSocket subscription to the balance stream:

```javascript
// Step 1: Your backend issues a WS token
//   POST https://api.axia.to/v1/wallet/ws-token   (intentionally flat path —
//     this route uses Totem's own projectId-based auth, not x-axia-project-secret)
//   → { token: "eyJ...", expiresAt: 1234567890 }
//
// Expose it to the client via your own endpoint, e.g.:
//   GET /api/ws-token
const { token } = await fetch('/api/ws-token').then(r => r.json());

// Step 2: Open the Axia balance WebSocket using the token
const ws = new WebSocket(
  `wss://api.axia.to/v1/wallet/balance/ws?token=${token}&address=${connectedAddress}`
);

ws.onopen = () => {
  // Connection is address-scoped via the query params above.
  // Optionally send a subscribe message for explicit acknowledgment:
  ws.send(JSON.stringify({ type: 'subscribe', address: connectedAddress }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'utxoChanged') {
    // msg.data shape:
    // {
    //   address: string,          // Minima address
    //   minimaBalance: string,    // Updated native Minima balance
    //   utxoCount: number,        // Current UTXO count
    //   tokens: Array<{ tokenId: string, balance: string }>,
    //   changedAt: string         // ISO 8601 timestamp
    // }
    setPortfolio(msg.data);
  }
};

ws.onclose = () => {
  // Re-acquire a token and reconnect as needed (tokens are short-lived)
};
```

#### Why this matters

Using Totem as a balance oracle creates a hidden dependency on an undocumented internal cache. Axia API data is the authoritative, consistent, multi-token source — and it works even when Totem is not installed (e.g., for read-only analytics pages).

---

## 6. Convenience Wrappers

The provider exposes shorthand methods for common operations. These call the corresponding `TOTEM_*` methods internally. The content script automatically injects the page origin, so these wrappers do not require an explicit `origin` parameter.

```javascript
// Read spendable coins (calls TOTEM_GET_COINS)
const coins = await provider.getCoins({ tokenId: '0x00', minAmount: '1.0' });

// Build and submit a complex transaction (calls TOTEM_SEND_COMPLEX, mode='submit')
const tx = await provider.sendComplex({ inputs: [...], outputs: [...] });

// Build unsigned blob without signing (calls TOTEM_SEND_COMPLEX, mode='build')
const blob = await provider.sendComplex({ inputs: [...], outputs: [...] }, 'build');

// Broadcast a pre-signed transaction (calls TOTEM_BROADCAST_HEX)
const result = await provider.broadcastHex({ signedHex: '0xabc...' });

// Partially sign for multisig (calls TOTEM_SIGN_DATA)
const sig = await provider.signData({
  unsignedHex: '0xabc...',
  inputAddresses: ['Mx...'],
  returnFormat: 'hex'
});

// Connect to wallet (calls TOTEM_CONNECT)
const connection = await provider.enable();

// Disconnect from wallet (calls TOTEM_DISCONNECT)
await provider.disconnect();

// Generic send (calls any method by name)
const result = await provider.send('TOTEM_CONNECT', []);
```

### Wrapper Signatures

| Wrapper | Underlying Method | Parameters |
|---------|-------------------|------------|
| `getCoins(params?)` | `TOTEM_GET_COINS` | `{ tokenId?, address?, minAmount? }` |
| `sendComplex(buildParams, mode?)` | `TOTEM_SEND_COMPLEX` | `buildParams`: EnhancedBuildParams, `mode`: `'build'` or `'submit'` (default `'submit'`) |
| `broadcastHex(params)` | `TOTEM_BROADCAST_HEX` | `{ signedHex: string, expectedDigestTx?: string }` |
| `signData(params)` | `TOTEM_SIGN_DATA` | `{ unsignedHex, inputAddresses, inputIndices?, returnFormat? }` |
| `enable()` | `TOTEM_CONNECT` | (no params) |
| `disconnect()` | `TOTEM_DISCONNECT` | (no params) |
| `send(method, params?)` | (any method) | Method name + optional args array |

---

## 7. Permission and Intent System

### Intent Reference

| Intent | Used By | Description |
|--------|---------|-------------|
| `send` | `TOTEM_SEND_TRANSACTION` | Standard Minima sends |
| `token_send` | `TOTEM_SEND_TRANSACTION` | Custom token sends |
| `swap` | `TOTEM_SEND_COMPLEX` | DEX exchange offers |
| `liquidity_add` | `TOTEM_SEND_COMPLEX` | AMM liquidity provision |
| `liquidity_remove` | `TOTEM_SEND_COMPLEX` | AMM liquidity withdrawal |
| `contract_call` | `TOTEM_SEND_COMPLEX` | MAST and custom contracts |
| `multisig` | `TOTEM_SEND_COMPLEX` | Multisig transactions |
| `timelock` | `TOTEM_SEND_COMPLEX` | Timelock spending |
| `htlc` | `TOTEM_SEND_COMPLEX` | HTLC claim/refund |
| `custom` | `TOTEM_SEND_COMPLEX` | Arbitrary custom scripts |
| `utxo_read` | `TOTEM_GET_COINS` | Read spendable UTXOs |
| `complex_send` | `TOTEM_SEND_COMPLEX` | Catch-all for any complex transaction |
| `sign_data` | `TOTEM_SIGN_DATA` | Partial signing for multisig |
| `broadcast_tx` | `TOTEM_BROADCAST_HEX` | Broadcasting pre-signed blobs |

### Token Limits

The `tokenLimits` array in `TOTEM_GRANT_TX_PERMISSION` allows capping per-transaction and daily spend per token. The wallet enforces these limits using BigInt string-based comparison at 8-decimal precision and resets the daily counter at midnight UTC.

### Expiry Guidance

- Use `expiresInDays: 7` to `30` for most dApps — short expiries protect users and encourage regular re-authorisation.
- Do **not** use `expiresInDays: 365` or omit the field — long-lived permissions are a security liability.
- Allow users to re-grant permissions gracefully: detect `errorCode: 'PERMISSION_DENIED'` and show an in-app permission request flow.

---

## 8. Security Model

### Origin Binding

All connections and permissions are bound to the requesting origin. A connection from `https://app1.com` cannot be used by `https://app2.com`. The content script enforces this — the injected origin cannot be spoofed by the page.

### WOTS Signature Considerations

Minima uses Winternitz One-Time Signatures (WOTS), which are quantum-resistant but have specific constraints:

1. **Each signing key can only be used once** — the wallet manages key rotation automatically via `WatermarkStore`
2. **Verifications consume keys** — each `TOTEM_VERIFY` call uses one WOTS leaf
3. **Limited signatures per address** — each address has 64 × 64 × 64 = 262,144 signing keys
4. **Per-address TreeKeys** — each wallet address has its own independent TreeKey with its own key pool

The verification popup warns users about leaf consumption to prevent key exhaustion.

### Address Format Normalization

All provider methods that return an `address` field normalize to **Mx format** (Minima's Base32 encoding, e.g., `MxG0B4TA7UD5AM2J...`). DApps can safely compare addresses returned by different methods using simple string equality.

Methods that accept address inputs (e.g., `TOTEM_SEND_COMPLEX` `inputs[].address`, `TOTEM_SIGN_DATA` `inputAddresses[]`) accept both `Mx...` and `0x...` formats. The wallet converts internally for ownership validation.

### Input Ownership Validation

Both `TOTEM_SEND_COMPLEX` and `TOTEM_SIGN_DATA` validate that the connected wallet actually owns at least one input. This prevents:

- Malicious dApps constructing transactions that only spend other users' coins
- Blind signing of transactions where the wallet has no stake
- Social engineering attacks tricking users into signing harmful transactions

### Challenge Expiry

`TOTEM_VERIFY` challenges expire after 5 minutes by default. The extension displays remaining time in the approval popup and rejects signing if the challenge has expired. Provide a server-generated nonce in `challenge.nonce` for additional replay protection.

### Connection Persistence

- Connections persist across browser sessions using Chrome storage.
- Sites can be disconnected by the user via the Totem Browser Extension settings.
- Sites can be disconnected programmatically via `TOTEM_DISCONNECT`.
- Permissions can be revoked at any time via `TOTEM_REVOKE_TX_PERMISSION`.

### Approval Popup Summary

| Method | Popup Type | Details Shown |
|--------|------------|---------------|
| `TOTEM_CONNECT` (first visit) | Address picker | Available addresses |
| `TOTEM_VERIFY` | Verification confirmation | Challenge statement, expiry, WOTS warning |
| `TOTEM_SEND_TRANSACTION` | Transaction approval | Amount, recipient, token, intent |
| `TOTEM_SEND_COMPLEX` | Transaction approval | Total amount, primary recipient, detected intent, script types, build vs submit |
| `TOTEM_SIGN_DATA` | Signing approval | Number of owned inputs, transaction digest preview |
| `TOTEM_BROADCAST_HEX` | Broadcast confirmation | Digest preview, hex size |

---

## 9. Transaction Internals

### 9.1 Transaction Pipeline

```
Coin Selection → Lease Request → CoinProof Fetch → Build Transaction
  → Sign (WOTS) → Serialize for txnimport → Submit to Network
```

| Stage | Service | File |
|-------|---------|------|
| Coin Selection | `CoinSelectionService` | `packages/totem-extension/src/core/transaction/CoinSelectionService.ts` |
| Lease Management | `LeaseStore` | `packages/totem-extension/src/core/stores/LeaseStore.ts` |
| Transaction Build | `MinimaTransactionBuilder` | `packages/totem-extension/src/core/transaction/MinimaTransactionBuilder.ts` |
| Signing | Per-address TreeKey + WOTS | `packages/totem-extension/src/core/wallet.ts`, `packages/totem-sdk/packages/core/src/treekey.ts` |
| Serialization | `Streamable.ts` | `packages/totem-sdk/packages/core/src/Streamable.ts` |
| Watermark Tracking | `WatermarkStore` | `packages/totem-extension/src/core/stores/WatermarkStore.ts` |

### 9.2 Per-Address TreeKey Model

Totem generates 64 addresses from a single BIP39 mnemonic. Each address has its own TreeKey, matching Minima's `Wallet.java` implementation exactly.

```
BIP39 Mnemonic
  └─ Base Seed (512-bit)
       └─ Address Index (0..63)
            └─ Per-Address TreeKey (3-level tree, depth=3, keysPerLevel=64)
                 ├─ Root Node → root public key derives the Minima address
                 ├─ L1 Nodes (64 children of Root)
                 │    └─ L2 Nodes (64 children per L1 node)
                 │         └─ Leaf Keys (64 WOTS key pairs per L2 node)
                 └─ Total: 64 × 64 × 64 = 262,144 signing slots per address
```

Key properties:

- Each address index produces a unique TreeKey with its own root public key
- The address script is `RETURN SIGNEDBY(0x<ROOT_PUBLIC_KEY>)` for standard addresses
- TreeKeys are held in memory only while the wallet is unlocked — cleared on lock
- Total signing capacity per address: 262,144 (64³ leaf keys)
- Total per wallet: 64 addresses × 262,144 = 16,777,216 one-time signatures

### 9.3 WOTS 3-Proof Structure

Each signature produces 3 MMR proofs (Root → L1 → L2 → DATA):

```
Signature = {
  Proof 0: Root → L1   (Root node signs L1 child's getRootPublicKey())
  Proof 1: L1 → L2     (L1 node signs L2 child's getRootPublicKey())
  Proof 2: L2 → DATA   (L2 node signs the actual transaction data)
}
```

Signing path: `TreeKey.setUses(l1 * 64 + l2)` followed by `TreeKey.sign(digestBytes)`, matching Java's `TreeKey.sign()` exactly. The `WatermarkStore` tracks used (addressIndex, l1, l2) indices with strict monotonic advancement — indices can never go backward.

Watermark record format:

```
{
  addressIndex: number,   // which of the 64 addresses
  l1: number,             // L1 index within that address's TreeKey
  l2: number              // L2 index within that L1 subtree
}
```

### 9.4 Standard Send Flow (WOTS_SEND)

1. **Coin Selection** — Select UTXOs covering send amount plus change
2. **Lease Request** — Allocate watermark indices via `LeaseStore` (mutex-protected)
3. **CoinProof Fetch** — Retrieve CoinProofs via `coinexport` RPC for each input
4. **Build Transaction** — Construct body: inputs (with CoinProofs), outputs (recipient + change), witness data
5. **Sign** — For each input, use the per-address TreeKey at allocated (l1, l2) indices, produce 3-proof WOTS signature
6. **Serialize** — Encode as hex string using `Streamable.ts` (byte-exact Java-compatible serialization)
7. **Submit** — Send via `txnimport` RPC to the Axia API gateway

### 9.5 DApp-Initiated Send Flow (TOTEM_SEND_TRANSACTION)

1. DApp calls `provider.request({ method: 'TOTEM_SEND_TRANSACTION', params: {...} })`
2. Provider (injected) → Content Script (bridge) → Background (handler)
3. Permission check via `canExecuteTransaction()` — verifies intent, token allowlist, per-tx and daily limits
4. User approval popup displayed
5. On approval, internally dispatches to the standard WOTS_SEND pipeline above

### 9.6 Verification Flow (TOTEM_VERIFY)

1. DApp calls `TOTEM_VERIFY` with a challenge
2. Background builds a challenge message using `ChallengeBuilder`
3. User approval popup — user must explicitly approve
4. Signs the challenge with the connected spend address's per-address TreeKey (consumes one watermark index)
5. Returns the v4.1 proof to the dApp: `{ verified, verificationId, address, message, signature, publicKey, expiresAt }`. `publicKey` is the spend address's root public key — `deriveAddress(publicKey) === address` — so backends verify with the `verifySignatureDetailed(address, message, signature, publicKey)` one-liner. Tree indices are recorded in the wallet's internal `connectedSitesStore` for watermark accounting only and are not exposed to the dApp.

---

## 10. Token and NFT Sends

Totem handles three categories of coin asset at the transaction layer. The differences affect coin serialization, not the contract/script type — all three use `signedby` (`RETURN SIGNEDBY(pubkey)`) for a normal send.

### Summary

| Asset Type | `tokenId` | `hasToken` byte | `rawTokenData` required | Contract type |
|------------|-----------|-----------------|------------------------|---------------|
| Native Minima | `0x00` | `0` | No | `signedby` |
| Custom token | `0x<tokenId>` | `1` | Yes — extracted from CoinProof | `signedby` |
| NFT | `0x<tokenId>` | `1` | Yes — same as custom token | `signedby` |

### Native Minima Sends

When `tokenId = '0x00'`, the coin carries no Token object:

- The `hasToken` byte (`MiniByte`) is written as **`0`** for both input and output coins
- No Token object follows the byte
- The output coin's `tokenId` field encodes as the canonical 5-byte native form: `00 00 00 01 00`

### Custom Token Sends

When `tokenId !== '0x00'`, the coin carries a Token object:

- The `hasToken` byte is written as **`1`** for both input and output coins
- The raw Token bytes (`rawTokenData`) are written immediately after the `hasToken` byte, verbatim

`rawTokenData` is extracted from the input CoinProof during the CoinProof Fetch stage, byte-for-byte. This byte-exact approach is critical — any field reordering or re-encoding would produce a different coinId and fail Java validation.

**Java `Token.writeDataStream()` field order** (verified from Minima source):

| # | Field | Java type | Notes |
|---|-------|-----------|-------|
| 1 | `coinId` | `MiniData.writeHashToStream` | 32-byte hash, no length prefix |
| 2 | `script` | `MiniString → MiniData` | 4-byte big-endian length prefix + UTF-8 bytes |
| 3 | `scale` | `MiniNumber` | Variable-length scaled integer |
| 4 | `totalAmount` | `MiniNumber` | Variable-length scaled integer |
| 5 | `name` | `MiniString → MiniData` | 4-byte big-endian length prefix + UTF-8 bytes |
| 6 | `created` | `MiniNumber` | Variable-length scaled integer |

**Pre-flight check:** Before building a custom token transaction, the background handler checks all input `coinDataMap` entries for `rawTokenData`. If none is found, it throws a hard error — never a silent fallback:

```
CRITICAL: No rawTokenData extracted from any CoinProof for custom token send. Cannot proceed.
```

### NFT Sends

An NFT is a token with `total = 1`. At the transaction layer, NFT sends are **identical to custom token sends** — same `hasToken=1`, same `rawTokenData` requirement, same pre-flight check. There is no special contract type for NFTs.

NFT image display works as follows:
1. Read the token `name` metadata field
2. Find the `<artimage>` XML tag within the string
3. Strip both `<artimage>` and `</artimage>` tags
4. Construct a `data:image/...;base64,...` URL from the remaining base64 string

> Both the opening and closing `<artimage>` tags must be stripped. Leaving either in the string produces an invalid base64 input.

---

## 11. Contract Types

Minima's scripting language supports 13 contract patterns. Totem defines 12 formal `ScriptType` values (from `signedby` through `custom`), plus the trivial `RETURN TRUE` pattern (which uses `scriptType: 'custom'`).

---

### 11.1 SIGNEDBY

The most common contract type. A coin can be spent if the transaction includes a valid WOTS signature from the specified public key.

**Script Pattern:**
```
RETURN SIGNEDBY(0x<PUBLIC_KEY>)
```

**Use Cases:** Standard wallet-to-wallet transfers. All 64 HD wallet addresses use this type by default.

**ScriptDescriptor Fields:**

| Field | Value |
|-------|-------|
| `scriptType` | `'signedby'` |
| `script` | `RETURN SIGNEDBY(0x<PUBKEY>)` |
| `wotsRootPublicKey` | The WOTS root public key (hex) |
| `mastProof` | Empty (`{ chunks: [] }`) |
| `storeState` | `false` |

**Helper:** `createSignedByDescriptor()` in `ScriptTypes.ts`

---

### 11.2 Multisig (2-of-2)

Requires signatures from exactly two parties to spend.

**Script Pattern:**
```
RETURN SIGNEDBY(0x<PK1>) AND SIGNEDBY(0x<PK2>)
```

**Use Cases:** Joint accounts, escrow arrangements, two-party approval workflows.

**ScriptDescriptor Fields:**

| Field | Value |
|-------|-------|
| `scriptType` | `'multisig'` |
| `script` | `RETURN SIGNEDBY(pk1) AND SIGNEDBY(pk2)` |
| `wotsRootPublicKey` | Totem's own public key |
| `multisigKeys` | `[pk1, pk2]` |
| `multisigThreshold` | `2` |
| `externalSignatures` | Imported signature(s) from the other party |

**Helper:** `createMultisigDescriptor()` in `ScriptTypes.ts`

The external party's signature is imported as an `ExternalSignature` object containing their public key, signature bytes, MMR proof, and signature type.

---

### 11.3 Multisig (M-of-N)

Requires M signatures out of N possible signers.

**Script Pattern:**
```
RETURN MULTISIG(M 0x<PK1> 0x<PK2> 0x<PK3> ...)
```

**Use Cases:** DAO treasury management (e.g., 3-of-5), corporate wallets, recovery schemes.

**ScriptDescriptor Fields:**

| Field | Value |
|-------|-------|
| `scriptType` | `'multisig_mofn'` |
| `script` | `RETURN MULTISIG(M pk1 pk2 ...)` |
| `wotsRootPublicKey` | Totem's own public key |
| `multisigKeys` | Array of all N public keys |
| `multisigThreshold` | `M` (minimum signatures required) |
| `externalSignatures` | Imported signatures from other parties |

**Helper:** `createMofNMultisigDescriptor()` in `ScriptTypes.ts`

---

### 11.4 Timelock

A coin that can only be spent after a certain block height, or after the coin has aged past a threshold.

**Script Patterns:**

Block-based:
```
RETURN SIGNEDBY(0x<PK>) AND @BLOCK GT <UNLOCK_BLOCK>
```

Coin-age-based:
```
RETURN SIGNEDBY(0x<PK>) AND @COINAGE GT <MIN_AGE>
```

**Use Cases:** Vesting schedules, time-delayed payments, lock-up periods for staking.

**ScriptDescriptor Fields:**

| Field | Value |
|-------|-------|
| `scriptType` | `'timelock'` |
| `script` | `RETURN SIGNEDBY(pk) AND @BLOCK GT n` |
| `wotsRootPublicKey` | Signer's public key |
| `timelockBlock` | Block number (bigint) when unlock occurs |

**Helpers:**
- `TimelockHelper.createBlockTimelock()` — block-height based
- `TimelockHelper.createCoinageTimelock()` — coin-age based
- `TimelockHelper.isUnlocked()` — check if timelock has elapsed
- `TimelockHelper.buildDescriptor()` — build ScriptDescriptor for spending

---

### 11.5 HTLC (Hashed Timelock Contract)

Two spending paths: the recipient can claim by revealing a preimage, or the sender can refund after a timeout.

**Script Pattern:**
```
IF @BLOCK GT <TIMEOUT> AND SIGNEDBY(<SENDER_PK>) THEN
  RETURN TRUE
ENDIF
RETURN (SIGNEDBY(<RECIPIENT_PK>) AND SHA3(STATE(1)) EQ <HASH_LOCK>)
```

**Use Cases:** Atomic cross-chain swaps, Lightning-style payment channels, conditional payments with deadline.

**ScriptDescriptor Fields:**

| Field | Value |
|-------|-------|
| `scriptType` | `'htlc'` |
| `script` | Full HTLC script text |
| `wotsRootPublicKey` | Claimer's public key (sender or recipient) |
| `htlcHash` | The hash lock (hex) |
| `htlcPreimage` | The preimage secret (hex, only for claiming) |
| `timelockBlock` | Timeout block number |
| `stateVariables` | `[{ port: 1, value: preimage, type: 'string' }]` when claiming |

**Helpers:**
- `HTLCHelper.generateSecret()` — generate random preimage + hash (`crypto.getRandomValues`)
- `HTLCHelper.hashPreimage()` — hash with SHA3 or SHA2
- `HTLCHelper.verifyPreimage()` — verify preimage matches hash
- `HTLCHelper.buildClaimDescriptor()` — descriptor for claiming
- `HTLCHelper.buildRefundDescriptor()` — descriptor for refunding

---

### 11.6 MAST (Merkelized Abstract Syntax Tree)

A coin locked by the root hash of a script Merkle tree. The spender reveals only the branch they are executing and its Merkle proof.

**Script Pattern:**
```
MAST 0x<ROOT_HASH>
```

**Use Cases:** Privacy-preserving contracts, policy trees where only the executed branch is revealed.

**ScriptDescriptor Fields:**

| Field | Value |
|-------|-------|
| `scriptType` | `'mast'` |
| `script` | `MAST 0x<ROOT_HASH>` |
| `wotsRootPublicKey` | Signer's public key |
| `mastProof` | Merkle proof object for the revealed branch |
| `extraScripts` | Additional scripts (MAST branch reveal scripts) |

The Minima VM hashes the revealed branch script, walks the proof to reconstruct the root, verifies it matches the on-chain root hash, then executes the branch script.

**Helpers:**
- `MASTHelper.buildMastTree()` — construct a MAST from an array of branch scripts
- `MASTHelper.buildBranchDescriptor()` — build descriptor for spending a specific branch

---

### 11.7 Exchange

A DEX-style offer contract using `VERIFYOUT` assertions. The owner can cancel at any time, or anyone can take the offer by providing the specified output.

**Script Pattern:**
```
IF SIGNEDBY(PREVSTATE(0)) THEN
  RETURN TRUE
ENDIF
ASSERT VERIFYOUT(@INPUT PREVSTATE(1) PREVSTATE(2) PREVSTATE(3) TRUE)
RETURN TRUE
```

**Use Cases:** On-chain limit orders, token swaps, peer-to-peer trading.

**State Variables:**

| Port | Content | Type |
|------|---------|------|
| 0 | Owner's public key | `hex` |
| 1 | Desired output address | `hex` |
| 2 | Desired amount | `number` |
| 3 | Desired token ID | `hex` |

**ScriptDescriptor Fields:**

| Field | Value |
|-------|-------|
| `scriptType` | `'exchange'` |
| `script` | Full exchange script text |
| `wotsRootPublicKey` | Owner's public key |
| `stateVariables` | Ports 0–3 as above |
| `verifyOutExpectations` | `[{ inputIndex: '@INPUT', outputAddress, amount, tokenId, keepState: true }]` |
| `storeState` | `true` |

**Helpers:**
- `ExchangeHelper.createOffer()` — create the exchange script
- `ExchangeHelper.buildOfferState()` — build state variables for an offer
- `ExchangeHelper.buildTakeOfferDescriptor()` — build descriptor for taking an offer
- `ExchangeHelper.validateExchange()` — validate VERIFYOUT expectations against outputs

**Cancel vs Take:** Cancel (owner) signs with the owner key in `PREVSTATE(0)`, taking the first `RETURN TRUE` branch. Take (anyone) constructs the transaction so the output at `@INPUT` matches the desired address, amount, and token — `VERIFYOUT` enforces this.

---

### 11.8 Vault

A covenant contract with a safe house mechanism. Uses two keys (cold and hot) with a cooldown period.

**Vault Script Pattern:**
```
LET pkcold = <COLD_PK>
LET pkhot = <HOT_PK>
IF SIGNEDBY(pkcold) THEN RETURN TRUE ENDIF
LET amt = STATE(20)
LET recip = STATE(21)
LET safehouse = [<SAFE_HOUSE_SCRIPT>]
ASSERT VERIFYOUT(@INPUT ADDRESS(safehouse) amt @TOKENID TRUE)
LET chg = @AMOUNT - amt
IF chg GT 0 THEN
  ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS (@AMOUNT - amt) @TOKENID TRUE)
ENDIF
RETURN SIGNEDBY(pkhot)
```

**Use Cases:** High-value cold storage with hot-key convenience, withdrawal delay for theft protection, emergency override via cold key.

**State Variables:**

| Port | Content | Type |
|------|---------|------|
| 20 | Withdrawal amount | `number` |
| 21 | Recipient address | `hex` |

**Helpers:**
- `VaultHelper.createVault()` — create both vault and safe house scripts/addresses
- `VaultHelper.generateSafeHouseScript()` — generate the safe house script
- `VaultHelper.buildWithdrawalState()` — build state for a withdrawal

**How It Works:** Hot key initiates withdrawal → `VERIFYOUT` forces amount to the safe house → safe house enforces cooldown (`@COINAGE GT cooldownBlocks`) → after cooldown, hot key releases funds to recipient. Cold key can override at any stage with no cooldown.

---

### 11.9 Flash Cash

A single-transaction flash loan. Anyone can borrow the funds, but the transaction must return them (with interest) in the same transaction.

**Script Pattern:**
```
IF SIGNEDBY(PREVSTATE(1)) THEN RETURN TRUE ENDIF
ASSERT SAMESTATE(1 1)
RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT*<MULTIPLIER> @TOKENID TRUE)
```

**Use Cases:** Flash loans for arbitrage, liquidation transactions, single-transaction leveraged operations.

**ScriptDescriptor Fields:**

| Field | Value |
|-------|-------|
| `scriptType` | `'flashcash'` |
| `script` | Full flash cash script text |
| `wotsRootPublicKey` | Owner's public key |
| `stateVariables` | `[{ port: 1, value: ownerPK, type: 'hex' }]` |
| `storeState` | `true` |

**Helpers:**
- `FlashCashHelper.createFlashCash()` — create the contract
- `FlashCashHelper.calculateReturn()` — compute return amount with interest
- `FlashCashHelper.buildBorrowDescriptor()` — build descriptor for borrowing

**How It Works:** Borrower spends the coin → `VERIFYOUT` asserts an output at `@INPUT` returns `@AMOUNT * multiplier` to `@ADDRESS` → `SAMESTATE(1 1)` ensures the owner key persists. If the assertion fails, the transaction is invalid — funds never leave.

---

### 11.10 Slow Cash

A rate-limited withdrawal contract. The owner can only withdraw a percentage of the balance per cooldown period.

**Script Pattern:**
```
IF @COINAGE LT <COOLDOWN_BLOCKS> THEN RETURN FALSE ENDIF
ASSERT SIGNEDBY(<PK>)
AND VERIFYOUT(@INPUT @ADDRESS @AMOUNT*<PERCENT> @TOKENID TRUE)
```

**Use Cases:** Spending limits (drip-feed), dollar-cost-averaging outflows, protection against full-balance theft.

**ScriptDescriptor Fields:**

| Field | Value |
|-------|-------|
| `scriptType` | `'slowcash'` |
| `script` | Full slow cash script text |
| `wotsRootPublicKey` | Owner's public key |
| `timelockBlock` | Cooldown period in blocks |

**Helpers:**
- `SlowCashHelper.createSlowCash()` — create the contract
- `SlowCashHelper.calculateWithdrawal()` — compute withdrawal and remaining amounts
- `SlowCashHelper.canWithdraw()` — check if cooldown has elapsed
- `SlowCashHelper.buildWithdrawalDescriptor()` — build descriptor for withdrawal

**How It Works:** Coin must be older than `cooldownBlocks` → on spend, `VERIFYOUT` forces a change output of `@AMOUNT * percent` back to the same address → owner withdraws the difference → each withdrawal resets the coin age.

---

### 11.11 Stateful (Game Contracts)

Multi-round stateful contracts where state is preserved across spends using `STATE` / `PREVSTATE` / `SAMESTATE`.

**Script Pattern (example: round-based game):**
```
LET round = STATE(0)
LET prevround = PREVSTATE(0)
ASSERT round EQ INC(prevround)
<... game-specific logic ...>
```

**Use Cases:** Coin flip games, multi-round auctions, state machines on-chain, turn-based interactions.

**ScriptDescriptor Fields:**

| Field | Value |
|-------|-------|
| `scriptType` | `'stateful'` |
| `script` | Full stateful script text |
| `stateVariables` | Current round state + game-specific state |
| `storeState` | `true` |

**Helpers:**
- `StatefulGameHelper.createRoundCheck()` — generate the round increment assertion script fragment
- `StatefulGameHelper.buildNextRoundState()` — build state variables for the next round (increments port 0)
- `StatefulGameHelper.validateRound()` — verify round progression is correct

**How It Works:** `STATE(0)` holds the current round. `PREVSTATE(0)` is the round from the coin being spent. The script asserts `STATE(0) EQ INC(PREVSTATE(0))` — round must increment by exactly 1. Additional ports hold game-specific data. Outputs must preserve state (`storeState: true`).

---

### 11.12 Custom

Arbitrary user-defined Minima scripts. Totem can spend any coin if the user provides the full script, required state variables, and any MAST proofs.

**Script Pattern:**
```
<Any valid Minima script>
```

**Use Cases:** Novel contract designs, experimental scripts, imported third-party contracts.

**ScriptDescriptor Fields:**

| Field | Value |
|-------|-------|
| `scriptType` | `'custom'` |
| `script` | Full custom script text |
| `wotsRootPublicKey` | Totem's key (if the script requires SIGNEDBY) |
| `stateVariables` | As required by the script |
| `mastProof` | If applicable |
| `extraScripts` | If applicable |
| `verifyOutExpectations` | If applicable |
| `storeState` | As required by the script |

> **Security Note:** Custom scripts are executed as-is. Totem does not validate the semantics of custom scripts. Users should understand the script logic before signing.

---

### 11.13 RETURN TRUE (Trivial)

The simplest possible Minima script. Any transaction can spend this coin — no signature or condition required. This is not a separate `ScriptType`; it uses `'custom'` with `script: 'RETURN TRUE'`.

**Script Pattern:**
```
RETURN TRUE
```

**Use Cases:** Testing and development, genesis/bootstrap coins, publicly spendable coins (tip jars, faucets).

**ScriptDescriptor Fields:**

| Field | Value |
|-------|-------|
| `scriptType` | `'custom'` |
| `script` | `RETURN TRUE` |
| `storeState` | `false` |

> **Security Note:** Coins locked with `RETURN TRUE` can be spent by anyone. Never send real value to a `RETURN TRUE` address on mainnet.

---

## 12. ScriptDescriptor Reference

The `ScriptDescriptor` is the central data structure for describing how to unlock a coin. Every contract type maps to a `ScriptDescriptor` that tells the transaction builder what script, proofs, state, and VERIFYOUT expectations are needed.

```typescript
interface ScriptDescriptor {
  address: string;
  scriptType: ScriptType;
  script: string;
  wotsRootPublicKey?: string;
  mastProof?: MMRProof;
  extraScripts?: Map<string, string>;
  stateVariables?: StateValue[];
  storeState?: boolean;
  verifyOutExpectations?: VerifyOutExpectation[];
  timelockBlock?: bigint;
  htlcHash?: string;
  htlcPreimage?: string;
  multisigKeys?: string[];
  multisigThreshold?: number;
  externalSignatures?: ExternalSignature[];
}
```

### State Variables

Minima scripts can read and write state variables attached to coins, indexed by port number (0–255).

| Function | Description |
|----------|-------------|
| `STATE(n)` | Read state variable at port `n` on the current coin |
| `PREVSTATE(n)` | Read state variable at port `n` from the coin being spent |
| `SAMESTATE(a,b)` | Assert state ports `a` through `b` are identical to prevstate |

State variable type codes:

| Type Code | Type | Example |
|-----------|------|---------|
| 1 | `hex` | `0xABCD1234` |
| 2 | `number` | `42` or `3.14` |
| 4 | `string` | `[my string]` |
| 8 | `bool` | `TRUE` / `FALSE` |

TypeScript interface:

```typescript
interface StateValue {
  port: number;
  value: string | bigint | Uint8Array | boolean;
  type: 'bool' | 'number' | 'hex' | 'string';
}
```

### VERIFYOUT Assertions

`VERIFYOUT` is Minima's covenant mechanism. It asserts that a specific output exists in the transaction at a relative position.

```
VERIFYOUT(@INPUT, address, amount, tokenid, keepstate)
```

| Parameter | Description |
|-----------|-------------|
| `@INPUT` | Output index relative to the input being spent |
| `address` | Required output address |
| `amount` | Required output amount |
| `tokenid` | Required output token ID |
| `keepstate` | `TRUE` to copy state variables to the output |

TypeScript interface:

```typescript
interface VerifyOutExpectation {
  inputIndex: number | '@INPUT';
  outputAddress: string;
  amount: string | bigint;
  tokenId: string;
  keepState: boolean;
}
```

Used by: Exchange, Vault, Flash Cash, Slow Cash, and any custom contract with covenant logic.

---

## 13. Axia API Integration

Your backend proxies Axia API calls so your project secret stays server-side.

**Base URL:** `https://api.axia.to`
**URL shape:** All consumer REST routes are project-scoped: `/v1/{projectId}/<resource>`.
**Authentication:**
- **Public projects** — no auth header required; the `{projectId}` in the URL is sufficient.
- **Private projects** — send `x-axia-project-secret: <secret>` on every request.

```javascript
// server.js — basic Express backend
const express = require('express');
const app = express();
const AXIA_PROJECT_ID = process.env.AXIA_PROJECT_ID;
const AXIA_PROJECT_SECRET = process.env.AXIA_PROJECT_SECRET; // private projects only

function axiaHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (AXIA_PROJECT_SECRET) h['x-axia-project-secret'] = AXIA_PROJECT_SECRET;
  return h;
}

app.get('/api/balance/:address', async (req, res) => {
  const r = await fetch(
    `https://api.axia.to/v1/${AXIA_PROJECT_ID}/balance/${req.params.address}`,
    { headers: axiaHeaders() }
  );
  res.json(await r.json());
});

app.get('/api/price', async (req, res) => {
  const r = await fetch(
    `https://api.axia.to/v1/${AXIA_PROJECT_ID}/price/minima?vs=usd`,
    { headers: axiaHeaders() }
  );
  res.json(await r.json());
});
```

### Rate Limits and Credits

| Tier | Monthly Credits | Rate Limit |
|------|----------------|------------|
| Free | 10,000 | 5 req/s |
| Developer | 100,000 | 20 req/s |
| Growth | 1,000,000 | 50 req/s |
| Scale | 10,000,000 | 200 req/s |

Exceeding rate limit: `429 Too Many Requests` with `Retry-After` header.
Credits exhausted: `402 Payment Required`.
Public endpoints (`/public/*`): no API key required, IP-rate-limited to 30 req/min.

### GET /v1/health

```
GET https://api.axia.to/v1/health
→ { "ok": true, "service": "Axia API", "version": "1.0.0", "timestamp": "..." }
```

### GET /v1/{projectId}/price/minima

```
GET https://api.axia.to/v1/{projectId}/price/minima?vs=usd,eur,gbp
→ { "minima": { "usd": 0.0232, "usd_24h_change": -3.66, ... } }
```

### GET /public/chain-metrics

Public endpoint — no API key required.

```
GET https://api.axia.to/public/chain-metrics
→ { "success": true, "data": { "blockHeight": 1992250, "totalUTXOs": 269591, ... } }
```

### GET /public/address/:address

Look up an address — balance, UTXO count, token holdings, activity, and network share. Public, rate-limited.

```
GET https://api.axia.to/public/address/MxG08B1A...
→ { "success": true, "address": "MxG08B1A...", "minimaBalance": "1250.5",
    "totalUTXOs": 12, "supplyShare": "0.0042", "tokens": [...], "activity": {...} }
```

### GET /v1/{projectId}/portfolio/:address

The primary endpoint for dApp balance display. Returns the full portfolio for an address: native balance, all token balances, UTXO count, and network share. Use this as your canonical balance source after wallet connect.

```
GET https://api.axia.to/v1/{projectId}/portfolio/MxG08B1A...
→ {
    "success": true,
    "data": {
      "address": "MxG08B1A...",
      "minimaBalance": "1250.5",
      "utxoCount": 12,
      "supplyShare": "0.0042",
      "tokens": [
        { "tokenId": "0xabc...", "name": "MyToken", "balance": "500.0" }
      ]
    },
    "meta": {
      "requestId": "req_...",
      "timestamp": "2026-04-30T12:00:00Z",
      "processingMs": 42,
      "cached": false,
      "freshness": "live"
    }
  }
```

> **Public equivalent:** `GET /public/address/:address` returns the same data without auth, subject to IP rate limiting (30 req/min). Use it for unauthenticated read-only pages; use `/v1/{projectId}/portfolio/:address` for authenticated dApp sessions.

### GET /v1/{projectId}/balance/:address

```
GET https://api.axia.to/v1/{projectId}/balance/MxG08B1A...?tokenId=0x00
→ { "success": true, "data": { "address": "MxG08B1A...", "balance": "1250.5", "tokenId": "0x00" } }
```

### POST /v1/{projectId}/balance/bulk

Look up balances for up to 100 addresses at once.

```
POST https://api.axia.to/v1/{projectId}/balance/bulk
{ "addresses": ["MxG08B1A...", "MxG09C2B..."], "tokenId": "0x00" }
→ { "success": true, "data": [{ "address": "MxG08B1A...", "balance": "1250.5" }, ...] }
```

### GET /v1/{projectId}/megammr/history/:address

Transaction history for an address.

```
GET https://api.axia.to/v1/{projectId}/megammr/history/MxG08B1A...?limit=50
→ { "success": true, "data": [{ "txpowid": "0xabc...", "type": "send", "amount": "10.5", ... }] }
```

### POST /v1/{projectId}/indexer/utxos

Query spendable UTXOs for an address from the chain via RPC.

```
POST https://api.axia.to/v1/{projectId}/indexer/utxos
{ "address": "MxG08B1A...", "tokenid": "0x00" }
→ { "address": "MxG08B1A...", "utxos": [{ "coinid": "0xdef...", "amount": "50.0", ... }] }
```

Note: For wallet-connected users, prefer `TOTEM_GET_COINS` which queries the wallet's own UTXO set.

### POST /v1/{projectId}/tx/minepost

Submit a fully-built transaction for mining and posting. Most dApps should use `TOTEM_SEND_TRANSACTION` or `TOTEM_BROADCAST_HEX` instead.

```
POST https://api.axia.to/v1/{projectId}/tx/minepost
{ "data": "0x..." }
→ { "ok": true, "txpowid": "0x..." }
```

> **Migration note (2026-05-03):** All consumer REST endpoints above moved from flat `/v1/<resource>` to project-scoped `/v1/{projectId}/<resource>`. Legacy flat URLs return `410 Gone` with a migration hint. Auth is now `x-axia-project-secret` (private projects) or no header (public projects). The legacy `x-api-key` header continues to work only for the JSON-RPC surface at `https://rpc.axia.to/v1/{projectId}`.

### Portfolio Dashboard Pattern

A complete example integrating Axia API data with Totem wallet. Balance and portfolio data come from the Axia API — not from wallet events.

```javascript
class PortfolioDashboard {
  constructor(apiBase) {
    this.apiBase = apiBase;
    this.address = null;
    this.onDisconnect = null;
  }

  async connect(onDisconnect) {
    this.onDisconnect = onDisconnect;

    const { connection, verification } = await connectAndVerify('Connect to Portfolio Dashboard');
    const acct = await provider.request({
      method: 'TOTEM_GET_ACCOUNTS',
      params: { origin: window.location.origin }
    });
    this.address = acct.accounts[0].address;

    // Only wallet event we need: detect disconnects
    provider.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) onDisconnect();
    });

    return { address: this.address };
  }

  async loadPortfolio() {
    // Fetch balance and portfolio from Axia API (via your backend)
    const [portfolioData, priceData] = await Promise.all([
      fetch(`${this.apiBase}/portfolio/${this.address}`).then(r => r.json()),
      fetch(`${this.apiBase}/api/price`).then(r => r.json())
    ]);

    const usdPrice = priceData.minima?.usd ?? 0;
    const balance = parseFloat(portfolioData.data?.minimaBalance ?? '0');

    return {
      address: this.address,
      minimaBalance: portfolioData.data?.minimaBalance,
      usdValue: (balance * usdPrice).toFixed(2),
      priceChange24h: priceData.minima?.usd_24h_change?.toFixed(2) ?? '0',
      supplyShare: portfolioData.data?.supplyShare,
      utxoCount: portfolioData.data?.utxoCount,
      tokens: portfolioData.data?.tokens ?? []
    };
  }
}

// Usage
const dashboard = new PortfolioDashboard('/api');
await dashboard.connect(() => console.log('Wallet disconnected — clearing UI'));
const portfolio = await dashboard.loadPortfolio();
console.log(`Balance: ${portfolio.minimaBalance} MINIMA ($${portfolio.usdValue})`);
```

---

### Deprecated Endpoints (Axia DEX Surface)

> **⚠️ DEPRECATED — Do not use in new integrations.**
>
> The following endpoints are part of the Axia DEX surface (orderbook, AMM, RFQ, intent verification). They are documented here for reference only. New dApps should use `TOTEM_SEND_COMPLEX` with `scriptType: 'exchange'` for on-chain DEX interactions, and the Axia balance/history endpoints above for chain data.

- `GET /v1/{projectId}/ob/book` — Orderbook snapshot
- `GET /v1/{projectId}/ob/quote` — AMM quote
- `POST /v1/{projectId}/ob/order` — Place limit order
- `DELETE /v1/{projectId}/ob/order/:id` — Cancel order
- `GET /v1/{projectId}/amm/pools` — AMM pool list
- `GET /v1/{projectId}/amm/quote` — AMM swap quote
- `POST /v1/{projectId}/intents/verify` — Intent verification

---

## 14. React Integration

### The Isolated State Pitfall

The most common React bug in dApp integrations is calling a wallet hook separately in multiple components:

```jsx
// WRONG — each component gets isolated state
function NavBar() { const { connected } = useWallet(); }
function Dashboard() { const { connected } = useWallet(); }
// NavBar shows "connected", Dashboard shows "disconnected"
```

The correct pattern is a single shared `TotemProvider` context at the root of your app.

### Full TotemProvider Implementation

The provider manages wallet connection and verification state only. Balance and portfolio data come from the Axia API via a separate hook (`useAxiaPortfolio`) — not from the wallet.

Multi-wallet discovery (v4.3.0): wallets announce themselves via `totem:announce`. When exactly one wallet is present, connection proceeds automatically. When multiple wallets are present, expose the `wallets` list so the app can render a picker.

```jsx
// src/totem-context.jsx
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const TOTEM_ANNOUNCE = 'totem:announce';
const TOTEM_REQUEST_ANNOUNCE = 'totem:requestAnnounce';

const TotemContext = createContext(null);

export function TotemProvider({ children }) {
  const [wallets, setWallets] = useState([]);          // discovered wallets
  const [activeProvider, setActiveProvider] = useState(null);
  const [connected, setConnected] = useState(false);
  const [verified, setVerified] = useState(false);
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const walletsRef = useRef(new Map());

  // Wallet discovery — listen for totem:announce, fire totem:requestAnnounce
  useEffect(() => {
    function onAnnounce(event) {
      const { info, provider } = event.detail ?? {};
      if (!info?.id || !provider) return;
      walletsRef.current.set(info.id, { info, provider });
      const discovered = [...walletsRef.current.values()];
      setWallets(discovered);
      if (discovered.length === 1) setActiveProvider(discovered[0].provider);
    }
    window.addEventListener(TOTEM_ANNOUNCE, onAnnounce);
    window.dispatchEvent(new CustomEvent(TOTEM_REQUEST_ANNOUNCE));
    return () => window.removeEventListener(TOTEM_ANNOUNCE, onAnnounce);
  }, []);

  // Handle wallet disconnects (both programmatic and user-initiated)
  useEffect(() => {
    if (!activeProvider) return;
    function handleAccountsChanged(accounts) {
      if (accounts.length === 0) {
        setConnected(false);
        setVerified(false);
        setAddress(null);
        setChainId(null);
      }
    }
    activeProvider.on('accountsChanged', handleAccountsChanged);
    return () => activeProvider.removeListener('accountsChanged', handleAccountsChanged);
  }, [activeProvider]);

  // When multiple wallets are detected, call selectWallet(id) to pick one
  const selectWallet = useCallback((walletId) => {
    const found = walletsRef.current.get(walletId);
    if (found) setActiveProvider(found.provider);
  }, []);

  const connectAndVerify = useCallback(async (statement = 'Sign in') => {
    if (!activeProvider) throw new Error('No wallet detected.');
    setIsConnecting(true);
    setError(null);
    try {
      const conn = await activeProvider.request({
        method: 'TOTEM_CONNECT',
        params: { origin: location.origin }
      });

      const proof = await activeProvider.request({
        method: 'TOTEM_VERIFY',
        params: { origin: location.origin, challenge: { statement } }
      });

      const acct = await activeProvider.request({
        method: 'TOTEM_GET_ACCOUNTS',
        params: { origin: location.origin }
      });

      setConnected(true);
      setVerified(true);
      setAddress(acct.accounts[0].address);
      setChainId(acct.accounts[0].chainId);
      // Portfolio/balance data is NOT stored here — use useAxiaPortfolio(address)
      return { connection: conn, verification: proof };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [activeProvider]);

  const disconnect = useCallback(async () => {
    try {
      await activeProvider?.disconnect();
    } catch {
      // Already disconnected — accountsChanged fires regardless
    }
    setConnected(false);
    setVerified(false);
    setAddress(null);
    setChainId(null);
  }, [activeProvider]);

  return (
    <TotemContext.Provider value={{
      wallets, activeProvider, selectWallet,
      connected, verified, address, chainId,
      isConnecting, error,
      connectAndVerify, disconnect
    }}>
      {children}
    </TotemContext.Provider>
  );
}

export function useTotem() {
  const ctx = useContext(TotemContext);
  if (!ctx) throw new Error('useTotem must be used inside <TotemProvider>');
  return ctx;
}
```

### useAxiaPortfolio Hook

Fetch and optionally poll balance/portfolio data from the Axia API. Keep this separate from `useTotem` so wallet state and chain data concerns stay isolated.

```jsx
// src/hooks/useAxiaPortfolio.js
import { useState, useEffect, useCallback } from 'react';

export function useAxiaPortfolio(address, { pollIntervalMs = 0 } = {}) {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/portfolio/${address}`);
      const json = await res.json();
      setPortfolio(json.data ?? json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetch_();
    if (pollIntervalMs > 0) {
      const id = setInterval(fetch_, pollIntervalMs);
      return () => clearInterval(id);
    }
  }, [fetch_, pollIntervalMs]);

  return { portfolio, loading, error, refresh: fetch_ };
}

// Usage example
function Dashboard() {
  const { verified, address } = useTotem();
  const { portfolio, loading } = useAxiaPortfolio(address, { pollIntervalMs: 30000 });

  if (!verified) return <ConnectButton />;
  if (loading && !portfolio) return <Spinner />;
  return <BalanceCard balance={portfolio?.minimaBalance} tokens={portfolio?.tokens} />;
}
```

> **Optional real-time updates:** For sub-second balance updates without polling, obtain a WS token from your backend and open an Axia WebSocket subscription (see §5.2). Wire `utxoChanged` messages to call `refresh()` from `useAxiaPortfolio`.

### Wrapping Your App

```jsx
// src/App.jsx
import { TotemProvider } from './totem-context';

export default function App() {
  return (
    <TotemProvider>
      <Router>
        <NavHeader />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/app" element={<AppPage />} />
        </Routes>
      </Router>
    </TotemProvider>
  );
}
```

`<TotemProvider>` must wrap the entire component tree, including your router and nav, so every component shares the same state.

### Consuming from Any Component

```jsx
function NavBar() {
  const { verified, address, connectAndVerify, disconnect, isConnecting } = useTotem();

  return (
    <nav>
      {verified ? (
        <>
          <span>{address.slice(0, 10)}...</span>
          <button onClick={disconnect}>Disconnect</button>
        </>
      ) : (
        <button onClick={() => connectAndVerify('Sign in to MyDApp')} disabled={isConnecting}>
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}
    </nav>
  );
}
```

### Key Rules

| Rule | Why |
|------|-----|
| One `<TotemProvider>` per app, at the root | Multiple providers create multiple isolated states |
| Wrap the router and nav inside the provider | If nav lives outside, `useTotem()` throws |
| Wire up `accountsChanged` | Needed to detect wallet disconnects and reset session |
| Use `useAxiaPortfolio(address)` for balance data | Balances come from the Axia API, not from wallet events |
| The `connectAndVerify` function must chain connect → verify → get accounts atomically | Matches the mandatory pattern |
| Do not call `useTotem()` state locally inside components that also render connected children | State must live in the provider |

---

## 15. Security Checklist

Before launching your dApp, verify every item:

- [ ] **TOTEM_VERIFY is called immediately after TOTEM_CONNECT** — no gaps, no separate buttons, no conditional logic between them
- [ ] **API key is server-side only** — never in client-side JavaScript, never in `fetch()` calls from the browser
- [ ] **Listening for `accountsChanged`** — your UI resets when the wallet disconnects
- [ ] **Balances, UTXOs, and history come from the Axia API** — not from Totem events or TOTEM_GET_ACCOUNTS; use `GET /v1/{projectId}/portfolio/:address` through your backend
- [ ] **Backend verifies TOTEM_VERIFY signatures** — do not trust the frontend to report verification status; cryptographically validate the WOTS signature on your server using `@totemsdk/core`'s `verifySignatureDetailed(address, message, signature, publicKey)` one-liner. v4.1 signs from the connected spend address, so the helper's address↔publicKey binding check now succeeds on every valid proof. The `packages/totem-dapp-starter` reference server (`server/index.js`) implements this exact pattern.
- [ ] **HTTPS everywhere** — the Totem provider API only works on HTTPS origins (or localhost for development)
- [ ] **Permissions are scoped** — request only the intents you actually need, not every permission available
- [ ] **Token limits are set** — for dApps that handle trades, set `maxAmountPerTx` and `maxDailyAmount`
- [ ] **Permissions have expiry** — do not use `expiresInDays: 365`, use 7–30 days
- [ ] **Error handling on every wallet call** — users can reject any popup; your UI must handle `User rejected` gracefully

---

## 16. Common Mistakes

### Mistake 1: Skipping TOTEM_VERIFY

```javascript
// WRONG — security vulnerability: anyone can type any address
const conn = await provider.request({ method: 'TOTEM_CONNECT', params: { origin } });
const acct = await provider.request({ method: 'TOTEM_GET_ACCOUNTS', params: { origin } });
```

```javascript
// CORRECT
const conn = await provider.request({ method: 'TOTEM_CONNECT', params: { origin } });
const proof = await provider.request({ method: 'TOTEM_VERIFY', params: { origin, challenge: { statement: '...' } } });
const acct = await provider.request({ method: 'TOTEM_GET_ACCOUNTS', params: { origin } });
```

---

### Mistake 2: Exposing the API Key Client-Side

```javascript
// WRONG — project secret is visible to anyone who opens DevTools
const res = await fetch('https://api.axia.to/v1/proj_abc/balance/MxABC...', {
  headers: { 'x-axia-project-secret': 'axia_secret_abc123' }
});
```

```javascript
// CORRECT — call your backend, which adds the project secret server-side
const res = await fetch('/api/balance/MxABC...');
```

---

### Mistake 3: Using the SDK for Signing

```javascript
// WRONG — you don't need this, and it won't have the user's keys anyway
import { WalletManager } from 'totem-sdk';
const wallet = new WalletManager(seed);
const signed = await wallet.signTransaction(tx);
```

```javascript
// CORRECT — let the browser extension handle signing
const result = await provider.request({
  method: 'TOTEM_SEND_TRANSACTION',
  params: { origin, request: { version: 1, outputs: [{ address, amount }] } }
});
```

---

### Mistake 4: Separate Hooks per Component in React

```jsx
// WRONG — each component gets isolated state
function NavBar() { const { connected } = useWallet(); }
function Dashboard() { const { connected } = useWallet(); }
```

```jsx
// CORRECT — single shared context
<TotemProvider>
  <NavBar />     {/* reads from shared state */}
  <Dashboard />  {/* same shared state */}
</TotemProvider>
```

---

### Mistake 5: Not Listening for accountsChanged

```javascript
// WRONG — user disconnects, your UI still shows "Connected"
await provider.request({ method: 'TOTEM_CONNECT', ... });
setConnected(true);
// ... user disconnects from extension settings ... UI stays broken
```

```javascript
// CORRECT
provider.on('accountsChanged', (accounts) => {
  if (accounts.length === 0) {
    setConnected(false);
    setAddress(null);
  }
});
```

---

### Mistake 6: Granting All Permissions at Once

```javascript
// WRONG — least-privilege violation
config: { allowedIntents: ['send', 'token_send', 'swap', 'liquidity_add', 'liquidity_remove',
  'contract_call', 'multisig', 'timelock', 'htlc', 'custom', 'utxo_read', 'complex_send',
  'sign_data', 'broadcast_tx'], expiresInDays: 365 }
```

```javascript
// CORRECT — request only what you need, reasonable expiry
config: { allowedIntents: ['utxo_read', 'swap'], expiresInDays: 7 }
```

---

### Mistake 7: Using Totem as a Balance Oracle

```javascript
// WRONG — reading balance out of TOTEM_GET_ACCOUNTS or subscribing to wallet events
//         for balance display. Totem's internal cache is not a public dApp API surface.

// Do NOT read a balance field from the TOTEM_GET_ACCOUNTS response.
// Do NOT subscribe to internal extension events to drive balance UI.
// Both patterns depend on an undocumented internal cache that may be "0" or stale.
```

```javascript
// CORRECT — fetch balance and portfolio from the Axia API through your backend
const acct = await provider.request({ method: 'TOTEM_GET_ACCOUNTS', params: { origin } });
const address = acct.accounts[0].address;

// Your backend proxies GET https://api.axia.to/v1/{projectId}/portfolio/:address
const portfolio = await fetch(`/api/portfolio/${address}`).then(r => r.json());
setPortfolio(portfolio.data);

// For live updates, use Axia WebSocket (see §5.2) — not wallet events
```

---

## 17. Source File Reference

All paths are relative to the monorepo root.

| Component | File |
|-----------|------|
| Script type definitions (SDK canonical) | `packages/totem-sdk/packages/core/src/scripts/types.ts` |
| Script type definitions (extension) | `packages/totem-extension/src/core/transaction/types/ScriptTypes.ts` |
| Contract helper classes (SDK canonical) | `packages/totem-sdk/packages/core/src/scripts/contract-helpers.ts` |
| Contract helper classes (extension) | `packages/totem-extension/src/core/transaction/helpers/ContractHelpers.ts` |
| Witness serializer (SDK) | `packages/totem-sdk/packages/core/src/scripts/witness-serializer.ts` |
| Transaction builder | `packages/totem-extension/src/core/transaction/MinimaTransactionBuilder.ts` |
| Coin selection | `packages/totem-extension/src/core/transaction/CoinSelectionService.ts` |
| Transaction service | `packages/totem-extension/src/core/transaction/service.ts` |
| Wallet & TreeKey management | `packages/totem-extension/src/core/wallet.ts` |
| TreeKey implementation | `packages/totem-sdk/packages/core/src/treekey.ts` |
| WOTS implementation | `packages/totem-sdk/packages/core/src/wots.ts` |
| Serialization (Streamable) | `packages/totem-sdk/packages/core/src/Streamable.ts` |
| Watermark store | `packages/totem-extension/src/core/stores/WatermarkStore.ts` |
| Lease store | `packages/totem-extension/src/core/stores/LeaseStore.ts` |
| Connected sites / DApp permissions | `packages/totem-extension/src/core/stores/ConnectedSitesStore.ts` |
| Script catalog | `packages/totem-extension/src/core/transaction/services/ScriptCatalog.ts` |
| Background handler | `packages/totem-extension/src/background/index.ts` |
| Provider (injected into page) | `packages/totem-extension/src/provider.ts` |
| Content script (bridge) | `packages/totem-extension/src/content-script.ts` |
| Challenge builder | `packages/totem-extension/src/core/verify/ChallengeBuilder.ts` |
| Balance stream manager | `packages/totem-extension/src/core/balance/BalanceStreamManager.ts` |

> **SDK Porting Note (2026-02-16):** ScriptTypes, ContractHelpers, WitnessSerializer, and DApp transaction intent types have been ported to `@totemsdk/core` in `packages/totem-sdk/packages/core/src/scripts/`. The SDK versions are canonical. The extension retains its own copies for build compatibility.

---

## 18. Related Documentation

- **[TOTEM_WALLET_SPEC.md](../src/core/transaction/TOTEM_WALLET_SPEC.md)** — Wallet internals: BIP39 seed derivation, per-address TreeKey construction, WOTS key generation, and MMR tree structure. Read this if you need to understand address derivation to debug coin ownership validation errors.

---

## 19. Version History

| Version | Date | Changes |
|---------|------|---------|
| 4.2.1 | 2026-05-23 | **TOTEM_PROVE_OWNERSHIP + TOTEM_GET_WALLET_MODE added.** Two new Root Identity methods complete the action layer for RootTree wallets. `TOTEM_PROVE_OWNERSHIP` accepts `{ childIndices: number[] }`, shows a consent popup listing the child addresses, and returns an `OwnershipProof` object (or rejects with `WALLET_MODE_MISMATCH` for AnonTree wallets). `TOTEM_GET_WALLET_MODE` returns `{ walletMode }` for origins that have already connected. `provider.proveOwnership(childIndices)` and `provider.getWalletMode()` convenience wrappers added to the provider. The `POST /api/auth/verify-ownership` endpoint is added to the dApp Starter backend, calling `RootIdentityWallet.verifyOwnershipProof(proof)` from `@totemsdk/root-identity` (pure crypto, no network access). A `ProveOwnership` component is added to the dApp Starter Dashboard, gated by `<RootIdGate>`, demonstrating the full detect → request → verify round-trip. Extension webpack build updated with a new `prove-ownership` entry point and HTML popup. |
| 4.1.1 | 2026-05-03 | **TOTEM_VERIFY now signs from the spend address (breaking).** The reserved auth-address slot (index 63) is retired — `TOTEM_VERIFY` signs the challenge with the connected spend address's per-address TreeKey, so `verification.publicKey` is the spend address's root public key and `deriveAddress(publicKey) === verification.address` holds. The `authKeyIndex` field is removed from the response. Backends migrate from the low-level `verifyTreeSignatureDetailed(pubkey, digest, parsedSig)` to the high-level `verifySignatureDetailed(address, message, signature, publicKey)` one-liner — the address↔publicKey binding check now passes on every valid proof, eliminating the recurring "valid v4 proof rejected" integration bug. The transaction-signing guard rejecting address index 63 is also removed (no indices are reserved). Coordinated change across `totem-extension` (`background/index.ts`), `@totem/sdk-connect` (`TotemVerifyResponse.authKeyIndex` removed), `axia-homepage-vite` Developers page, `docs/totem-connect-integration-guide.md`, and `packages/totem-dapp-starter` (`/api/auth/verify` + tests + README). |
| — | 2026-05-03 | **Docs clarification (no version bump).** §4.3 (TOTEM_VERIFY) now carries an explicit "Common pitfall" callout warning that `verification.publicKey` is the auth key's root public key (address index 63) while `verification.address` is the user's connected spend address — the two derive to different Minima addresses by design. Server implementers must verify the signature against the returned `publicKey` and check `authKeyIndex === 63`, and must **not** derive a Minima address from `publicKey` and compare it to `address`. Same wording mirrored into `docs/totem-connect-integration-guide.md`, `axia-homepage-vite` Developers page, and the `totem-dapp-starter` README + `/api/auth/verify` comments to prevent the recurring "valid v4 proof rejected" integration bug. (Superseded by 4.1.1 — proofs now sign from the spend address.) |
| 4.2.0 | 2026-05-03 | **Project-scoped REST.** All consumer REST endpoints moved from flat `/v1/<resource>` to project-scoped `/v1/{projectId}/<resource>`: portfolio, price, balance (single + bulk), megammr/history, indexer/utxos, tx/minepost, and the full DEX surface (ob/*, amm/*, intents/verify). Legacy flat URLs return `410 Gone` with a JSON migration hint. Auth model swapped from `x-api-key` to `x-axia-project-secret` (private projects only — public projects need no auth header). The `/v1/wallet/ws-token` mint and `/v1/wallet/balance/ws` WebSocket stream remain at flat paths (they use Totem's own projectId-based auth and are exempt from the project middleware). The legacy `x-api-key` header continues to work for the JSON-RPC surface at `https://rpc.axia.to/v1/{projectId}` only. §13 rewritten end-to-end; backend proxy example, all REST URL shapes, the Common Mistake 2 snippet, and the Security Checklist updated. |
| 4.1.0 | 2026-04-30 | **WOTS auth separation + session tokens.** `TOTEM_VERIFY` now always signs from reserved auth address index 63 (`TOTEM_AUTH_ADDRESS_INDEX`), not the spend address — auth leaf consumption never erodes spending capacity. Transaction signing path guards against index 63. `authKeyIndex` field added to `TotemVerifyResponse`. Server-side session token contract introduced (§4.3.1): POST `/api/auth/verify` mints a 24-hour HMAC-SHA256 JWT; `GET /api/auth/session` and `POST /api/auth/refresh` let clients skip `TOTEM_VERIFY` on subsequent connects (up to 7-day max-lifetime). dApp `TotemProvider` gates `TOTEM_VERIFY` behind a session check — WOTS signing only triggered on first login, explicit logout, or session expiry. |
| 4.0.0 | 2026-04-30 | **Wallet-consent principle enforced throughout.** Totem is now documented strictly as a consent/signing standard; the Axia API is the data layer. All balance-oracle patterns removed: `balance` field removed from `TOTEM_GET_ACCOUNTS` response; `balanceChanged` removed as a dApp event (§5.2 replaced with Axia REST/WS guidance); Quick Start step 3 updated; Complete Working Example updated; `TOTEM_GET_COINS` reframed as tx-construction-only query. React `TotemProvider` no longer holds `balance` state or `balanceChanged` subscription — `useAxiaPortfolio(address)` hook added. Security Checklist updated; Common Mistake 7 replaced with "Using Totem as a balance oracle". `TOTEM_CONNECT_APPROVE` row removed from Allowed Methods table (internal-only note retained). `GET /v1/portfolio/:address` documented in §13 with meta shape; Portfolio Dashboard Pattern rewritten. Consent Principle section added to §1. |
| 3.0.0 | 2026-04-30 | Amalgamated from three source documents (`DAPP_BUILDER_GUIDE.md` v1.0.0, `TOTEM_CONNECT_SPEC.md` v2.6.0, `TOTEM_TX_SPEC.md` v2.3.0). Resolved all 7 known drift/gap areas: added `balanceChanged` event (§5.2), corrected unsubscribe method to `removeListener` throughout, added TOTEM_GET_ACCOUNTS cold-cache caveat (§4.4), reconciled ScriptType count to 13 (§11.13), added TOTEM_WALLET_SPEC.md reference (§18), added complete TOTEM_DISCONNECT schema and side-effects (§4.2), added DEX deprecation callout (§13). Added Common Mistake 7 (§16). Added `BalanceStreamManager` to Source File Reference. Removed internal React integration duplication. |
| 2.6.0 | 2026-04-21 | (TOTEM_CONNECT_SPEC) Fixed `TOTEM_GET_ACCOUNTS` to return live balance from `BalanceStreamManager` cache. Added `balanceChanged` event. |
| 2.5.0 | 2026-03-11 | (TOTEM_CONNECT_SPEC) Added `TOTEM_DISCONNECT` method. |
| 2.4.0 | 2026-03-08 | (TOTEM_CONNECT_SPEC) Added React Integration section. |
| 2.3.0 | 2026-03-08 | (TOTEM_TX_SPEC) Added Token and NFT Sends section. |
| 2.3.0 | 2026-03-07 | (TOTEM_CONNECT_SPEC) Added Connect + Verify atomic step guidance. |
| 2.2.0 | 2026-02-18 | (TOTEM_TX_SPEC) Corrected WOTS proof count to 3. Added DApp Provider API section. |
| 2.2.0 | 2026-02-17 | (TOTEM_CONNECT_SPEC) Removed MiniMask references. Added origin auto-injection. |
| 2.0.0 | 2026-02-12 | (TOTEM_CONNECT_SPEC) Added TOTEM_GET_COINS, TOTEM_SEND_COMPLEX (all 13 contract types), TOTEM_SIGN_DATA. |
| 2.0.0 | 2026-02-10 | (TOTEM_TX_SPEC) Complete rewrite: all 13 contract types, per-address TreeKey architecture. |
| 1.4.0 | 2026-02-12 | (TOTEM_CONNECT_SPEC) Made TOTEM_VERIFY mandatory before TOTEM_GET_ACCOUNTS. |
| 1.0.0 | 2026-03-11 | (DAPP_BUILDER_GUIDE) Initial developer guide. |
| 1.0.0 | 2026-01-12 | (TOTEM_CONNECT_SPEC) Initial specification. |
| 1.0.0 | 2025-12-01 | (TOTEM_TX_SPEC) Initial draft. |

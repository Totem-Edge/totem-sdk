# Totem SDK Integration Guide

A developer guide for integrating Totem wallet authentication and signature verification into your application.

---

## 1. Getting Started

### Installation

```bash
pnpm install @totemsdk/core @noble/hashes
```

> **Requirement:** Node.js >= 16.0.0

### Quick Import

```typescript
import {
  verifySignature,
  verifySignatureDetailed,
  deriveAddressFromPublicKey,
  createChallenge,
  validateChallenge,
  normalizeHex
} from '@totemsdk/core';
```

---

## 2. Hex Encoding Conventions

All hex values in the SDK use **lowercase** without the `0x` prefix.

```
"2a09d9d9523d11d52d81b9431b5d27a1909b16de85f5d0d2f55faf2566afc553"
```

Not:

```
"0x2A09D9D9523D11D52D81B9431B5D27A1909B16DE85F5D0D2F55FAF2566AFC553"
```

The SDK provides `normalizeHex()` for defensive hex handling — it strips the `0x` prefix if present and returns the lowercase hex string:

```typescript
import { normalizeHex } from '@totemsdk/core';

normalizeHex('0x2A09D9D9523D...');
// → "2a09d9d9523d..."

normalizeHex('2a09d9d9523d...');
// → "2a09d9d9523d..." (no-op)
```

When sending hex values between frontend and backend, always use lowercase no-prefix format. The `verifySignature` and `verifySignatureDetailed` functions handle normalization internally, but consistent formatting avoids confusion.

---

## 3. Server-Side Signature Verification (Full Round-Trip)

This section shows the complete authentication flow: a browser-based frontend connects to the Totem Wallet extension, requests a signature on a server-issued challenge, and sends it to the backend for verification.

### Frontend (Browser with Totem Wallet)

```typescript
// 1. Connect to wallet — origin is required
const connection = await provider.request({
  method: 'TOTEM_CONNECT',
  params: { origin: window.location.origin }
});
// Returns: { connected: true, address: string, addressIndex: number }

// 2. Get a challenge from your server
const { message: challenge } = await fetch('/api/auth/challenge').then(r => r.json());

// 3. Request signature from wallet
const signResult = await provider.request({
  method: 'TOTEM_VERIFY',
  params: {
    origin: window.location.origin,
    challenge: { statement: challenge }
  }
});
// v4.1 returns: { verified: true, verificationId, address, message, signature, publicKey, expiresAt }
// publicKey is the spend address's root public key, so deriveAddressFromPublicKey(publicKey) === address.

// 4. Send to server for verification
const verified = await fetch('/api/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: signResult.address,
    publicKey: signResult.publicKey,
    signature: signResult.signature,
    message: challenge
  })
}).then(r => r.json());
```

> **Tip:** Use `@totem/connect` for typed wrappers — `connect(origin)` and `verify(origin, { statement })` — instead of calling `provider.request` directly.

### Backend (Node.js)

```typescript
import {
  verifySignatureDetailed,
  createChallenge,
  validateChallenge
} from '@totemsdk/core';

// Challenge endpoint
app.get('/api/auth/challenge', (req, res) => {
  const challenge = createChallenge('myapp.com');
  // Store challenge in session for replay protection
  req.session.challenge = challenge;
  res.json({ message: challenge });
});

// Verify endpoint
app.post('/api/auth/verify', (req, res) => {
  const { address, publicKey, signature, message } = req.body;

  // 1. Validate challenge hasn't expired
  const challengeResult = validateChallenge(message, {
    maxAgeMs: 5 * 60 * 1000,        // 5 minutes
    expectedDomain: 'myapp.com'
  });
  if (!challengeResult.valid) {
    return res.status(400).json({ error: challengeResult.error });
  }

  // 2. Verify signature (one-liner!)
  const result = verifySignatureDetailed(address, message, signature, publicKey);
  if (!result.valid) {
    return res.status(401).json({ error: result.error });
  }

  // 3. Address is verified — create session
  req.session.address = address;
  res.json({ verified: true, address });
});
```

`verifySignatureDetailed` performs all of the following in one call:
1. Hex normalization of the public key and signature
2. Address derivation from the public key (and comparison against the claimed address)
3. Deserialization of the tree signature
4. SHA3-256 digest computation of the message
5. WOTS signature verification at every depth of the tree

---

## 4. API Reference

### `verifySignature(address, message, signatureHex, publicKeyHex): boolean`

One-liner verification. Returns `true` if the signature is valid and the public key matches the claimed address, `false` otherwise.

```typescript
const ok = verifySignature(address, message, signatureHex, publicKeyHex);
```

Internally handles hex normalization, SHA3-256 digest computation, tree signature deserialization, and address-to-pubkey validation.

---

### `verifySignatureDetailed(address, message, signatureHex, publicKeyHex): VerificationResult`

Same verification logic as `verifySignature`, but returns a structured result for debugging:

```typescript
interface VerificationResult {
  valid: boolean;
  error?: string;  // Human-readable reason when valid === false
}
```

Example error messages:
- `"Public key must be 32 bytes (64 hex chars), got 20 bytes"`
- `"Public key does not match claimed address. Expected MxG08..., derived MxG09..."`
- `"WOTS signature verification failed at depth 1 (digest mismatch or corrupted signature)"`

---

### `deriveAddressFromPublicKey(publicKeyHex): string`

Derive the Minima address from a 32-byte public key hex string. Use this to independently verify that a public key matches a claimed address.

```typescript
const address = deriveAddressFromPublicKey(
  '2a09d9d9523d11d52d81b9431b5d27a1909b16de85f5d0d2f55faf2566afc553'
);
// → "MxG08..."
```

Throws if the public key is not exactly 32 bytes (64 hex characters).

---

### `normalizeHex(hex): string`

Strip the `0x` prefix if present. Use for defensive hex handling when receiving values from external sources.

```typescript
normalizeHex('0xabcdef'); // → "abcdef"
normalizeHex('abcdef');   // → "abcdef"
```

---

### `createChallenge(domain, nonce?): string`

Create a JSON challenge string with domain, nonce, and timestamp for replay protection.

```typescript
const challenge = createChallenge('myapp.com');
// → '{"domain":"myapp.com","nonce":"a1b2c3d4e5f6","issuedAt":1700000000000}'
```

If `nonce` is omitted, a random nonce is generated automatically. The returned string is meant to be sent to the client for signing.

---

### `validateChallenge(challenge, options?): VerificationResult`

Validate a challenge string for freshness and domain binding.

```typescript
const result = validateChallenge(challengeString, {
  maxAgeMs: 5 * 60 * 1000,       // Default: 5 minutes
  expectedDomain: 'myapp.com'     // Optional domain check
});

if (!result.valid) {
  console.error(result.error);
  // e.g. "Challenge expired: 312s old (max 300s)"
  // e.g. "Domain mismatch: expected myapp.com, got evil.com"
}
```

---

### `verifyTreeSignatureDetailed(pubkey, data, signature): VerificationResult`

Low-level tree signature verification with error reporting. Most integrators should use `verifySignatureDetailed` instead — this function is for advanced use cases where you already have the raw public key bytes, pre-computed data digest, and deserialized `TreeSignature` object. **For TOTEM_VERIFY proofs (v4.1+), always prefer `verifySignatureDetailed(address, message, signature, publicKey)`** — it covers the address↔publicKey binding and the WOTS check in a single call, which is the contract the Totem extension and starter dApp now rely on.

```typescript
import { verifyTreeSignatureDetailed } from '@totemsdk/core';

const result = verifyTreeSignatureDetailed(pubkeyBytes, digestBytes, treeSignature);
```

---

## 5. TreeSignature Format Specification

This section describes the internal structure of signatures produced by the Totem Wallet. You do not need to understand this to use the SDK — `verifySignature` handles it all — but it is useful for debugging, building custom tooling, or implementing verification in another language.

### Structure Overview

A `TreeSignature` contains N `SignatureProof` objects. In production, N = 3, forming a chain:

```
Root key → signs L1 key
  L1 key → signs L2 key
    L2 key → signs the actual data digest
```

### SignatureProof

Each `SignatureProof` contains:

| Field | Size | Description |
|---|---|---|
| `leafPubkey` | 32 bytes | WOTS public key digest (SHA3-256 of the full 1088-byte public key) |
| `signature` | 1088 bytes | WOTS signature (34 chains × 32 bytes each) |
| `mmrProof` | Variable | MMR (Merkle Mountain Range) inclusion proof linking the leaf to its tree node root |

### Key Hierarchy

The signature proves a chain of trust from the root public key down to the data:

1. **Depth 0 (Root):** The root proof's MMR root must match the expected public key. Its WOTS signature signs the L1 node's root public key.
2. **Depth 1 (L1):** Its WOTS signature signs the L2 node's root public key.
3. **Depth 2 (L2):** Its WOTS signature signs the SHA3-256 digest of the actual message data.

### Serialization Format (Java-Compatible)

The wire format is designed for compatibility with Minima's Java implementation:

- **Proof count:** Encoded as a `MiniNumber` (1 scale byte + 1 length byte + N data bytes)
- **Each proof:**
  - `MiniData(leafPubkey)` — 4-byte big-endian length prefix + raw bytes
  - `MiniData(signature)` — 4-byte big-endian length prefix + raw bytes
  - `MMRProof` — serialized MMR inclusion proof (variable length)

### WOTS Parameters

| Parameter | Value | Description |
|---|---|---|
| w | 8 | 8 bits per digit (each byte is one digit, range 0–255) |
| n | 32 | Hash output size in bytes (SHA3-256) |
| Message chains | 32 | One chain per byte of the 32-byte digest |
| Checksum chains | 2 | Integrity check over the message digits |
| Total chains (L) | 34 | 32 message + 2 checksum |
| Max chain length | 255 | Each chain is hashed 0 to 255 times (2^w − 1) |
| Signature size | 1088 bytes | 34 chains × 32 bytes |

---

## 6. Session/Nonce Replay Protection

To prevent replay attacks, follow this pattern:

1. **Server creates a challenge** using `createChallenge(domain)`. This embeds the domain, a random nonce, and the current timestamp.

2. **Store the challenge** in the user's session or a database, keyed by the nonce.

3. **Client signs the challenge** string using the Totem Wallet (`TOTEM_VERIFY`).

4. **Server validates freshness** with `validateChallenge()` before verifying the signature. This checks timestamp expiry and domain binding.

5. **Mark the challenge as used** — delete it from the session/DB after successful verification to prevent replay.

### Example with Session Store

```typescript
app.get('/api/auth/challenge', (req, res) => {
  const challenge = createChallenge('myapp.com');
  req.session.pendingChallenge = challenge;
  res.json({ message: challenge });
});

app.post('/api/auth/verify', (req, res) => {
  const { address, publicKey, signature, message } = req.body;

  // Check this challenge was issued by us
  if (req.session.pendingChallenge !== message) {
    return res.status(400).json({ error: 'Unknown challenge' });
  }

  // Validate freshness
  const challengeResult = validateChallenge(message, {
    maxAgeMs: 5 * 60 * 1000,
    expectedDomain: 'myapp.com'
  });
  if (!challengeResult.valid) {
    return res.status(400).json({ error: challengeResult.error });
  }

  // Verify signature
  const result = verifySignatureDetailed(address, message, signature, publicKey);
  if (!result.valid) {
    return res.status(401).json({ error: result.error });
  }

  // Mark challenge as used (prevent replay)
  delete req.session.pendingChallenge;

  req.session.address = address;
  res.json({ verified: true, address });
});
```

### Timestamp-Based vs Nonce-Based Expiry

`createChallenge` uses **both** approaches:

- **Timestamp-based:** The `issuedAt` field enables `validateChallenge()` to reject expired challenges (default: 5 minutes). This is simple and stateless on the server side.
- **Nonce-based:** The `nonce` field provides a unique identifier. By storing and checking nonces server-side, you get stronger replay protection — even if the timestamp is still valid, a reused nonce is rejected.

For most applications, combining both approaches (as shown above) provides the best security. If you cannot maintain server-side state (e.g., serverless functions), timestamp-based expiry alone is acceptable for low-risk scenarios.

---

## 7. Test Vectors

The package ships with `test-vectors.json` containing pre-computed WOTS signatures for verification testing.

### Location

```
@totemsdk/core/test-vectors.json
```

### Using Test Vectors

```typescript
import vectors from '@totemsdk/core/test-vectors.json';
import { wotsVerify } from '@totemsdk/core';
import { sha3_256 } from '@noble/hashes/sha3';

for (const vector of vectors.vectors) {
  if (!vector.shouldVerify) continue;

  // 1. Compute SHA3-256 of the message
  const digest = sha3_256(new TextEncoder().encode(vector.message));
  const digestHex = Array.from(digest).map(b => b.toString(16).padStart(2, '0')).join('');

  // 2. Verify digest matches expected
  console.assert(digestHex === vector.digestHex, 'Digest mismatch');

  // 3. Verify WOTS signature
  const sigBytes = Uint8Array.from(
    vector.signatureHex.match(/.{2}/g)!.map(h => parseInt(h, 16))
  );
  const digestBytes = Uint8Array.from(
    vector.digestHex.match(/.{2}/g)!.map(h => parseInt(h, 16))
  );
  const pubkeyBytes = Uint8Array.from(
    vector.publicKeyFullHex.match(/.{2}/g)!.map(h => parseInt(h, 16))
  );

  const ok = wotsVerify(sigBytes, digestBytes, pubkeyBytes);
  console.assert(ok, `Vector "${vector.description}" failed`);
}
```

### Vector Format

Each test vector contains:

| Field | Description |
|---|---|
| `message` | The original plaintext message |
| `digestHex` | Expected SHA3-256 hash of the message (lowercase, no prefix) |
| `publicKeyFullHex` | Full 1088-byte WOTS public key (34 × 32 bytes) |
| `publicKeyDigestHex` | 32-byte SHA3-256 digest of the full public key |
| `signatureHex` | Raw WOTS signature bytes (1088 bytes) |
| `keyIndex` | Which key index was used to sign |
| `shouldVerify` | Whether this vector should pass verification |

---

## 8. Compatibility

| Environment | Supported | Notes |
|---|---|---|
| Node.js >= 16 | Yes | Full support |
| Browser (modern) | Yes | Via bundler (Webpack, Vite, esbuild) |
| React Native | Untested | Should work with proper polyfills |
| Deno | Untested | ESM imports should work |

### Dependencies

| Package | Version | Type |
|---|---|---|
| `@noble/hashes` | >= 1.3.0 | Peer dependency (you must install it) |

The SDK uses `@noble/hashes` for SHA3-256 hashing. It is listed as a peer dependency, so you must install it alongside the SDK:

```bash
pnpm install @totemsdk/core @noble/hashes
```

---

## 9. DApp Provider Integration

The Totem Browser Extension announces its provider object via the `totem:announce` CustomEvent. DApps listen for this event to receive the provider and call its JSON-RPC-style `request()` method.

### Detecting the Extension

```javascript
// Option A — WalletDiscovery from @totemsdk/connect (recommended)
import { WalletDiscovery } from '@totemsdk/connect';
const discovery = new WalletDiscovery();
discovery.onChange((wallets) => {
  if (wallets.length >= 1) {
    const provider = wallets[0].provider;
    console.log('Totem detected:', wallets[0].info.name);
  }
});

// Option B — raw event (no SDK dependency)
let provider = null;
window.addEventListener('totem:announce', (event) => {
  provider = event.detail.provider;
  console.log('Totem ready');
});
window.dispatchEvent(new CustomEvent('totem:requestAnnounce'));
```

### RPC Contract

```typescript
// All requests follow this shape
const result = await provider.request({
  method: 'TOTEM_METHOD_NAME',
  params: { origin: window.location.origin, /* method-specific params */ }
});
```

On error `request()` throws. On success it returns the result directly. Methods that can partially fail — `TOTEM_SEND_TRANSACTION`, `TOTEM_SEND_COMPLEX`, `TOTEM_GET_COINS`, `TOTEM_SIGN_DATA`, `TOTEM_BROADCAST_HEX` — include a `success` boolean inside the result; always check it.

```javascript
try {
  const result = await provider.request({ method: 'TOTEM_CONNECT', params: { origin: location.origin } });
} catch (err) {
  console.error('Rejected or errored:', err.message);
}
```

### Convenience Wrappers

The extension exposes shorthand methods that call the underlying `TOTEM_*` methods and inject `origin` automatically.

| Wrapper | Calls | Parameters |
|---------|-------|------------|
| `provider.enable()` | `TOTEM_CONNECT` | none |
| `provider.getCoins(params?)` | `TOTEM_GET_COINS` | `{ tokenId?, address?, minAmount? }` |
| `provider.sendComplex(params, mode?)` | `TOTEM_SEND_COMPLEX` | `EnhancedBuildParams`, mode `'submit'` (default) or `'build'` |
| `provider.broadcastHex(params)` | `TOTEM_BROADCAST_HEX` | `{ signedHex, expectedDigestTx? }` |
| `provider.signData(params)` | `TOTEM_SIGN_DATA` | `{ unsignedHex, inputAddresses[], inputIndices?, returnFormat? }` |
| `provider.send(method, params?)` | any method | method name + optional args array |

---

## 10. TOTEM Methods Reference

Full request/response shapes and error codes are in [`TOTEM_CONNECT.md`](../../../../totem-extension/docs/TOTEM_CONNECT.md) (canonical). This section is a concise reference for all 12 dApp-callable methods.

---

### TOTEM_CONNECT

Establishes a connection between the dApp and the wallet. On first visit, shows an address picker popup. On return visits, silently reconnects to the previously selected address.

```javascript
const conn = await provider.request({
  method: 'TOTEM_CONNECT',
  params: { origin: window.location.origin }
});
// { connected: true, address: 'Mx...', addressIndex: 0, publicKey: '...' }
```

> **Always call `TOTEM_VERIFY` immediately after** — see below.

---

### TOTEM_VERIFY

Proves cryptographic ownership of the connected address by signing a challenge with a WOTS tree signature. **Consumes one WOTS leaf** from the address's signing key pool (262,144 total per address).

```javascript
const proof = await provider.request({
  method: 'TOTEM_VERIFY',
  params: {
    origin: window.location.origin,
    challenge: { statement: 'Sign in to MyApp' }
  }
});
// v4.1 → { verified: true, verificationId, address: 'Mx...', message: '...',
//          signature: '...', publicKey: '...', expiresAt }
//
// As of v4.1 the proof signs from the connected spend address (no reserved
// auth-key slot), so `deriveAddressFromPublicKey(publicKey) === address`
// holds and backends should use the high-level `verifySignatureDetailed`
// one-liner shown in Section 3.
```

Send `signature`, `publicKey`, and `statement` to your backend and verify using `verifySignatureDetailed()` from `@totemsdk/core` (see Section 3).

> **Connect + Verify are one atomic step.** Call `TOTEM_VERIFY` immediately and automatically after `TOTEM_CONNECT` resolves, with no intermediate UI between them. Users expect to be signed in the moment they pick their address.

> **Security:** Without `TOTEM_VERIFY`, anyone can supply another user's public address during connect. Never grant access to account data until ownership is proved.

> **Challenge expiry:** Challenges expire after 5 minutes. The extension rejects signing if the challenge expires before or after approval.

---

### TOTEM_GET_ACCOUNTS

Returns the connected account's address, public key, and balance. Call only after a successful `TOTEM_VERIFY`.

```javascript
const { accounts } = await provider.request({
  method: 'TOTEM_GET_ACCOUNTS',
  params: { origin: window.location.origin }
});
// accounts: [{ address: 'Mx...', publicKey: '...', balance: '10.5', addressIndex: 0 }]
```

---

### TOTEM_GET_COINS

Query the wallet's spendable UTXOs. Requires the `utxo_read` intent (grant via `TOTEM_GRANT_TX_PERMISSION`).

```javascript
const { success, coins } = await provider.request({
  method: 'TOTEM_GET_COINS',
  params: {
    origin: window.location.origin,
    tokenId: '0x00',   // optional — filter by token
    minAmount: '1.0'   // optional — minimum coin value
  }
});
// coins: [{ coinId, address, amount, tokenId, created }]
```

Use returned `coinId` values as inputs to `TOTEM_SEND_COMPLEX`.

---

### TOTEM_SEND_TRANSACTION

Simple send — native Minima or any token. Coin selection and signing are handled automatically. Shows a user approval popup.

```javascript
// Native Minima
const tx = await provider.request({
  method: 'TOTEM_SEND_TRANSACTION',
  params: {
    origin: window.location.origin,
    request: {
      version: 1,
      intent: 'send',
      outputs: [{ address: 'Mx...recipient', amount: '1.0', tokenId: '0x00' }]
    }
  }
});
// { success: true, txpowid: '...', status: 'submitted' }

// Custom token — same shape, different tokenId and intent
const tokenTx = await provider.request({
  method: 'TOTEM_SEND_TRANSACTION',
  params: {
    origin: window.location.origin,
    request: {
      version: 1,
      intent: 'token_send',
      outputs: [{ address: 'Mx...recipient', amount: '100', tokenId: '0xABC123...' }]
    }
  }
});
```

Requires the `send` intent for native Minima or `token_send` for custom tokens. Both are granted via `TOTEM_GRANT_TX_PERMISSION`.

---

### TOTEM_SEND_COMPLEX

Build and/or submit advanced transactions using any of Minima's 13 contract types. Accepts full `ScriptDescriptor` structures on each input.

**Two modes:**

| Mode | Behaviour |
|------|-----------|
| `submit` (default) | Builds, signs, and broadcasts. Returns `txpowid`. WOTS keys consumed. |
| `build` | Builds the unsigned blob only. Returns `unsignedHex`, `digestTx`, `plan`, `inputCoinProofs`, `scriptDescriptors`, `chainId`, `blobHash`. No keys consumed. |

```javascript
// Submit — exchange offer claim
const tx = await provider.request({
  method: 'TOTEM_SEND_COMPLEX',
  params: {
    origin: window.location.origin,
    mode: 'submit',
    buildParams: {
      inputs: [{
        coinId: '0x...',
        address: 'Mx...',
        amount: '10',
        scriptDescriptor: {
          scriptType: 'exchange',
          script: 'RETURN SIGNEDBY(...) ...',
          stateVariables: [
            { port: 0, value: '0xOWNERKEY', type: 'hex' },
            { port: 1, value: 'Mx...taker', type: 'hex' }
          ],
          verifyOutExpectations: [{
            inputIndex: '@INPUT',
            outputAddress: 'Mx...taker',
            amount: '10',
            tokenId: '0x00',
            keepState: true
          }]
        }
      }],
      outputs: [{ address: 'Mx...taker', amount: '10' }]
    }
  }
});

// Build — unsigned blob for multisig coordination
const blob = await provider.sendComplex({ inputs: [...], outputs: [...] }, 'build');
// { success: true, mode: 'build', unsignedHex: '...', digestTx: '...', blobHash: '...' }
```

**Supported `scriptType` values:**

| scriptType | Contract Pattern |
|------------|-----------------|
| `signedby` | `RETURN SIGNEDBY(pubkey)` |
| `multisig` | `RETURN SIGNEDBY(pk1) AND SIGNEDBY(pk2)` |
| `multisig_mofn` | `RETURN MULTISIG(M pk1 pk2 ...)` |
| `timelock` | `RETURN SIGNEDBY(pk) AND @BLOCK GT n` |
| `htlc` | Hashed Timelock Contract (claim or refund paths) |
| `mast` | `MAST 0x<ROOT_HASH>` |
| `exchange` | DEX offer with `VERIFYOUT` assertions |
| `vault` | Cold/hot key covenant with safe house |
| `flashcash` | Flash loan with same-transaction repayment |
| `slowcash` | Rate-limited withdrawal |
| `stateful` | Multi-round state machine |
| `custom` | Arbitrary Minima script |

See [`TOTEM_CONNECT.md`](../../../../totem-extension/docs/TOTEM_CONNECT.md) §11–§12 for complete `ScriptDescriptor` field documentation per contract type.

**Intent auto-detection:**

| Input `scriptType` | Detected Intent |
|-------------------|-----------------|
| `multisig`, `multisig_mofn` | `multisig` |
| `htlc` | `htlc` |
| `exchange` | `swap` |
| `mast` | `contract_call` |
| All others | `complex_send` |

The granted intent must include either the specific detected intent or `complex_send` (catch-all).

**`blobHash` integrity:** In build mode, `blobHash = sha3_256(canonical_json({ unsignedHex, digestTx, inputCoinProofs, scriptDescriptors, chainId }))` where `canonical_json` recursively sorts all object keys. Verify this hash at every stage of multisig coordination to detect proof or script swap attacks.

---

### TOTEM_BROADCAST_HEX

Broadcast a fully-signed transaction hex blob to the network. Requires the `broadcast_tx` intent. Shows an approval popup with a digest preview.

```javascript
const result = await provider.broadcastHex({
  signedHex: '0xABC...',
  expectedDigestTx: '...'  // optional — verifies digest before broadcasting
});
// { success: true, txpowid: '...' }
```

> **Lease guidance:** For multisig transactions with active Axia leases, prefer the Axia `/broadcast` endpoint, which atomically marks leases as `USED`. If you use `TOTEM_BROADCAST_HEX` instead, also call Axia `/broadcast` afterward so leases don't remain in `SIGNED` status permanently.

---

### TOTEM_SIGN_DATA

Produce a partial WOTS signature over an unsigned transaction blob without broadcasting. Designed for multisig coordination where each signer contributes independently.

**`inputAddresses` is mandatory.** This prevents blind-signing attacks by requiring the dApp to explicitly declare which addresses the wallet should sign for. The wallet validates that at least one belongs to it.

```javascript
const sig = await provider.signData({
  unsignedHex: '0xABC...',
  inputAddresses: ['Mx...myAddress'],  // REQUIRED
  inputIndices: [0],                   // optional — specific input indices
  returnFormat: 'hex'                  // 'hex' (default) or 'json'
});
// { success: true, signedHex: '...', signatures: [...], signerAddress: 'Mx...',
//   signerIndex: 0, inputsSigned: [0], status: 'signed' }
```

---

### TOTEM_GRANT_TX_PERMISSION

Grant pre-approved transaction permissions to a dApp for a specific origin. Specifies which intents are allowed, optional per-token spending limits, and an expiry period (default 30 days).

```javascript
await provider.request({
  method: 'TOTEM_GRANT_TX_PERMISSION',
  params: {
    origin: window.location.origin,
    config: {
      allowedIntents: ['send', 'token_send', 'utxo_read', 'complex_send'],
      tokenLimits: [{
        tokenId: '0x00',
        tokenSymbol: 'MINIMA',
        maxAmountPerTx: '10',
        maxDailyAmount: '100'
      }],
      expiresInDays: 30
    }
  }
});
```

**Available intents:**

| Intent | Used By | Description |
|--------|---------|-------------|
| `send` | `TOTEM_SEND_TRANSACTION` | Native Minima sends |
| `token_send` | `TOTEM_SEND_TRANSACTION` | Custom token sends |
| `utxo_read` | `TOTEM_GET_COINS` | Query spendable UTXOs |
| `swap` | `TOTEM_SEND_COMPLEX` | DEX exchange offers |
| `liquidity_add` | `TOTEM_SEND_COMPLEX` | AMM liquidity provision |
| `liquidity_remove` | `TOTEM_SEND_COMPLEX` | AMM liquidity withdrawal |
| `contract_call` | `TOTEM_SEND_COMPLEX` | MAST and custom contracts |
| `multisig` | `TOTEM_SEND_COMPLEX` | Multisig transactions |
| `timelock` | `TOTEM_SEND_COMPLEX` | Timelock spending |
| `htlc` | `TOTEM_SEND_COMPLEX` | HTLC claim/refund |
| `custom` | `TOTEM_SEND_COMPLEX` | Arbitrary custom scripts |
| `complex_send` | `TOTEM_SEND_COMPLEX` | Catch-all for any complex transaction |
| `sign_data` | `TOTEM_SIGN_DATA` | Partial signing for multisig coordination |
| `broadcast_tx` | `TOTEM_BROADCAST_HEX` | Broadcasting pre-signed transaction blobs |

---

### TOTEM_REVOKE_TX_PERMISSION

Remove all transaction permissions for the dApp's origin.

```javascript
await provider.request({
  method: 'TOTEM_REVOKE_TX_PERMISSION',
  params: { origin: window.location.origin }
});
// { success: true }
```

---

### TOTEM_GET_TX_PERMISSIONS

Query all active permission grants, including daily usage counters and expiry dates.

```javascript
const perms = await provider.request({
  method: 'TOTEM_GET_TX_PERMISSIONS',
  params: {}
});
// Array<{
//   origin: string,
//   address: string,            // Mx... format
//   permissions: {
//     grantedAt: number,
//     expiresAt: number,
//     allowedIntents: string[],
//     tokenLimits: [{ tokenId, tokenSymbol, maxAmountPerTx, maxDailyAmount,
//                     dailyUsed, lastResetDate }],
//     totalTransactions: number,
//     lastTransactionAt?: number
//   }
// }>
```

---

### TOTEM_CONNECT_APPROVE

**Internal — not callable by dApps.** Used by the Totem Browser Extension's address picker popup to finalize a pending connection after the user selects an address. Call `TOTEM_CONNECT` instead; it handles this flow automatically.

---

## 11. Permission Lifecycle

```
1. Grant    →  TOTEM_GRANT_TX_PERMISSION
               (specify intents, token limits, expiry — default 30 days)
2. Check    →  Automatic on each TOTEM_SEND_TRANSACTION / TOTEM_SEND_COMPLEX /
               TOTEM_GET_COINS / TOTEM_SIGN_DATA / TOTEM_BROADCAST_HEX
3. Enforce  →  Per-tx amount limit, daily aggregate, intent allowlist, expiry
4. Track    →  dailyUsed resets at midnight, totalTransactions and
               lastTransactionAt updated on each successful send
5. Query    →  TOTEM_GET_TX_PERMISSIONS
6. Revoke   →  TOTEM_REVOKE_TX_PERMISSION
```

Even with permissions granted, all security-sensitive operations (sends, signing, broadcasting) still show user approval popups.

---

## 12. Security Model

### Origin Binding

All connections and permissions are keyed to the requesting origin (`window.location.origin`). A connection from `https://app1.com` cannot be used by `https://app2.com`, and the injected origin cannot be spoofed by page code.

### Address Format

All provider methods that return an `address` normalize to **Mx format** (Minima Base32, e.g. `MxG0B4TA7UD5AM2J...`). Input parameters that accept an address accept both `Mx...` and `0x...` hex format — the wallet converts internally. Use simple string equality to compare addresses returned by different methods.

### Input Ownership Validation

`TOTEM_SEND_COMPLEX` and `TOTEM_SIGN_DATA` both require at least one transaction input to belong to the connected wallet. This prevents dApps from constructing transactions that only spend other users' coins, and is enforced before the approval popup is shown.

### WOTS Key Consumption

Each `TOTEM_VERIFY` call consumes one WOTS leaf. Each address holds 262,144 signing slots (64 × 64 × 64). The wallet's `WatermarkStore` enforces strict monotonic advancement — a used leaf can never be reused. The approval popup for `TOTEM_VERIFY` warns users when key usage is elevated.

### Challenge Expiry

`TOTEM_VERIFY` challenges expire after 5 minutes by default. The extension checks expiry on receipt and again immediately before signing, rejecting the request if expired at either point.

### Connection Persistence

Connections persist across browser sessions via Chrome storage. Users can disconnect sites and revoke all permissions at any time from the Totem Browser Extension settings panel.

---

## 13. Complete Integration Example

```javascript
class TotemIntegration {
  constructor() {
    this.address = null;
    this.connected = false;
    this.verified = false;
  }

  async init() {
    // Obtain provider via totem:announce discovery
    this._provider = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Totem not detected')), 3000);
      window.addEventListener('totem:announce', (event) => {
        clearTimeout(t);
        resolve(event.detail.provider);
      }, { once: true });
      window.dispatchEvent(new CustomEvent('totem:requestAnnounce'));
    });
  }

  // Connect and verify are always called together as one atomic step
  async connectAndVerify(statement = 'Sign in') {
    const conn = await provider.request({
      method: 'TOTEM_CONNECT',
      params: { origin: location.origin }
    });
    const proof = await provider.request({
      method: 'TOTEM_VERIFY',
      params: { origin: location.origin, challenge: { statement } }
    });
    this.address = proof.address;
    this.connected = true;
    this.verified = true;
    // Send proof.signature + proof.publicKey + statement to your backend
    // and verify with verifySignatureDetailed() from @totemsdk/core
    return proof;
  }

  async getAccount() {
    if (!this.verified) throw new Error('Must verify first');
    const { accounts } = await provider.request({
      method: 'TOTEM_GET_ACCOUNTS',
      params: { origin: location.origin }
    });
    return accounts[0];
  }

  async grantPermissions() {
    return provider.request({
      method: 'TOTEM_GRANT_TX_PERMISSION',
      params: {
        origin: location.origin,
        config: {
          allowedIntents: [
            'send', 'token_send', 'utxo_read',
            'complex_send', 'sign_data', 'broadcast_tx'
          ],
          expiresInDays: 30
        }
      }
    });
  }

  async sendMinima(toAddress, amount) {
    return provider.request({
      method: 'TOTEM_SEND_TRANSACTION',
      params: {
        origin: location.origin,
        request: { version: 1, outputs: [{ address: toAddress, amount, tokenId: '0x00' }] }
      }
    });
  }

  async queryCoins(tokenId = '0x00') {
    return provider.getCoins({ tokenId });
  }

  async buildUnsignedTx(inputs, outputs) {
    return provider.sendComplex({ inputs, outputs }, 'build');
  }

  async signForMultisig(unsignedHex, myAddresses) {
    return provider.signData({ unsignedHex, inputAddresses: myAddresses, returnFormat: 'hex' });
  }

  async broadcast(signedHex, expectedDigestTx) {
    return provider.broadcastHex({ signedHex, expectedDigestTx });
  }
}

// --- Usage ---
const totem = new TotemIntegration();
await totem.init();

// Step 1: Connect + verify (one atomic step — no intermediate UI)
const proof = await totem.connectAndVerify('Sign in to MyDApp');

// Step 2: Access account data (safe only after verification)
const account = await totem.getAccount();
console.log('Address:', account.address, '| Balance:', account.balance);

// Step 3: Grant permissions for advanced operations
await totem.grantPermissions();

// Step 4a: Simple send
await totem.sendMinima('Mx...recipient', '1.0');

// Step 4b: Query UTXOs for complex transaction building
const { coins } = await totem.queryCoins('0x00');

// Step 4c: Build unsigned blob for multisig coordination
const blob = await totem.buildUnsignedTx(
  [{
    coinId: coins[0].coinId,
    address: coins[0].address,
    amount: coins[0].amount,
    scriptDescriptor: {
      scriptType: 'multisig',
      script: 'RETURN SIGNEDBY(0xKEY1) AND SIGNEDBY(0xKEY2)',
      multisigKeys: ['0xKEY1', '0xKEY2'],
      multisigThreshold: 2
    }
  }],
  [{ address: 'Mx...recipient', amount: coins[0].amount }]
);
console.log('Blob hash:', blob.blobHash);

// Step 4d: Signer A contributes partial signature
const partialSig = await totem.signForMultisig(blob.unsignedHex, [account.address]);
// Send partialSig.signedHex to coordinator

// Step 4e: After collecting all signatures — broadcast the assembled signed transaction
await totem.broadcast(assembledSignedHex, blob.digestTx);
```

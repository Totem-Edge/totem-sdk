# Totem SDK Migration Guide

**Date:** 2026-02-16
**Affects:** `@totem/sdk-core`, `@totem/sdk-tx-builder` (new), `@totem/sdk-connect`

This guide covers:
1. **Breaking changes** to `@totem/sdk-connect` types (aligned to TOTEM_CONNECT.md v3.0.0, formerly TOTEM_CONNECT_SPEC v2.1.1)
2. Non-breaking function renames in `@totem/sdk-core` (old names still work as deprecated aliases)
3. New subpackages (`@totem/sdk-tx-builder`, new connect helper functions)

---

## Breaking Changes — `@totem/sdk-connect` Types

The `@totem/sdk-connect` types have been rewritten to match `TOTEM_CONNECT.md` (v3.0.0, formerly `TOTEM_CONNECT_SPEC.md` v2.1.1) exactly. If you were using the old types, you will need to update your code.

### All Requests Now Require `origin`

Every provider method now requires `origin: string` in `params`. The extension uses this to identify your dApp.

```typescript
// Before (WRONG)
await provider.request({ method: 'TOTEM_CONNECT', params: { silent: true } });

// After (CORRECT)
await provider.request({ method: 'TOTEM_CONNECT', params: { origin: window.location.origin } });
```

### `TOTEM_CONNECT` Response Changed

| Field | Old Type | New Type |
|-------|----------|----------|
| `connected` | _(missing)_ | `true` |
| `address` | `string` | `string` (unchanged) |
| `addressIndex` | _(missing)_ | `number` (0–63) |
| `isReconnect` | _(missing)_ | `boolean \| undefined` |
| `publicKey` | `string` | _(removed)_ |
| `network` | `string \| undefined` | _(removed)_ |

### `TOTEM_VERIFY` Request & Response Changed

**Request:** `{ message: string }` → `{ origin, challenge?: { statement?, nonce?, expiryMs? } }`

**Response:** `{ verified, verificationId, address, message, signature, publicKey, expiresAt, sessionToken?, sessionExpiresAt? }`. As of v4.1 the proof signs from the connected spend address (no reserved auth-key slot), so `deriveAddressFromPublicKey(publicKey) === address` and backends verify with the high-level one-liner `verifySignatureDetailed(address, message, signature, publicKey)` from `@totem/sdk-core`. The previous `authKeyIndex` and `digestHex` fields have been removed.

### `TOTEM_GET_ACCOUNTS` Response Changed

Account objects now return `{ index, address, balance }` instead of `{ address, publicKey, index }`.

### `TOTEM_SEND_TRANSACTION` Request Changed

Request is now wrapped: `{ origin, request: { version: 1, intent?, outputs } }` instead of flat params.

### `TOTEM_GET_COINS` — `created` Type Changed

`created` field changed from `number` to `string` (block height as string).

### `TOTEM_SEND_COMPLEX` — Structural Changes

- `scriptDescriptor` is now **inline per input** (not a separate top-level array)
- `buildParams` now supports `transactionState` and `linkHash`
- Build response now includes `detectedIntent` and `scriptTypes`
- All response fields are now properly typed (no more `any`)

### `TOTEM_SIGN_DATA` / `TOTEM_BROADCAST_HEX` — `origin` Added

Both now require `origin` in params.

### New Permission Methods Added

Three new methods for managing dApp transaction permissions:

| Method | Description |
|--------|-------------|
| `TOTEM_GRANT_TX_PERMISSION` | Grant transaction intents + token spending limits |
| `TOTEM_REVOKE_TX_PERMISSION` | Revoke all permissions for a dApp |
| `TOTEM_GET_TX_PERMISSIONS` | Query all sites with permissions |

### New Helper Functions

The SDK now provides convenience functions that match the spec:

```typescript
import { connect, verify, getAccounts, sendTransaction, getCoins, sendComplex, signData, broadcastHex, grantTxPermission, revokeTxPermission, getTxPermissions } from '@totem/sdk-connect';

const conn = await connect(window.location.origin);
const proof = await verify(window.location.origin, { statement: 'Sign in to MyDApp' });
const accounts = await getAccounts(window.location.origin);
```

### `isMinimask` Removed

The provider no longer exposes `isMinimask`. Check `isTotem` on the provider received from `totem:announce`:

```typescript
// Before (old global injection — removed)
if (window.totem?.isMinimask) { ... }

// After (totem:announce discovery)
window.addEventListener('totem:announce', (event) => {
  const { provider } = event.detail;
  if (provider?.isTotem) { /* it's Totem */ }
});
window.dispatchEvent(new CustomEvent('totem:requestAnnounce'));
```

### Success/Error Response Unions

Methods that return `{ success: boolean }` now use discriminated unions:

```typescript
const result = await getCoins(origin, { tokenId: '0x00' });
if (result.success) {
  // TypeScript knows result.coins exists here
  console.log(result.coins);
} else {
  // TypeScript knows result.error and result.errorCode exist here
  console.log(result.error);
}
```

---

## Non-Breaking Changes — `@totem/sdk-core` Renames

All renamed functions retain their original names as `@deprecated` aliases. Your existing code will continue to compile and work correctly.

---

## Renamed Functions

### Base32 / Address Encoding (`minima32.ts`, re-exported via `mx.ts`)

These functions handle conversion between raw bytes, hex strings, and Mx-format addresses.

| Old Name | New Name | Description | Return Type |
|----------|----------|-------------|-------------|
| `encodeMx(bytes)` | `makeMxAddress(bytes)` | Create Mx address from 32-byte root | `string` (e.g. `MxG0...`) |
| `decodeMx(mx)` | `parseMxAddress(mx)` | Extract 32-byte root from Mx address | `Uint8Array` (32 bytes) |
| `makeMinimaAddress(hex)` | `hexToMx(hex)` | Convert hex string to Mx address | `string` (e.g. `MxG0...`) |
| `convertMinimaAddress(mx)` | `mxToHex(mx)` | Convert Mx address to hex string | `string` (uppercase hex) |

**Import path:** `@totem/sdk-core` barrel export, or directly from `minima32.ts` / `mx.ts`

**Example migration:**

```typescript
// Before
import { encodeMx, decodeMx } from '@totem/sdk-core';
const address = encodeMx(rootBytes);
const bytes = decodeMx(address);

// After
import { makeMxAddress, parseMxAddress } from '@totem/sdk-core';
const address = makeMxAddress(rootBytes);
const bytes = parseMxAddress(address);
```

---

### MMR Proof Serialization (`mmr.ts`)

| Old Name | New Name | Description | Input | Return Type |
|----------|----------|-------------|-------|-------------|
| `deserializeMMRProof(data)` | `parseMMRProofFromHex(data)` | Parse MMR proof from bytes | `Uint8Array` | `{ proof: MMRProof; blockTime: bigint }` |
| _(new alias)_ | `serializeRealMMRProof(proof, blockTime?)` | Alias for `serializeMMRProof` | `MMRProof, bigint` | `Uint8Array` |

**Example migration:**

```typescript
// Before
import { deserializeMMRProof } from '@totem/sdk-core';
const { proof, blockTime } = deserializeMMRProof(proofBytes);

// After
import { parseMMRProofFromHex } from '@totem/sdk-core';
const { proof, blockTime } = parseMMRProofFromHex(proofBytes);
```

---

### Streamable Aliases (`Streamable.ts`)

These are **new aliases** for existing functions — both names are valid going forward.

| Existing Name | New Alias | Description |
|--------------|-----------|-------------|
| `writeMiniNumber(value, scale?)` | `encodeMiniNumber(value, scale?)` | Serialize a number in Minima wire format |
| `writeMiniData(data)` | `encodeMiniData(data)` | Serialize raw bytes in Minima wire format |
| `writeMiniString(str)` | `encodeMiniString(str)` | Serialize a UTF-8 string in Minima wire format |

Both the `write*` and `encode*` names are valid. No deprecation on either.

---

## Important Clarifications

### `scriptToAddress` vs `computeScriptAddress` — Different Functions

These are **not** renames of each other. They perform different computations:

| Function | Module | What It Does | Returns |
|----------|--------|-------------|---------|
| `scriptToAddress(script)` | `derive.ts` | Hashes script via MMR leaf, then encodes as Mx address | `string` (e.g. `MxG0...`) |
| `computeScriptAddress(script)` | `witness-serializer.ts` | SHA3-256 hash of uppercase script bytes | `string` (e.g. `0xABCD...`) |

`scriptToAddress` is used for **wallet address derivation** (full MMR path).
`computeScriptAddress` is used for **script proof matching** (hash only).

---

### Two `parseMMRProofFromHex` Functions — Different Signatures

The SDK exports `parseMMRProofFromHex` from two different modules with **different input types**. Import from the correct module for your use case:

| Module | Input Type | Use Case |
|--------|-----------|----------|
| `mmr.ts` | `Uint8Array` (raw bytes) | Low-level MMR proof parsing from binary data |
| `witness-serializer.ts` | `string` (hex string) | Parsing MMR proofs embedded in witness hex data |

The barrel export (`@totem/sdk-core`) exposes the `mmr.ts` version (takes `Uint8Array`). If you need the hex-string version, import directly:

```typescript
// Barrel export — takes Uint8Array
import { parseMMRProofFromHex } from '@totem/sdk-core';

// Direct import — takes hex string
import { parseMMRProofFromHex } from '@totem/sdk-core/scripts/witness-serializer';
```

---

### `bytesToHex` in Address Derivation — Uppercase Is Intentional

The `bytesToHex` function in `util.ts` outputs `0x` + **UPPERCASE** hex. This is intentional and cryptographically significant — it feeds into `scriptFromWotsPk()` which generates the KISSVM script string (e.g., `RETURN SIGNEDBY(0xABCD...)`). That script string is hashed byte-for-byte by `mmrLeafExact` for address derivation. Changing the case would produce different addresses from the same seed phrase.

Other `bytesToHex` implementations in the SDK (in `Streamable.ts`, `witness-serializer.ts`, etc.) use lowercase for their own purposes and are not involved in address derivation.

**Do not modify the case behavior of `util.ts` `bytesToHex`.**

---

## New Subpackages

### `@totem/sdk-tx-builder`

A new subpackage providing transaction building utilities with pluggable adapters (no browser extension dependencies):

| Export | Description |
|--------|-------------|
| `CoinSelectionService` | UTXO coin selection with pluggable `CoinFetcher` adapter |
| `MultisigManager` | Multisig coordination with pluggable `KeyValueStorage` adapter |

These use dependency injection interfaces instead of `chrome.storage`, making them usable in Node.js, React Native, or any JavaScript environment.

```typescript
import { CoinSelectionService } from '@totem/sdk-tx-builder';

const selector = new CoinSelectionService(myCoinFetcher);
const selected = await selector.selectCoins(amount, tokenId);
```

### `@totem/sdk-connect` — DApp Provider Methods

Four new provider methods for advanced DApp transaction capabilities:

| Method | Intent | Description |
|--------|--------|-------------|
| `TOTEM_GET_COINS` | `utxo_read` | Permission-gated UTXO queries |
| `TOTEM_SEND_COMPLEX` | `complex_send` | Full ScriptDescriptor support (MAST/multisig/HTLC/exchange/vault). Supports `mode: 'build' \| 'submit'` |
| `TOTEM_SIGN_DATA` | `sign_data` | Partial signing for multisig coordination (requires `inputAddresses[]`) |
| `TOTEM_BROADCAST_HEX` | `broadcast_tx` | Broadcast pre-signed transaction blobs |

All methods enforce input ownership validation, digest-bound approval popups, and explicit permission grants.

```typescript
import { connect, verify, sendComplex, grantTxPermission } from '@totem/sdk-connect';

const origin = window.location.origin;

// Step 1: Connect
const conn = await connect(origin);
console.log(conn.address, conn.addressIndex);

// Step 2: Verify ownership (mandatory)
const proof = await verify(origin, { statement: 'Sign in to MyDApp' });

// Step 3: Grant permissions for complex transactions
await grantTxPermission(origin, { allowedIntents: ['complex_send'] });

// Step 4: Build a complex transaction without submitting
const result = await sendComplex(origin, {
  inputs: [{
    coinId: '0x...', address: 'MxG0...', amount: '1.0',
    scriptDescriptor: { scriptType: 'mast', script: 'MAST 0x...' }
  }],
  outputs: [{ address: 'MxG0...', amount: '0.9' }]
}, 'build');

console.log(result.unsignedHex, result.blobHash);
```

---

## Quick Reference: Recommended Import Paths

| What You Need | Import From |
|--------------|-------------|
| Address encoding/decoding | `@totem/sdk-core` (`makeMxAddress`, `parseMxAddress`, `hexToMx`, `mxToHex`) |
| Wallet address derivation | `@totem/sdk-core` (`scriptToAddress`, `scriptFromWotsPk`) |
| MMR proof operations | `@totem/sdk-core` (`serializeMMRProof`, `parseMMRProofFromHex`) |
| Script proof / witness building | `@totem/sdk-core` (`computeScriptAddress`, `serializeStateVariables`) |
| Transaction serialization | `@totem/sdk-core` (`writeMiniNumber` / `encodeMiniNumber`, etc.) |
| Coin selection | `@totem/sdk-tx-builder` (`CoinSelectionService`) |
| Multisig coordination | `@totem/sdk-tx-builder` (`MultisigManager`) |
| DApp provider API | `@totem/sdk-connect` (`connect`, `verify`, `getAccounts`, `sendTransaction`, `getCoins`, `sendComplex`, `signData`, `broadcastHex`) |
| Permission management | `@totem/sdk-connect` (`grantTxPermission`, `revokeTxPermission`, `getTxPermissions`) |
| Provider type checking | `@totem/sdk-connect` (`isTotemInstalled`, `getProvider`, `TotemProvider` type) |

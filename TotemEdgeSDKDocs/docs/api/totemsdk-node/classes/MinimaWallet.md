[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / MinimaWallet

# Class: MinimaWallet

Minima-compatible wallet for Node.js

Uses per-address TreeKey architecture matching Minima Wallet.java exactly.

## Constructors

### Constructor

> **new MinimaWallet**(`config`): `MinimaWallet`

#### Parameters

##### config

`WalletConfig`

#### Returns

`MinimaWallet`

## Properties

### MAX\_ADDRESSES

> `readonly` `static` **MAX\_ADDRESSES**: `64` = `64`

## Methods

### clearTreeKeyCache()

> **clearTreeKeyCache**(): `void`

Clear TreeKey cache (useful for memory management)

#### Returns

`void`

***

### createAccount()

> **createAccount**(`label?`): `Promise`\<`Account`\>

Create new account using per-address TreeKey architecture

Matches Minima Wallet.createNewKey() exactly:
1. modifier = new MiniData(new BigInteger(Integer.toString(numkeys)))
2. privseed = Crypto.hashObjects(baseSeed, modifier)
3. treekey = TreeKey.createDefault(privseed)
4. address public key = TreeKey's MMR root

#### Parameters

##### label?

`string`

#### Returns

`Promise`\<`Account`\>

***

### export()

> **export**(`password`): `Promise`\<`string`\>

Export wallet as encrypted JSON

#### Parameters

##### password

`string`

#### Returns

`Promise`\<`string`\>

***

### generateSeedPhrase()

> **generateSeedPhrase**(): `string`

Generate new Minima-compatible seed phrase

#### Returns

`string`

24-word seed phrase in UPPERCASE (Minima canonical form)

***

### getAccount()

> **getAccount**(`address`): `Account` \| `undefined`

Get account by address

#### Parameters

##### address

`string`

#### Returns

`Account` \| `undefined`

***

### getAccountByIndex()

> **getAccountByIndex**(`index`): `Account` \| `undefined`

Get account by index

#### Parameters

##### index

`number`

#### Returns

`Account` \| `undefined`

***

### getAccounts()

> **getAccounts**(): `Account`[]

Get all accounts

#### Returns

`Account`[]

***

### getStats()

> **getStats**(): `object`

Get wallet statistics

#### Returns

`object`

##### accountCount

> **accountCount**: `number`

##### cachedTreeKeys

> **cachedTreeKeys**: `number`

##### maxAddresses

> **maxAddresses**: `number`

***

### import()

> **import**(`encryptedData`, `password`): `Promise`\<`void`\>

Import wallet from encrypted JSON

#### Parameters

##### encryptedData

`string`

##### password

`string`

#### Returns

`Promise`\<`void`\>

***

### initialize()

> **initialize**(`seedPhrase?`): `Promise`\<`void`\>

Initialize wallet with new seed phrase or load existing

#### Parameters

##### seedPhrase?

`string`

24-word Minima seed phrase (optional, creates new if not provided)

#### Returns

`Promise`\<`void`\>

***

### mineAndSubmitTxPoW()

> **mineAndSubmitTxPoW**(`txBytes`, `witnessBytes`, `opts?`): `Promise`\<\{ `elapsedMs`: `number`; `miningSource`: `"wasm"` \| `"js"`; `txpowId`: `string`; \}\>

Mine a TxPoW locally and submit it to the Axia API.

This is the production path for SDK-built transactions:
  1. Fetch the live difficulty target from the Axia API.
  2. Build the TxBody (serialized tx + witness bytes).
  3. Iterate the nonce until SHA3-256(TxHeader) < target (JS mining loop).
  4. POST the mined TxPoW hex to the Axia MEG bridge for p2p broadcast.

The caller is responsible for building and signing the transaction
(e.g. via @totemsdk/tx-builder) to produce txBytes + witnessBytes.

#### Parameters

##### txBytes

`Uint8Array`

Pre-serialized, signed Transaction bytes.
                     Use core.serializeTransaction(tx) after signing.

##### witnessBytes

`Uint8Array`

Pre-serialized Witness bytes (WOTS proofs + coin proofs).
                     Use your witness serializer (extension or SDK equivalent).

##### opts?

Optional: axiaBaseUrl override, AbortSignal, mining chunk size.

###### axiaBaseUrl?

`string`

###### chunkSize?

`number`

###### signal?

`AbortSignal`

###### submitPath?

`string`

#### Returns

`Promise`\<\{ `elapsedMs`: `number`; `miningSource`: `"wasm"` \| `"js"`; `txpowId`: `string`; \}\>

txpowId (hex), mining source, and wall-clock time.

***

### sendTransaction()

> **sendTransaction**(`params`, `signingIndices`): `Promise`\<`string`\>

Send transaction with automatic signing

WARNING: This convenience method is NOT suitable for production use.
Production code must:
1. Track used signing indices via WatermarkStore
2. Use signData() with proper Minima transaction serialization
3. Build witness bundle correctly for txnimport

#### Parameters

##### params

`TransactionParams`

Transaction parameters

##### signingIndices

Required: unique (l1, l2) indices for this signature

###### l1

`number`

###### l2

`number`

#### Returns

`Promise`\<`string`\>

***

### signData()

> **signData**(`dataHash`, `addressIndex`, `signingIndices`): `Promise`\<`string`\>

Sign raw data hash using per-address TreeKey

This is the low-level signing method that accepts pre-computed hash.
Use this for full Minima compatibility where transaction hashing
follows Minima's canonical serialization.

CRITICAL FIX (2026-02-05): Now uses setUses() + sign() to produce 3 proofs
matching Java's TreeKey.sign() exactly for depth=3 TreeKeys.

#### Parameters

##### dataHash

`Uint8Array`

32-byte SHA3-256 hash of data to sign

##### addressIndex

`number`

Account index (0-63)

##### signingIndices

Unique (l1, l2) indices for this signature

###### l1

`number`

###### l2

`number`

#### Returns

`Promise`\<`string`\>

Hex-encoded signature

***

### signMinimaTransaction()

> **signMinimaTransaction**(`tx`, `addressIndex`, `signingIndices`): `Promise`\<\{ `digest`: `Uint8Array`; `signature`: `string`; \}\>

Sign a MinimaTransaction using canonical Minima wire serialization.

This is the production-ready signing method that matches the Totem wallet extension exactly:
1. Precomputes output coin IDs (matching Java's TxPoWGenerator.precomputeTransactionCoinID)
2. Serializes the transaction using Minima's canonical wire format (Streamable.ts)
3. Computes SHA3-256 digest of the serialized bytes
4. Signs with TreeKey hierarchical WOTS signatures

#### Parameters

##### tx

[`MinimaTransaction`](../interfaces/MinimaTransaction.md)

MinimaTransaction with proper MinimaCoin inputs/outputs

##### addressIndex

`number`

Account index (0-63) to sign with

##### signingIndices

Unique (l1, l2) indices for this one-time signature

###### l1

`number`

###### l2

`number`

#### Returns

`Promise`\<\{ `digest`: `Uint8Array`; `signature`: `string`; \}\>

Hex-encoded hierarchical TreeKey signature

***

### signTransaction()

> **signTransaction**(`tx`, `fromAddress`, `signingIndices`): `Promise`\<`string`\>

Sign transaction using per-address TreeKey

CRITICAL: WOTS ONE-TIME KEY REQUIREMENT
========================================
WOTS (Winternitz One-Time Signature) keys MUST only be used once.
Reusing the same (l1, l2) indices for different messages compromises
the private key and allows signature forgery.

The caller MUST provide unique signingIndices for each transaction.
Use a WatermarkStore or similar mechanism to track used indices.
Each per-address TreeKey supports 64 × 64 = 4,096 unique signatures.

CRITICAL FIX (2026-02-05): Now uses setUses() + sign() to produce 3 proofs
matching Java's TreeKey.sign() exactly for depth=3 TreeKeys.
The (l1, l2) indices are converted to a uses counter: uses = l1 * 64 + l2

Uses hierarchical TreeKey signatures:
- setUses(uses) + sign() produces 3 signature proofs (Root→L1→L2→DATA)
- l1 range: 0-63 (L1 index)
- l2 range: 0-63 (L2 index within L1 subtree)

NOTE: Transaction serialization currently uses JSON. For full Minima
compatibility, provide pre-hashed transaction data via signData().

#### Parameters

##### tx

`Transaction`

Transaction to sign

##### fromAddress

`string`

Address to sign from

##### signingIndices

REQUIRED in production: unique (l1, l2) indices

###### l1

`number`

###### l2

`number`

#### Returns

`Promise`\<`string`\>

Hex-encoded signature

#### Throws

Error if indices are not provided (in production mode)

***

### updateBalances()

> **updateBalances**(): `Promise`\<`void`\>

Update account balances from network

#### Returns

`Promise`\<`void`\>

***

### validateSeedPhrase()

> **validateSeedPhrase**(`phrase`): `boolean`

Validate a seed phrase

#### Parameters

##### phrase

`string`

Seed phrase to validate

#### Returns

`boolean`

true if all words are valid BIP39 words

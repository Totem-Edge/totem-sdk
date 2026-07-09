[**@totemsdk/root-identity**](../index.md)

***

[@totemsdk/root-identity](../index.md) / UnifiedIdentityWallet

# Class: UnifiedIdentityWallet

## Constructors

### Constructor

> **new UnifiedIdentityWallet**(`baseSeed`, `childCount?`): `UnifiedIdentityWallet`

#### Parameters

##### baseSeed

`Uint8Array`

32-byte raw seed (use `UnifiedIdentityWallet.fromPhrase` for mnemonic input)

##### childCount?

`number` = `MAX_CHILD_COUNT`

Number of child addresses (1–64, default 64)

#### Returns

`UnifiedIdentityWallet`

## Methods

### getAddressMap()

> **getAddressMap**(): `object`

Root address and children as a structured object.

#### Returns

`object`

##### children

> **children**: `string`[]

##### root

> **root**: `string`

***

### getAllAddresses()

> **getAllAddresses**(): `string`[]

All addresses: root first, then all children in order.

#### Returns

`string`[]

***

### getChildAddress()

> **getChildAddress**(`index`): `string`

Minima spend address for child `index` (0-based).

#### Parameters

##### index

`number`

#### Returns

`string`

***

### getChildCount()

> **getChildCount**(): `number`

Number of child addresses configured for this wallet.

#### Returns

`number`

***

### getChildPublicKey()

> **getChildPublicKey**(`index`): `string`

64-char hex public key for child `index`.

#### Parameters

##### index

`number`

#### Returns

`string`

***

### getChildTreeKey()

> **getChildTreeKey**(`index`): `TreeKey`

Get (or create and cache) the TreeKey for child `index` (0-based).

Use this for transaction signing — the child TreeKey is the spend key.
Call `getChildUses` / `setChildUses` to manage the watermark manually.

#### Parameters

##### index

`number`

#### Returns

`TreeKey`

***

### getChildUses()

> **getChildUses**(`index`): `number`

Number of times child `index` has signed (for persistence).

#### Parameters

##### index

`number`

#### Returns

`number`

***

### getMaxUsesPerSlot()

> **getMaxUsesPerSlot**(): `number`

Maximum one-time signatures available per slot (3 levels × 64 keys = 262 144).

#### Returns

`number`

***

### getRootAddress()

> **getRootAddress**(): `string`

Minima address for the root key. NEVER use this address for spending.

#### Returns

`string`

***

### getRootPublicKey()

> **getRootPublicKey**(): `string`

64-char hex public key for the root key.

#### Returns

`string`

***

### getRootTreeKey()

> **getRootTreeKey**(): `TreeKey`

Get (or create and cache) the root identity TreeKey.

Use this only for off-chain attestation signing, not for spending.

#### Returns

`TreeKey`

***

### getRootUses()

> **getRootUses**(): `number`

Number of times the root identity key has signed (for persistence).

#### Returns

`number`

***

### getWatermarkState()

> **getWatermarkState**(): `object`

Return a serialisable snapshot of all current watermark counters.

Persist the returned object (e.g. to encrypted storage) and pass it back
to `restoreWatermarkState()` at the start of the next session so that no
one-time-use signing slot is ever reused.

#### Returns

`object`

##### childUses

> **childUses**: `Record`\<`number`, `number`\>

##### rootUses

> **rootUses**: `number`

***

### proveOwnership()

> **proveOwnership**(`childIndices`): [`OwnershipProof`](../interfaces/OwnershipProof.md)

Produce an ownership proof demonstrating that this root identity controls
all given child addresses.

The root key signs a canonical JSON message containing all child public keys
(sorted) and a timestamp, enabling third-party verification without any
network access.

#### Parameters

##### childIndices

`number`[]

Which children to include (0-based)

#### Returns

[`OwnershipProof`](../interfaces/OwnershipProof.md)

***

### restoreWatermarkState()

> **restoreWatermarkState**(`state`): `void`

Restore watermark counters from a previously persisted snapshot.

Call this immediately after constructing the wallet to prevent slot reuse
across sessions. Out-of-range or invalid entries are silently skipped.

#### Parameters

##### state

###### childUses?

`Record`\<`number`, `number`\>

###### rootUses?

`number`

#### Returns

`void`

***

### setChildUses()

> **setChildUses**(`index`, `uses`): `void`

Restore child watermark from a previously persisted value.

#### Parameters

##### index

`number`

##### uses

`number`

#### Returns

`void`

***

### setRootUses()

> **setRootUses**(`uses`): `void`

Restore root watermark from a previously persisted value.

#### Parameters

##### uses

`number`

#### Returns

`void`

***

### signFromChild()

> **signFromChild**(`index`, `message`): [`WotsProof`](../interfaces/WotsProof.md)

Sign `message` with child key `index` (0-based) for on-chain transactions.
Each child maintains its own independent use counter.

#### Parameters

##### index

`number`

##### message

`string`

#### Returns

[`WotsProof`](../interfaces/WotsProof.md)

#### Throws

if child TreeKey is exhausted or index out of range

***

### signFromRoot()

> **signFromRoot**(`message`): [`WotsProof`](../interfaces/WotsProof.md)

Sign `message` with the root identity key (for off-chain attestations).
Hashes the message with SHA3-256 before signing.

#### Parameters

##### message

`string`

#### Returns

[`WotsProof`](../interfaces/WotsProof.md)

#### Throws

if root TreeKey is exhausted (262 144 uses)

***

### fromPhrase()

> `static` **fromPhrase**(`phrase`, `childCount?`): `UnifiedIdentityWallet`

Create a wallet from a Minima-compatible BIP39 seed phrase.

#### Parameters

##### phrase

`string`

##### childCount?

`number` = `MAX_CHILD_COUNT`

#### Returns

`UnifiedIdentityWallet`

***

### generatePhrase()

> `static` **generatePhrase**(): `string`

Generate a new random Minima-compatible 24-word seed phrase.

#### Returns

`string`

***

### validatePhrase()

> `static` **validatePhrase**(`phrase`): `boolean`

Validate a Minima-compatible seed phrase.

#### Parameters

##### phrase

`string`

#### Returns

`boolean`

***

### verifyOwnershipProof()

> `static` **verifyOwnershipProof**(`proof`): `boolean`

Verify an ownership proof produced by `proveOwnership`.

Returns `true` only when:
- The canonical message is reconstructed correctly (child keys are sorted).
- The root WOTS signature validates against the root public key and address.
- Every child public key correctly derives the corresponding child address.

Pure crypto — no network access required.
Always returns `false` (never throws) on malformed or incomplete proof data.

#### Parameters

##### proof

[`OwnershipProof`](../interfaces/OwnershipProof.md)

#### Returns

`boolean`

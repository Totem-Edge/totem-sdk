[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / TreeKey

# Class: TreeKey

TreeKey - Full hierarchical key tree with multiple levels

Matches TreeKey.java:
- Default: 3 levels x 64 keys = 262,144 one-time signatures
- Tracks usage count to determine which key to use
- Produces multi-level signatures

## Constructors

### Constructor

> **new TreeKey**(`privateSeed`, `keysPerLevel?`, `levels?`): `TreeKey`

#### Parameters

##### privateSeed

`Bytes`

##### keysPerLevel?

`number` = `DEFAULT_KEYS_PER_LEVEL`

##### levels?

`number` = `DEFAULT_LEVELS`

#### Returns

`TreeKey`

## Methods

### getAddressPublicKey()

> **getAddressPublicKey**(`l1`): `Bytes`

Get the public key for a level-1 address (single index)
This is the MMR root of the level-1 TreeKeyNode's 64 Winternitz keys.

Use this for wallet addresses where each address = one level-1 node.

#### Parameters

##### l1

`number`

Level 1 index (0-63, corresponds to wallet address index)

#### Returns

`Bytes`

32-byte MMR root public key for SIGNEDBY scripts

***

### getCachedSignatures()

> **getCachedSignatures**(): `Map`\<`string`, [`SignatureProof`](../interfaces/SignatureProof.md)\>

Get all cached parent-child signatures (for serialization/persistence)

#### Returns

`Map`\<`string`, [`SignatureProof`](../interfaces/SignatureProof.md)\>

***

### getMaxUses()

> **getMaxUses**(): `number`

Get the maximum number of signatures this tree can produce

#### Returns

`number`

***

### getParentChildSig()

> **getParentChildSig**(`path`): [`SignatureProof`](../interfaces/SignatureProof.md) \| `undefined`

Get a cached parent-child signature

#### Parameters

##### path

`number`[]

Array of indices (e.g., [l1] for root->level1)

#### Returns

[`SignatureProof`](../interfaces/SignatureProof.md) \| `undefined`

***

### getPublicKey()

> **getPublicKey**(): `Bytes`

Get the wallet's public key (root of the key tree)

#### Returns

`Bytes`

***

### getRootNode()

> **getRootNode**(): [`TreeKeyNode`](TreeKeyNode.md)

Get the root TreeKeyNode (for internal use)

#### Returns

[`TreeKeyNode`](TreeKeyNode.md)

***

### getRootPublicKey()

> **getRootPublicKey**(): `Bytes`

Get the root public key (for watermark tracking)

#### Returns

`Bytes`

***

### getSigningNodePublicKey()

> **getSigningNodePublicKey**(`l1`, `l2`): `Bytes`

Get the public key for a specific signing key at tree index (l1, l2)
This navigates to the level-2 node for signing operations.

#### Parameters

##### l1

`number`

Level 1 index (address)

##### l2

`number`

Level 2 index (signing key within address)

#### Returns

`Bytes`

32-byte MMR root public key of level-2 node

***

### getUses()

> **getUses**(): `number`

Get current usage count

#### Returns

`number`

***

### hasParentChildSig()

> **hasParentChildSig**(`path`): `boolean`

Check if a parent-child signature is cached

#### Parameters

##### path

`number`[]

Array of indices (e.g., [l1] for root->level1)

#### Returns

`boolean`

***

### restoreCachedSignatures()

> **restoreCachedSignatures**(`cache`): `void`

Restore cached signatures (for hydrating from persistence)

#### Parameters

##### cache

`Map`\<`string`, [`SignatureProof`](../interfaces/SignatureProof.md)\>

#### Returns

`void`

***

### setParentChildSig()

> **setParentChildSig**(`path`, `sig`): `void`

Cache a parent-child signature for reuse
This allows the same signature to be reused across multiple signing operations

#### Parameters

##### path

`number`[]

Array of indices leading to the child (e.g., [l1] or [l1, l2])

##### sig

[`SignatureProof`](../interfaces/SignatureProof.md)

SignatureProof from parent signing child's public key

#### Returns

`void`

***

### setUses()

> **setUses**(`uses`): `void`

Set the usage counter (for resuming from a known state)

#### Parameters

##### uses

`number`

#### Returns

`void`

***

### sign()

> **sign**(`data`): [`TreeSignature`](../interfaces/TreeSignature.md)

Sign data with the current key and increment usage

Matches TreeKey.java sign():
- Determines path through tree based on usage count
- Each level's key signs the next level's root public key
- Final level signs the actual data

CRITICAL FIX (January 2026): Build proofs bottom-up to sign child's getRootPublicKey()

Java's TreeKey.verify() verifies non-leaf signatures against childsig.getRootPublicKey(),
which is the 32-byte MMR root computed from the NEXT proof's leafPubkey + MMRproof.

Uses parent-child signature caching for efficiency:
- Parent-child signatures are cached and reused
- Only the final data signature is computed fresh each time

#### Parameters

##### data

`Bytes`

#### Returns

[`TreeSignature`](../interfaces/TreeSignature.md)

***

### createWithProgress()

> `static` **createWithProgress**(`privateSeed`, `keysPerLevel?`, `levels?`, `onProgress?`): `Promise`\<`TreeKey`\>

Async factory method for TreeKey with progress reporting
Reports progress as the root TreeKeyNode generates its 64 signing keys

#### Parameters

##### privateSeed

`Bytes`

##### keysPerLevel?

`number` = `DEFAULT_KEYS_PER_LEVEL`

##### levels?

`number` = `DEFAULT_LEVELS`

##### onProgress?

[`ProgressCallback`](../type-aliases/ProgressCallback.md)

#### Returns

`Promise`\<`TreeKey`\>

[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / TreeKeyNode

# Class: TreeKeyNode

TreeKeyNode - One node in the key tree containing 64 Winternitz keys

Matches TreeKeyNode.java (see attached_assets/TreeKeyNode_1767574401422.java):

Key generation (lines 44-62):
- Creates 64 Winternitz keys from a deterministic seed
- For each key: MiniData pubkey = wots.getPublicKey() returns 32-byte DIGEST
- Adds to MMR: MMRData.CreateMMRDataLeafNode(pubkey, MiniNumber.ZERO)
- Public key = MMR root (mPublicKey = mTree.getRoot().getData())

MMR leaf construction (see MMRData.java lines 30-36):
  MMRData.CreateMMRDataLeafNode(pubkeyDigest, MiniNumber.ZERO)
  → hash = Crypto.hashAllObjects(MiniNumber.ZERO, zData, zSumValue)
  → Serialization: [0x00,0x01,0x00] + [4-byte-len + pubkey] + [0x00,0x01,0x00]

MMR parent construction (see MMRData.java lines 38-50):
  MMRData.CreateMMRDataParentNode(left, right)
  → hash = Crypto.hashAllObjects(MiniNumber.ONE, left.data, right.data, sumValue)

IMPORTANT: Minima NEVER stores the 1088-byte full WOTS public key.
Only the 32-byte digest is stored and used for MMR construction.

## Constructors

### Constructor

> **new TreeKeyNode**(`privateSeed`, `keysPerLevel?`): `TreeKeyNode`

#### Parameters

##### privateSeed

`Bytes`

##### keysPerLevel?

`number` = `DEFAULT_KEYS_PER_LEVEL`

#### Returns

`TreeKeyNode`

## Methods

### getChild()

> **getChild**(`childIndex`): `TreeKeyNode`

Create a child TreeKeyNode at the specified index
Matches TreeKeyNode.java getChild()

PERFORMANCE FIX: Child nodes are now cached to avoid regenerating
64 WOTS keys on every getChild() call. This is critical for address
derivation performance where getChild() is called 64 times.

#### Parameters

##### childIndex

`number`

#### Returns

`TreeKeyNode`

***

### getProof()

> **getProof**(`keyIndex`): [`MMRProof`](../interfaces/MMRProof.md)

Get the MMR proof for a specific key index

#### Parameters

##### keyIndex

`number`

#### Returns

[`MMRProof`](../interfaces/MMRProof.md)

***

### getPublicKey()

> **getPublicKey**(): `Bytes`

Get the public key for this tree node (MMR root of all 64 Winternitz keys)

#### Returns

`Bytes`

***

### ~~getWOTSPublicKey()~~

> **getWOTSPublicKey**(`index`): `Bytes`

Get the full Winternitz public key at a specific index (0-63)
Returns the full L×32 byte public key (1088 bytes), derived on-demand

NOTE: This is only used for local signature verification in tests.
Java's Winternitz.getPublicKey() returns a 32-byte digest, not this.
For production code, use getWOTSPublicKeyDigest() instead.

#### Parameters

##### index

`number`

#### Returns

`Bytes`

#### Deprecated

Use getWOTSPublicKeyDigest() for Minima compatibility

***

### getWOTSPublicKeyDigest()

> **getWOTSPublicKeyDigest**(`index`): `Bytes`

Get the Winternitz public key digest at a specific index (0-63)
Returns the 32-byte SHA3 hash of the full public key

#### Parameters

##### index

`number`

#### Returns

`Bytes`

***

### sign()

> **sign**(`keyIndex`, `data`): [`SignatureProof`](../interfaces/SignatureProof.md)

Sign data with a specific key from this node
Returns a SignatureProof containing the 32-byte leaf pubkey DIGEST, signature, and MMR proof

CRITICAL: Java's WinternitzOTSignature.getSignature() ALWAYS hashes the message first,
regardless of input length. From BouncyCastle WinternitzOTSignature.java lines 137-138:
  messDigestOTS.update(message, 0, message.length);
  messDigestOTS.doFinal(hash, 0);

We MUST always hash to match Java verification, which also always hashes.

CRITICAL FIX (January 2026): leafPubkey is the 32-byte WOTS public key DIGEST.
Java's Winternitz.getPublicKey() returns SHA3-256(full_key) = 32 bytes!
Previous bug: We stored 1088-byte full keys, Java expected 32-byte digests → verification failed.

#### Parameters

##### keyIndex

`number`

##### data

`Bytes`

#### Returns

[`SignatureProof`](../interfaces/SignatureProof.md)

***

### createWithProgress()

> `static` **createWithProgress**(`privateSeed`, `keysPerLevel?`, `onProgress?`): `Promise`\<`TreeKeyNode`\>

Async factory method for TreeKeyNode with progress reporting
Yields to event loop every few keys to keep UI responsive

#### Parameters

##### privateSeed

`Bytes`

##### keysPerLevel?

`number` = `DEFAULT_KEYS_PER_LEVEL`

##### onProgress?

[`ProgressCallback`](../type-aliases/ProgressCallback.md)

#### Returns

`Promise`\<`TreeKeyNode`\>

[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / StatechainOwner

# Interface: StatechainOwner

StatechainOwner — owner identity and Minima-faithful TreeKey signing
capability (RFC-009).

`signTree(message)` signs a `computeTransactionDigest` byte-array with this
owner's TreeKey, producing a root-bound Minima `TreeSignature`. Used for the
lock TX, reclaim TX, state-update TX, and cooperative claim. Minima binds the
signer's **root** public key (`SignatureProof.getRootPublicKey()`), so
`publicKeyDigest` carries that root — it is the value bound by
`STATE(0)`/`SIGNEDBY`/`MULTISIG` in the locking script.

Creation-time fields (only required on the owner passed to `createStateChain`):
  `address`  — the coin's current address (spending address of the input UTXO).
               If absent, `chainProvider.getCoin(coinId)` is used as fallback.
  `tokenId`  — token ID of the coin being locked.
  `amount`   — coin amount in MIN base units.
These three fields are stripped from the stored `StateChain.currentOwner`.

## Properties

### address?

> `optional` **address?**: `string`

Source coin address — required for the lock TX in createStateChain.

***

### amount?

> `optional` **amount?**: `bigint`

Coin amount in MIN base units — required when creating a new statechain.

***

### partyId

> **partyId**: `string`

***

### publicKeyDigest

> **publicKeyDigest**: `string`

TreeKey **root** public key (32-byte hex) — the owner's Minima identity.

***

### tokenId?

> `optional` **tokenId?**: `string`

Coin token ID — required when creating a new statechain.

## Methods

### signTree()

> **signTree**(`message`): `Promise`\<`TreeSignature`\>

Sign a digest with this owner's TreeKey. The returned `TreeSignature` is
root-bound and serialized via `serializeTreeSignature` into the witness.

#### Parameters

##### message

`Uint8Array`

#### Returns

`Promise`\<`TreeSignature`\>

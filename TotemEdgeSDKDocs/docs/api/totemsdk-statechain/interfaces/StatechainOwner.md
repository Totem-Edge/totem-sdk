[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / StatechainOwner

# Interface: StatechainOwner

StatechainOwner — owner identity and signing capability.

`sign(message)` signs a `computeTransactionDigest` byte-array with this
owner's WOTS key. Used for: lock TX, reclaimTx building, cooperative claim.

Creation-time fields (only required on the owner passed to `createStateChain`):
  `address`  — the coin's current address (spending address of the input UTXO).
               If absent, `chainProvider.getCoin(coinId)` is used as fallback.
  `tokenId`  — token ID of the coin being locked.
  `amount`   — coin amount in MIN base units.
These three fields are stripped from the stored `StateChain.currentOwner`.

`transferKeySeed` — WOTS seed (hex) for this owner's key slot.
Moved into `TransferRecord.transferKey` on outbound transfer, then zeroed
in-place on the original owner object so the secret does not linger in hot state.

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

***

### tokenId?

> `optional` **tokenId?**: `string`

Coin token ID — required when creating a new statechain.

***

### transferKeySeed?

> `optional` **transferKeySeed?**: `string`

## Methods

### sign()

> **sign**(`message`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Parameters

##### message

`Uint8Array`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

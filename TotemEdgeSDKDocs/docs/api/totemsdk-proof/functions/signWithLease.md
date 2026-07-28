[**@totemsdk/proof**](../index.md)

***

[@totemsdk/proof](../index.md) / signWithLease

# Function: signWithLease()

> **signWithLease**(`unsignedProof`, `seed`, `leaseProvider`, `options?`): `Promise`\<[`SignedProof`](../interfaces/SignedProof.md)\>

Sign an UnsignedProof using a WOTS lease provider to reserve the key index,
preventing concurrent-use or restart-reuse of one-time WOTS keys.

The lease provider must satisfy a minimal signature compatible with
@totemsdk/wots-lease's WotsLeaseProvider. Callers who manage key indices
directly should continue using signProof().

On success the reservation is committed. On failure it is burned so the
index can be marked unavailable rather than silently lost.

## Parameters

### unsignedProof

[`UnsignedProof`](../interfaces/UnsignedProof.md)

### seed

`Uint8Array`

### leaseProvider

#### burnReservation

#### commitKeyUse

#### reserveKeyUse

### options?

#### treeId?

`string`

#### ttlMs?

`number`

## Returns

`Promise`\<[`SignedProof`](../interfaces/SignedProof.md)\>

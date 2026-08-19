[**@totemsdk/location-proof**](../index.md)

***

[@totemsdk/location-proof](../index.md) / signLocationProofWithLease

# Function: signLocationProofWithLease()

> **signLocationProofWithLease**(`unsigned`, `seed`, `leaseProvider`, `options?`): `Promise`\<`SignedProof`\>

Sign an unsigned location proof using a WOTS lease provider to reserve the
key index, preventing concurrent-use or restart-reuse of one-time WOTS keys.

The lease provider must satisfy a minimal signature compatible with
@totemsdk/wots-lease's WotsLeaseProvider (see @totemsdk/proof.signWithLease).
Callers who manage key indices directly should use signLocationProof().

On success the reservation is committed. On failure it is burned so the
index can be marked unavailable rather than silently lost.

## Parameters

### unsigned

`UnsignedProof`

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

`Promise`\<`SignedProof`\>

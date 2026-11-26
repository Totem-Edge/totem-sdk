[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / buildHTLCScript

# Function: buildHTLCScript()

> **buildHTLCScript**(`ownerPublicKey`, `recipientPublicKey`, `hashLock`, `timeoutBlock`, `algorithm?`): `string`

Build the HTLC locking script. Single source of truth for the descriptor
builder and `HTLCHelper.createHTLC`.

Branch exclusivity is **time-bounded** (RFC-069 §6 invariant 5): after
`timeoutBlock` only the owner refund path is valid; at or before
`timeoutBlock` only the recipient preimage path is valid. The claim branch
MUST NOT remain spendable once the refund branch becomes valid, otherwise
the two paths race.

## Parameters

### ownerPublicKey

`string`

### recipientPublicKey

`string`

### hashLock

`string`

### timeoutBlock

`bigint`

### algorithm?

`"sha3"` \| `"sha2"`

## Returns

`string`

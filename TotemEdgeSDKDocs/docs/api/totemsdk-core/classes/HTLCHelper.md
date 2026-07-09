[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / HTLCHelper

# Class: HTLCHelper

HTLC Helper

Creates Hashed Timelock Contracts for atomic swaps and lightning-style payments.

## Constructors

### Constructor

> **new HTLCHelper**(): `HTLCHelper`

#### Returns

`HTLCHelper`

## Methods

### buildClaimDescriptor()

> `static` **buildClaimDescriptor**(`address`, `senderPublicKey`, `recipientPublicKey`, `hashLock`, `timeoutBlock`, `preimage`): [`ScriptDescriptor`](../interfaces/ScriptDescriptor.md)

Build ScriptDescriptor to claim HTLC with preimage.

#### Parameters

##### address

`string`

##### senderPublicKey

`string`

##### recipientPublicKey

`string`

##### hashLock

`string`

##### timeoutBlock

`bigint`

##### preimage

`string`

#### Returns

[`ScriptDescriptor`](../interfaces/ScriptDescriptor.md)

***

### buildRefundDescriptor()

> `static` **buildRefundDescriptor**(`address`, `senderPublicKey`, `recipientPublicKey`, `hashLock`, `timeoutBlock`): [`ScriptDescriptor`](../interfaces/ScriptDescriptor.md)

Build ScriptDescriptor to refund HTLC after timeout.

#### Parameters

##### address

`string`

##### senderPublicKey

`string`

##### recipientPublicKey

`string`

##### hashLock

`string`

##### timeoutBlock

`bigint`

#### Returns

[`ScriptDescriptor`](../interfaces/ScriptDescriptor.md)

***

### createHTLC()

> `static` **createHTLC**(`senderPublicKey`, `recipientPublicKey`, `hashLock`, `timeoutBlock`, `algorithm?`): `object`

Create an HTLC script.

The script allows:
- Recipient to claim with preimage before timeout
- Sender to refund after timeout

#### Parameters

##### senderPublicKey

`string`

##### recipientPublicKey

`string`

##### hashLock

`string`

##### timeoutBlock

`bigint`

##### algorithm?

`"sha3"` \| `"sha2"`

#### Returns

`object`

##### address

> **address**: `string`

##### script

> **script**: `string`

***

### generateSecret()

> `static` **generateSecret**(): `object`

Generate a random preimage and its hash.

#### Returns

`object`

##### hash

> **hash**: `string`

##### preimage

> **preimage**: `string`

***

### hashPreimage()

> `static` **hashPreimage**(`preimage`, `algorithm?`): `string`

Hash a preimage using SHA3 (default) or SHA2.

#### Parameters

##### preimage

`string`

##### algorithm?

`"sha3"` \| `"sha2"`

#### Returns

`string`

***

### verifyPreimage()

> `static` **verifyPreimage**(`preimage`, `expectedHash`, `algorithm?`): `boolean`

Verify a preimage matches a hash.

#### Parameters

##### preimage

`string`

##### expectedHash

`string`

##### algorithm?

`"sha3"` \| `"sha2"`

#### Returns

`boolean`

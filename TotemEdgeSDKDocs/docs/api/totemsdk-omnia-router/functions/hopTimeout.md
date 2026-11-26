[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / hopTimeout

# Function: hopTimeout()

> **hopTimeout**(`expiryBlock`, `delta`, `index`): `bigint`

Deadline of the `index`-th HTLC lock, counting from the payer.

Timeouts decrease toward the recipient: the downstream HTLC expires first so
the intermediary can claim it before its own incoming HTLC becomes
refundable.

## Parameters

### expiryBlock

`bigint`

### delta

`bigint`

### index

`number` \| `bigint`

## Returns

`bigint`

[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / PaymentResult

# Interface: PaymentResult

## Properties

### error?

> `optional` **error?**: `string`

***

### feeProofs?

> `optional` **feeProofs?**: [`RouterFeeProof`](RouterFeeProof.md)[]

Verifiable fee proofs for each settled hop — feeds recordPoolFee earn-proofs.

***

### preimage?

> `optional` **preimage?**: `string`

Hex preimage revealed during settlement (present on success)

***

### settledHops

> **settledHops**: `string`[]

htlcIds that were successfully settled

***

### success

> **success**: `boolean`

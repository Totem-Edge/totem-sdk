[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / ExitConfirmationEvidence

# Interface: ExitConfirmationEvidence

What a chain verifier observed for an exit transaction. A verifier that
cannot see the transaction must return `confirmed: false`.

## Properties

### amount?

> `optional` **amount?**: `string`

Amount the exit transaction paid, in the same units as `vtxo.amount`.

***

### block?

> `optional` **block?**: `number`

***

### confirmed

> **confirmed**: `boolean`

***

### owner?

> `optional` **owner?**: `string`

Owner the exit transaction paid, when the verifier can read it.

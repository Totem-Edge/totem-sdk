[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / VtxoExitEvidence

# Interface: VtxoExitEvidence

OMN-042: chain evidence for an exit transaction. Produced by a trusted
verifier — never by the RPC caller.

## Properties

### amount?

> `optional` **amount?**: `bigint`

Paid amount in atoms.

***

### confirmations?

> `optional` **confirmations?**: `number`

Depth of the exit transaction at verification time.

***

### owner?

> `optional` **owner?**: `string`

Address paid by the exit output.

***

### reason?

> `optional` **reason?**: `string`

***

### tokenId?

> `optional` **tokenId?**: `string`

***

### valid

> **valid**: `boolean`

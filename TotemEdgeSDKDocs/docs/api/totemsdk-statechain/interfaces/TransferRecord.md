[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / TransferRecord

# Interface: TransferRecord

TransferRecord — one entry per ownership hop in transferHistory.

`transferKey`    — prior owner's WOTS seed (hex) for custody-lineage proofs.
`ownerSignature` — hex of the old owner's WOTS sig over `signedDigest`.
  Stored so `verifyStateChain` can verify per-hop old-owner signatures.
`signedDigest`   — hex of computeTransactionDigest(stateUpdateTx).
  Bound to `txBodyHex` — `verifyStateChain` recomputes this digest from
  `txBodyHex` and rejects records where they do not match.
`txBodyHex`      — hex of the raw serialized Transaction bytes (NOT the full
  TxPoW). Used by `verifyStateChain` to prevent signature grafting: the
  stored `signedDigest` must equal sha3_256(fromHex(txBodyHex)).
`txHex`          — full TxPoW hex of the on-chain state-update TX.

## Properties

### blindedSignature

> **blindedSignature**: `string`

***

### from

> **from**: `string`

***

### fromPublicKeyDigest

> **fromPublicKeyDigest**: `string`

***

### ownerSignature

> **ownerSignature**: `string`

Hex of old owner's signature over signedDigest.

***

### signedDigest

> **signedDigest**: `string`

Hex of sha3_256(txBodyHex) — the TX body digest signed by old owner + SE.

***

### timestamp

> **timestamp**: `number`

***

### to

> **to**: `string`

***

### toPublicKeyDigest

> **toPublicKeyDigest**: `string`

***

### transferKey

> **transferKey**: `string`

Prior owner's WOTS seed for custody lineage verification.

***

### txBodyHex

> **txBodyHex**: `string`

Hex of the raw serialized Transaction bytes (not TxPoW envelope).
`verifyStateChain` recomputes sha3_256(txBodyHex) and asserts it equals
`signedDigest`, binding all signatures to the specific TX data.

***

### txHex

> **txHex**: `string`

Full TxPoW hex of the on-chain state-update TX.

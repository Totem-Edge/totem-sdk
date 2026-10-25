[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / TransferRecord

# Interface: TransferRecord

TransferRecord — one entry per ownership hop in transferHistory.

`ownerSignature` — hex of the old owner's serialized Minima `TreeSignature`
  over `signedDigest` (root-bound). Stored so `verifyStateChain` can verify
  per-hop old-owner authorization.
`seSignature`    — the SE's leased-leaf signature envelope over `signedDigest`.
`signedDigest`   — hex of computeTransactionDigest(stateUpdateTx).
  Bound to `txBodyHex` — `verifyStateChain` recomputes this digest from
  `txBodyHex` and rejects records where they do not match.
`txBodyHex`      — hex of the raw serialized Transaction bytes (NOT the full
  TxPoW). Used by `verifyStateChain` to prevent signature grafting: the
  stored `signedDigest` must equal sha3_256(fromHex(txBodyHex)).
`txHex`          — full TxPoW hex of the on-chain state-update TX.

## Properties

### from

> **from**: `string`

***

### fromPublicKeyDigest

> **fromPublicKeyDigest**: `string`

***

### ownerSignature

> **ownerSignature**: `string`

Hex of old owner's serialized Minima `TreeSignature` over signedDigest.

***

### seSignature

> **seSignature**: `SESignature`

RFC-008: the SE signature envelope. Carries the leased leaf (`kind`,
`publicKey`, `address`, `proofVersion`) so `verifyStateChain` can check leaf
authorization against the SE root's `OwnershipProof`.

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

### txBodyHex

> **txBodyHex**: `string`

Hex of the raw serialized Transaction bytes (not TxPoW envelope).
`verifyStateChain` recomputes sha3_256(txBodyHex) and asserts it equals
`signedDigest`, binding all signatures to the specific TX data.

***

### txHex

> **txHex**: `string`

Full TxPoW hex of the on-chain state-update TX.

***

### txTimeMilli?

> `optional` **txTimeMilli?**: `number`

AUD-012: the TxPoW header `timeMilli` used when `txHex` was built, so the
TxPoW can be reconstructed and bound to the signed body. Absent on records
created before this field (legacy `txHex` binding is skipped).

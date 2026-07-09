[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / StatechainLeaseProvider

# Interface: StatechainLeaseProvider

StatechainLeaseProvider — operational context for SE-based flows.

Used by `createStateChain`, `claimOwnership`, and `reclaimAbandoned`.

`broadcast`  — if present, cooperative claim / reclaim broadcast the TxPoW.
`getTip`     — if present alongside `proof.timelockBlock`, `reclaimAbandoned`
  validates the current block height before broadcasting.
`verifyBlindSig` — test override for SE blind-sig verification.

## Properties

### broadcast?

> `optional` **broadcast?**: (`txHex`) => `Promise`\<\{ `success?`: `boolean`; `txpowid?`: `string`; \}\>

#### Parameters

##### txHex

`string`

#### Returns

`Promise`\<\{ `success?`: `boolean`; `txpowid?`: `string`; \}\>

***

### getTip?

> `optional` **getTip?**: () => `Promise`\<\{ `block`: `number`; \} \| `undefined`\>

#### Returns

`Promise`\<\{ `block`: `number`; \} \| `undefined`\>

***

### leaseOps?

> `optional` **leaseOps?**: [`StatechainLeaseOps`](StatechainLeaseOps.md)

***

### seClient

> **seClient**: [`SEClient`](SEClient.md)

***

### verifyBlindSig?

> `optional` **verifyBlindSig?**: (`sig`, `commitment`, `sePkdHex`) => `boolean`

#### Parameters

##### sig

`string`

##### commitment

`Uint8Array`

##### sePkdHex

`string`

#### Returns

`boolean`

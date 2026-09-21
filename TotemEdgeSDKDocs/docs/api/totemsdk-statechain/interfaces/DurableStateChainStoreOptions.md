[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / DurableStateChainStoreOptions

# Interface: DurableStateChainStoreOptions

## Properties

### namespace?

> `readonly` `optional` **namespace?**: `string`

Key namespace prefix; default `totem_statechain:v1:`.

***

### requireAckMode?

> `readonly` `optional` **requireAckMode?**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"`

Required write acknowledgment; default `durably-acknowledged`. Pass
`volatile` only for tests/scratch adapters (e.g. `MemoryStore`).

***

### verify?

> `readonly` `optional` **verify?**: (`chain`, `opts?`) => `VerifyResult`

Structural validation hook run over each `StateChain` at load and before
each save (default: a strict `verifyChainIntegrity` check).

#### Parameters

##### chain

[`StateChain`](StateChain.md)

##### opts?

[`VerifyOptions`](VerifyOptions.md)

#### Returns

`VerifyResult`

***

### verifyOptions?

> `readonly` `optional` **verifyOptions?**: [`VerifyOptions`](VerifyOptions.md)

Verification-override options (test/self-hosted SE mocks).

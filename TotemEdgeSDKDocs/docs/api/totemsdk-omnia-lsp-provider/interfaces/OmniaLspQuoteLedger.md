[**@totemsdk/omnia-lsp-provider**](../index.md)

***

[@totemsdk/omnia-lsp-provider](../index.md) / OmniaLspQuoteLedger

# Interface: OmniaLspQuoteLedger

## Methods

### consume()

> **consume**(`quoteId`, `now?`): [`ConsumeReservationResult`](../type-aliases/ConsumeReservationResult.md) \| `Promise`\<[`ConsumeReservationResult`](../type-aliases/ConsumeReservationResult.md)\>

Atomically move a live reservation to consumed. `unknown` must be returned
when this ledger has no record, never an implicit success.

#### Parameters

##### quoteId

`string`

##### now?

`number`

#### Returns

[`ConsumeReservationResult`](../type-aliases/ConsumeReservationResult.md) \| `Promise`\<[`ConsumeReservationResult`](../type-aliases/ConsumeReservationResult.md)\>

***

### outstanding()

> **outstanding**(`tokenId`, `providerId`, `now?`): `bigint` \| `Promise`\<`bigint`\>

Sum of live reservations for a token and provider, in integer units.

#### Parameters

##### tokenId

`string`

##### providerId

`string`

##### now?

`number`

#### Returns

`bigint` \| `Promise`\<`bigint`\>

***

### prune()?

> `optional` **prune**(`now?`): `void` \| `Promise`\<`void`\>

Optional: drop final or expired entries.

#### Parameters

##### now?

`number`

#### Returns

`void` \| `Promise`\<`void`\>

***

### release()

> **release**(`quoteId`, `now?`): `void` \| `Promise`\<`void`\>

Free a reservation. No-op when unknown or already final.

#### Parameters

##### quoteId

`string`

##### now?

`number`

#### Returns

`void` \| `Promise`\<`void`\>

***

### reserve()

> **reserve**(`entry`): `void` \| `Promise`\<`void`\>

Record a reservation. Throws if the quoteId is already known.

#### Parameters

##### entry

[`OmniaLspQuoteReservation`](OmniaLspQuoteReservation.md)

#### Returns

`void` \| `Promise`\<`void`\>

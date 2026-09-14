[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / ResourceAdapter

# Interface: ResourceAdapter

Resource adapter boundary — purchasing core must not know how every
resource executes.

## Methods

### close()?

> `optional` **close**(`handle`): `Promise`\<`void`\>

#### Parameters

##### handle

[`ResourceHandle`](ResourceHandle.md)

#### Returns

`Promise`\<`void`\>

***

### meter()?

> `optional` **meter**(`handle`): `AsyncIterable`\<[`UsageEvent`](UsageEvent.md)\>

#### Parameters

##### handle

[`ResourceHandle`](ResourceHandle.md)

#### Returns

`AsyncIterable`\<[`UsageEvent`](UsageEvent.md)\>

***

### recover()?

> `optional` **recover**(`reference`, `agreement`, `context`): `Promise`\<\{ `handle`: [`ResourceHandle`](ResourceHandle.md); `state`: `"ACTIVE"`; \} \| \{ `result?`: `unknown`; `state`: `"COMPLETED"`; \} \| \{ `state`: `"MISSING"`; \} \| \{ `state`: `"UNKNOWN"`; \}\>

Recover a resource that may have been started before a crash.

`reference` is the stable external identity persisted in the purchase
record (e.g. compute job ID, container ID, storage lease ID, robot task
ID). The adapter must NOT start another identical resource — it reconnects
to the existing one.

Returns:
  ACTIVE    — the resource is running; a usable handle is returned.
  COMPLETED — the resource already finished; no handle needed.
  MISSING   — the resource no longer exists; safe to treat as not started.
  UNKNOWN   — cannot determine state; block automatic duplicate execution.

#### Parameters

##### reference

`PersistedResourceReference`

##### agreement

[`TradeAgreement`](TradeAgreement.md)

##### context

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<\{ `handle`: [`ResourceHandle`](ResourceHandle.md); `state`: `"ACTIVE"`; \} \| \{ `result?`: `unknown`; `state`: `"COMPLETED"`; \} \| \{ `state`: `"MISSING"`; \} \| \{ `state`: `"UNKNOWN"`; \}\>

***

### start()

> **start**(`agreement`, `context`): `Promise`\<[`ResourceHandle`](ResourceHandle.md)\>

#### Parameters

##### agreement

[`TradeAgreement`](TradeAgreement.md)

##### context

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<[`ResourceHandle`](ResourceHandle.md)\>

***

### supports()

> **supports**(`resource`, `manifest`): `boolean`

#### Parameters

##### resource

`string`

##### manifest

`SignedManifest`

#### Returns

`boolean`

[**@totemsdk/pubsub-transport**](../index.md)

***

[@totemsdk/pubsub-transport](../index.md) / EmitterLike

# Interface: EmitterLike

Minimal emitter contract (Node `EventEmitter`-compatible). Using this instead
of `node:events` keeps the in-process transport runtime-agnostic (RFC-031 P2):
it works on Bare/Bun/browser/Node. A real Node `EventEmitter` can still be
injected via the `bus` constructor argument.

## Methods

### emit()

> **emit**(`event`, ...`args`): `boolean`

#### Parameters

##### event

`string`

##### args

...`unknown`[]

#### Returns

`boolean`

***

### listenerCount()

> **listenerCount**(`event`): `number`

#### Parameters

##### event

`string`

#### Returns

`number`

***

### off()

> **off**(`event`, `listener`): `unknown`

#### Parameters

##### event

`string`

##### listener

(...`args`) => `void`

#### Returns

`unknown`

***

### on()

> **on**(`event`, `listener`): `unknown`

#### Parameters

##### event

`string`

##### listener

(...`args`) => `void`

#### Returns

`unknown`

***

### removeAllListeners()

> **removeAllListeners**(): `unknown`

#### Returns

`unknown`

***

### setMaxListeners()?

> `optional` **setMaxListeners**(`n?`): `unknown`

#### Parameters

##### n?

`number`

#### Returns

`unknown`

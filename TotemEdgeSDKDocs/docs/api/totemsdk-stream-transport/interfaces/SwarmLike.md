[**@totemsdk/stream-transport**](../index.md)

***

[@totemsdk/stream-transport](../index.md) / SwarmLike

# Interface: SwarmLike

Minimal Hyperswarm surface used by the manager. Tests inject a fake; the
production path dynamically imports `hyperswarm`.

## Methods

### destroy()?

> `optional` **destroy**(): `unknown`

#### Returns

`unknown`

***

### join()

> **join**(`topic`, `opts?`): `void` \| [`SwarmDiscovery`](SwarmDiscovery.md)

#### Parameters

##### topic

`Uint8Array`

##### opts?

###### client?

`boolean`

###### server?

`boolean`

#### Returns

`void` \| [`SwarmDiscovery`](SwarmDiscovery.md)

***

### on()

> **on**(`event`, `handler`): `unknown`

#### Parameters

##### event

`"connection"`

##### handler

(`conn`, `info`) => `void`

#### Returns

`unknown`

***

### removeListener()?

> `optional` **removeListener**(`event`, `handler`): `unknown`

#### Parameters

##### event

`"connection"`

##### handler

(...`args`) => `void`

#### Returns

`unknown`

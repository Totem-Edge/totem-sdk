[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / ITransport

# Interface: ITransport

BareHyperswarm — ITransport adapter wrapping Bare-native Hyperswarm.

Provides the same `ITransport` interface used by `@totemsdk/lookup-client`
and `@totemsdk/omnia-hyperswarm` so Pear apps can use the same high-level
clients without modification.

Usage:
  const swarm = new BareHyperswarm();
  const transport = await swarm.connect(topicHex, { client: true });
  lookupClient = new LookupClient({ _transport: transport });

Bare-compatible: Hyperswarm is loaded via dynamic import so the module
is importable in environments where the package is absent.

## Methods

### close()

> **close**(): `void`

#### Returns

`void`

***

### on()

#### Call Signature

> **on**(`event`, `handler`): `void`

##### Parameters

###### event

`"data"`

###### handler

(`chunk`) => `void`

##### Returns

`void`

#### Call Signature

> **on**(`event`, `handler`): `void`

##### Parameters

###### event

`"close"`

###### handler

() => `void`

##### Returns

`void`

#### Call Signature

> **on**(`event`, `handler`): `void`

##### Parameters

###### event

`"error"`

###### handler

(`err`) => `void`

##### Returns

`void`

***

### send()

> **send**(`data`): `void`

#### Parameters

##### data

`Uint8Array`

#### Returns

`void`

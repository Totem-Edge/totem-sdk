[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / ResourceRegistry

# Interface: ResourceRegistry

## Methods

### get()

> **get**(`id`): [`Resource`](Resource.md) \| `undefined`

#### Parameters

##### id

[`ResourceId`](ResourceId.md)

#### Returns

[`Resource`](Resource.md) \| `undefined`

***

### list()

> **list**(): [`Resource`](Resource.md)[]

#### Returns

[`Resource`](Resource.md)[]

***

### register()

> **register**(`resource`): `void`

#### Parameters

##### resource

[`Resource`](Resource.md)

#### Returns

`void`

***

### resolveAddress()

> **resolveAddress**(`id`, `protocol?`): [`ResourceAddress`](ResourceAddress.md) \| `undefined`

Resolve the best address for a protocol (or the first when unspecified).

#### Parameters

##### id

[`ResourceId`](ResourceId.md)

##### protocol?

`string`

#### Returns

[`ResourceAddress`](ResourceAddress.md) \| `undefined`

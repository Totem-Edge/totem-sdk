[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / ChannelOps

# Interface: ChannelOps

Dependency-injected HTLC operations.

In production, wire in the real functions from @totemsdk/omnia:
  import { addHTLC, fulfillHTLC, timeoutHTLC } from '@totemsdk/omnia';
  const ops: ChannelOps = { addHTLC, fulfillHTLC, timeoutHTLC };

In tests, pass mocks directly — no jest.mock() needed.

## Methods

### addHTLC()

> **addHTLC**(`channel`, `params`, `leaseProvider`): `Promise`\<\{ `channel`: [`RouterChannel`](RouterChannel.md); `error?`: `string`; `htlcId`: `string`; \}\>

#### Parameters

##### channel

[`RouterChannel`](RouterChannel.md)

##### params

[`HTLCParams`](HTLCParams.md)

##### leaseProvider

`unknown`

#### Returns

`Promise`\<\{ `channel`: [`RouterChannel`](RouterChannel.md); `error?`: `string`; `htlcId`: `string`; \}\>

***

### fulfillHTLC()

> **fulfillHTLC**(`channel`, `htlcId`, `preimage`, `leaseProvider`): `Promise`\<\{ `channel`: [`RouterChannel`](RouterChannel.md); `error?`: `string`; \}\>

#### Parameters

##### channel

[`RouterChannel`](RouterChannel.md)

##### htlcId

`string`

##### preimage

`string`

##### leaseProvider

`unknown`

#### Returns

`Promise`\<\{ `channel`: [`RouterChannel`](RouterChannel.md); `error?`: `string`; \}\>

***

### timeoutHTLC()

> **timeoutHTLC**(`channel`, `htlcId`, `leaseProvider`): `Promise`\<\{ `channel`: [`RouterChannel`](RouterChannel.md); `error?`: `string`; \}\>

#### Parameters

##### channel

[`RouterChannel`](RouterChannel.md)

##### htlcId

`string`

##### leaseProvider

`unknown`

#### Returns

`Promise`\<\{ `channel`: [`RouterChannel`](RouterChannel.md); `error?`: `string`; \}\>

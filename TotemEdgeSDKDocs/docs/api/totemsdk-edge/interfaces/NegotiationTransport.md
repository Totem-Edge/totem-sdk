[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / NegotiationTransport

# Interface: NegotiationTransport

Authenticated negotiation transport boundary.

`send` returns a DeliveryReceipt when the transport can prove the remote
machine durably received/claimed the message (request/response or a durable
acknowledgement), or `undefined` when the transport is fire-and-forget
(e.g. pub/sub) and cannot prove durable remote processing. The outbox
drainer must NOT mark a message delivered when `undefined` is returned —
local transmission is not durable delivery.

## Methods

### send()

> **send**(`recipient`, `message`): `Promise`\<[`DeliveryReceipt`](DeliveryReceipt.md) \| `undefined`\>

#### Parameters

##### recipient

`string`

##### message

[`NegotiationMessage`](../type-aliases/NegotiationMessage.md)

#### Returns

`Promise`\<[`DeliveryReceipt`](DeliveryReceipt.md) \| `undefined`\>

***

### subscribe()

> **subscribe**(`handler`): `Unsubscribe` \| `Promise`\<`Unsubscribe`\>

#### Parameters

##### handler

(`message`, `context`) => `Promise`\<`void`\>

#### Returns

`Unsubscribe` \| `Promise`\<`Unsubscribe`\>

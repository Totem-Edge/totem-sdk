[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / InMemoryNegotiationTransport

# Class: InMemoryNegotiationTransport

Deterministic in-memory transport for tests and local/programmatic
negotiation. Delivers messages synchronously to subscribed handlers, and
returns a DeliveryReceipt when the handler is present (durably delivered).

## Implements

- [`NegotiationTransport`](../interfaces/NegotiationTransport.md)

## Constructors

### Constructor

> **new InMemoryNegotiationTransport**(): `InMemoryNegotiationTransport`

#### Returns

`InMemoryNegotiationTransport`

## Methods

### getSent()

> **getSent**(): `object`[]

Inspect delivered messages (for tests).

#### Returns

`object`[]

***

### send()

> **send**(`recipient`, `message`): `Promise`\<[`DeliveryReceipt`](../interfaces/DeliveryReceipt.md) \| `undefined`\>

#### Parameters

##### recipient

`string`

##### message

[`NegotiationMessage`](../type-aliases/NegotiationMessage.md)

#### Returns

`Promise`\<[`DeliveryReceipt`](../interfaces/DeliveryReceipt.md) \| `undefined`\>

#### Implementation of

[`NegotiationTransport`](../interfaces/NegotiationTransport.md).[`send`](../interfaces/NegotiationTransport.md#send)

***

### subscribe()

> **subscribe**(`handler`): `Unsubscribe`

#### Parameters

##### handler

(`message`, `context`) => `Promise`\<`void`\>

#### Returns

`Unsubscribe`

#### Implementation of

[`NegotiationTransport`](../interfaces/NegotiationTransport.md).[`subscribe`](../interfaces/NegotiationTransport.md#subscribe)

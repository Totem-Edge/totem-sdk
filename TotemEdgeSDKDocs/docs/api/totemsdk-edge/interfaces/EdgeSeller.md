[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeSeller

# Interface: EdgeSeller

## Properties

### engine

> **engine**: [`NegotiationEngine`](../classes/NegotiationEngine.md)

The underlying engine (advanced use / recovery).

## Methods

### getState()

> **getState**(`negotiationId`): `Promise`\<[`NegotiationState`](../type-aliases/NegotiationState.md) \| `undefined`\>

Get current negotiation state.

#### Parameters

##### negotiationId

`string`

#### Returns

`Promise`\<[`NegotiationState`](../type-aliases/NegotiationState.md) \| `undefined`\>

***

### handleInbound()

> **handleInbound**(`message`, `context`): `Promise`\<[`ReplayOutcome`](ReplayOutcome.md)\>

Handle a single authenticated inbound message (advanced use).

#### Parameters

##### message

[`NegotiationMessage`](../type-aliases/NegotiationMessage.md)

##### context

[`TransportMessageContext`](TransportMessageContext.md)

#### Returns

`Promise`\<[`ReplayOutcome`](ReplayOutcome.md)\>

***

### issueChallenge()

> **issueChallenge**(`negotiationId`): `Promise`\<[`WorkRequired`](WorkRequired.md)\>

Issue a WorkRequired challenge for the next round (advanced use).

#### Parameters

##### negotiationId

`string`

#### Returns

`Promise`\<[`WorkRequired`](WorkRequired.md)\>

***

### openNegotiation()

> **openNegotiation**(`opts`): `Promise`\<[`NegotiationRecord`](NegotiationRecord.md)\>

Open a negotiation locally in response to a buyer request (advanced use).

#### Parameters

##### opts

###### counterparty

`string`

###### expiresAt?

`number`

###### manifestId

`string`

###### negotiationId

`string`

#### Returns

`Promise`\<[`NegotiationRecord`](NegotiationRecord.md)\>

***

### subscribe()

> **subscribe**(`transport`): `Promise`\<() => `void`\>

Subscribe to a negotiation transport.

#### Parameters

##### transport

[`NegotiationTransport`](NegotiationTransport.md)

#### Returns

`Promise`\<() => `void`\>

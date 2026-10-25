[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / CoordinationContext

# Interface: CoordinationContext

## Properties

### correlationId

> **correlationId**: `string`

***

### from

> **from**: `string`

Routing identity (`peer.pubkey`) — never trusted for authorization.

***

### message

> **message**: [`OmniaMessage`](OmniaMessage.md)

***

### peer

> **peer**: [`OmniaPeer`](OmniaPeer.md)

***

### policy

> **policy**: `Required`\<[`CoordinationPolicy`](CoordinationPolicy.md)\>

The active policy (consent + TTL).

***

### send

> **send**: (`type`, `payload`) => `Promise`\<`void`\>

Reply on the same peer/correlation.

#### Parameters

##### type

[`OmniaMessageType`](../type-aliases/OmniaMessageType.md)

##### payload

`unknown`

#### Returns

`Promise`\<`void`\>

***

### sendTo

> **sendTo**: (`peer`, `type`, `payload`) => `Promise`\<`void`\>

Send on any peer (same correlationId) — e.g. FINALIZED fan-out to all signers.

#### Parameters

##### peer

[`OmniaPeer`](OmniaPeer.md)

##### type

[`OmniaMessageType`](../type-aliases/OmniaMessageType.md)

##### payload

`unknown`

#### Returns

`Promise`\<`void`\>

***

### store

> **store**: [`CoordinationStore`](CoordinationStore.md)

The coordination store (read the originating proposal, record state).

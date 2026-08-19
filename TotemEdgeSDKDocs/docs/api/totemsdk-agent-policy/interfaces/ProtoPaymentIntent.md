[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / ProtoPaymentIntent

# Interface: ProtoPaymentIntent

## Generated

from protobuf message totem.agent.policy.v1.PaymentIntent

## Properties

### amount

> **amount**: `string`

#### Generated

from protobuf field: string amount = 2

***

### metadata?

> `optional` **metadata?**: `Struct`

#### Generated

from protobuf field: google.protobuf.Struct metadata = 7

***

### reason

> **reason**: `string`

#### Generated

from protobuf field: string reason = 5

***

### recipient

> **recipient**: `string`

#### Generated

from protobuf field: string recipient = 4

***

### risk

> **risk**: [`RiskLevel`](../enumerations/RiskLevel.md)

#### Generated

from protobuf field: totem.agent.policy.v1.RiskLevel risk = 6

***

### tokenId

> **tokenId**: `string`

#### Generated

from protobuf field: string token_id = 3

***

### type

> **type**: [`IntentType`](../enumerations/IntentType.md)

#### Generated

from protobuf field: totem.agent.policy.v1.IntentType type = 1

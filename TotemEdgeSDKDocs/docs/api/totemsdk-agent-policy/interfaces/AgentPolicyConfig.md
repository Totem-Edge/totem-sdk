[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / AgentPolicyConfig

# Interface: AgentPolicyConfig

## Generated

from protobuf message totem.agent.policy.v1.AgentPolicyConfig

## Properties

### agentId

> **agentId**: `string`

#### Generated

from protobuf field: string agent_id = 1

***

### allowedIntents

> **allowedIntents**: [`IntentType`](../enumerations/IntentType.md)[]

#### Generated

from protobuf field: repeated totem.agent.policy.v1.IntentType allowed_intents = 2

***

### expiresAt

> **expiresAt**: `string`

#### Generated

from protobuf field: int64 expires_at = 4

***

### limits

> **limits**: `object`

#### Index Signature

\[`key`: `string`\]: `string`

#### Generated

from protobuf field: map<string, string> limits = 3

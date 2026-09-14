[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / AgentEdgeRuntimeOptions

# Interface: AgentEdgeRuntimeOptions

## Properties

### agentId

> **agentId**: `string`

***

### capabilities

> **capabilities**: [`EdgeCapabilitySet`](../type-aliases/EdgeCapabilitySet.md)

***

### deviceId

> **deviceId**: `string`

***

### now?

> `optional` **now?**: () => `number`

Injectable clock (defaults to Date.now).

#### Returns

`number`

***

### policy

> **policy**: `GrantBoundAutonomyPolicy`

Run-level autonomy policy — the authorization engine.

***

### principal

> **principal**: `string`

***

### registry

> **registry**: [`EdgeActionRegistry`](EdgeActionRegistry.md)

***

### runId

> **runId**: `string`

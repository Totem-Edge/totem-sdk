[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / AgentIdentity

# Interface: AgentIdentity

Minimal agent identity for lookup-node registration and capability
advertisement. Contains NO private keys — just an address and capability list.

Signing the capability announcement is always the wallet's responsibility,
never the agent's.

## Properties

### address

> **address**: `string`

Minima address where this agent accepts payments.
This is NOT a signing key — it is just an address for receiving funds.

***

### agentId

> **agentId**: `string`

Opaque string chosen by the agent (e.g. "my-invoice-agent-1").

***

### capabilities

> **capabilities**: `string`[]

Capability names this agent can service (e.g. ["invoice-parse", "fx-quote"]).

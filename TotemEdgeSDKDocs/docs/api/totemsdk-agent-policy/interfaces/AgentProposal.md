[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / AgentProposal

# Interface: AgentProposal

A concrete proposal from an agent, wrapping a PaymentIntent.
The wallet evaluates this against an AgentPolicy before signing anything.

## Properties

### agentId

> **agentId**: `string`

Opaque agent identifier — NOT a public key, NOT a root-identity reference.
Just a string the agent chooses (e.g. "qvac-payment-agent-v1").

***

### confidence

> **confidence**: `number`

Agent's confidence in the proposal (0 = uncertain, 1 = certain).

***

### createdAt

> **createdAt**: `number`

Unix timestamp (ms) when this proposal was created.

***

### explanation

> **explanation**: `string`

Human-readable justification shown to the user in the approval UI.

***

### id

> **id**: `string`

Unique proposal identifier (UUID or agent-generated opaque string).

***

### intent

> **intent**: [`PaymentIntent`](PaymentIntent.md)

The intent this proposal wants executed.

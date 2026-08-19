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

***

### principal?

> `optional` **principal?**: `string`

Authenticated principal supplied by the trusted execution boundary
(e.g. the wallet's resolved signer public-key digest or session ID).

`agentId` is chosen by the agent and can be rotated to evade limits.
Stateful policies MUST key quota buckets by `principal` when present,
never by the caller-controlled `agentId` alone. The agent cannot set
this field itself; only the wallet layer that executes the proposal
populates it after authenticating the signer.

[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / PurchaseAuthorityAdapterConfig

# Interface: PurchaseAuthorityAdapterConfig

## Properties

### agentId?

> `optional` **agentId?**: `string`

Agent identifier used in the AgentProposal (e.g. 'edge-purchase-agent').

***

### policy

> **policy**: `PolicyLike`

The local policy (ComposablePolicy, AgentPolicy, or PolicyMiddleware).

***

### risk?

> `optional` **risk?**: `"low"` \| `"medium"` \| `"high"`

Optional risk level for the proposal.

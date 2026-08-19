[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / createPolicyPortAdapter

# Function: createPolicyPortAdapter()

> **createPolicyPortAdapter**(`policy`): `EdgePolicyPort`

Wraps an AgentPolicy or PolicyMiddleware as an EdgePolicyPort.

When the EdgePolicyPort receives a full `proposal` object, it delegates
directly to the policy without lossy reconstruction. When only flat
`action`/`subject` params are provided, it builds a minimal AgentProposal
(legacy path).

## Parameters

### policy

`PolicyLike`

## Returns

`EdgePolicyPort`

[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / createPolicyPortAdapter

# Function: createPolicyPortAdapter()

> **createPolicyPortAdapter**(`policy`): `EdgePolicyPort`

Wraps an AgentPolicy as an EdgePolicyPort.

Builds a minimal AgentProposal from the EdgePolicyPort check() params and
delegates to policy.canAutoApprove(). The intent type is inferred from the
action string (actions starting with 'pay' map to 'payment'; everything
else maps to 'receipt' as a catch-all).

## Parameters

### policy

`AgentPolicy`

## Returns

`EdgePolicyPort`

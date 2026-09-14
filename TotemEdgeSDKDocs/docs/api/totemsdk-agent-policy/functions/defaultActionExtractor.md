[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / defaultActionExtractor

# Function: defaultActionExtractor()

> **defaultActionExtractor**(`proposal`): [`AuthorityActionIntent`](../interfaces/AuthorityActionIntent.md)

Default mapping: AgentProposal → AuthorityActionIntent.

The action is the intent type itself. The principal is the authenticated
`proposal.principal` (falling back to `agentId` only when strict mode is
off). The target is the recipient. Intent fields and metadata are exposed
as constraints so dotted paths (`payload.*`) resolve via
`@totemsdk/authority`'s `resolveActionField`.

## Parameters

### proposal

[`AgentProposal`](../interfaces/AgentProposal.md)

## Returns

[`AuthorityActionIntent`](../interfaces/AuthorityActionIntent.md)

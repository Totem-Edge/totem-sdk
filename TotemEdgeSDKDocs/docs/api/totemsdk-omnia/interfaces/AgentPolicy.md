[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / AgentPolicy

# Interface: AgentPolicy

Policy evaluated by the Totem wallet layer — NEVER by the agent.

The wallet implements this interface to decide whether to auto-sign or
route to the user. The AI never has access to the policy implementation.

## Methods

### canAutoApprove()

> **canAutoApprove**(`proposal`): `Promise`\<`boolean`\>

Return true if the wallet should sign the intent without user interaction.
Implementations typically check risk, amount thresholds, and known agents.

#### Parameters

##### proposal

`AgentProposal`

#### Returns

`Promise`\<`boolean`\>

***

### requiresUserApproval()

> **requiresUserApproval**(`proposal`): `Promise`\<`boolean`\>

Return true if the wallet must show a user-approval UI before signing.
Generally the complement of canAutoApprove, but may have independent logic
(e.g. always require approval for settlements regardless of risk).

#### Parameters

##### proposal

`AgentProposal`

#### Returns

`Promise`\<`boolean`\>

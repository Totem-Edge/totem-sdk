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

### commit()?

> `optional` **commit**(`operationId`): `Promise`\<`void`\>

#### Parameters

##### operationId

`string`

#### Returns

`Promise`\<`void`\>

***

### release()?

> `optional` **release**(`operationId`): `Promise`\<`void`\>

#### Parameters

##### operationId

`string`

#### Returns

`Promise`\<`void`\>

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

***

### reserve()?

> `optional` **reserve**(`proposal`): `Promise`\<`PolicyEvalResult`\>

Optional reservation lifecycle for stateful policies.

The execution boundary calls `reserve` before executing, then `commit`
after a successful execution or `release` on any failure path. When
implemented, quota is only consumed through reserve/commit — a read-only
`evaluate` / `canAutoApprove` never touches the limits.

#### Parameters

##### proposal

`AgentProposal`

#### Returns

`Promise`\<`PolicyEvalResult`\>

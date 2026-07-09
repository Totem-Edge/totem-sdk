[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / AgentReceipt

# Interface: AgentReceipt

Result returned to the agent after Totem has processed the intent.
The agent uses this to learn whether its proposal was executed.

## Properties

### channelState?

> `optional` **channelState?**: `string`

Serialised Omnia channel state, set when an off-chain channel was updated.

***

### proposalId

> **proposalId**: `string`

Matches AgentProposal.id — ties the receipt back to the original proposal.

***

### rejectionReason?

> `optional` **rejectionReason?**: `string`

Human-readable reason, set when status is 'rejected'.

***

### settledAt?

> `optional` **settledAt?**: `number`

Unix timestamp (ms) when the intent was settled (signed/rejected).

***

### status

> **status**: `"approved"` \| `"pending_user"` \| `"rejected"`

- 'approved'      — wallet signed and broadcast the transaction
- 'rejected'      — wallet or policy rejected the proposal
- 'pending_user'  — waiting for explicit user approval in the UI

***

### txpowId?

> `optional` **txpowId?**: `string`

TxPoW ID, set when a transaction was successfully mined and broadcast.

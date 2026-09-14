[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / AutonomousRun

# Interface: AutonomousRun

## Properties

### agentId

> **agentId**: `string`

***

### grantProofIds

> **grantProofIds**: `string`[]

Signed mandate proof ids this run may draw from.

***

### mode

> **mode**: [`RunMode`](../type-aliases/RunMode.md)

***

### planDigest?

> `optional` **planDigest?**: `string`

Plan digest, when plan_locked.

***

### principal

> **principal**: `string`

Authenticated principal (wallet-resolved signer / session), never agentId.

***

### runId

> **runId**: `string`

***

### startedAt

> **startedAt**: `number`

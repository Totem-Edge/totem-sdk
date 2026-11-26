[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / FactoryCheckpointParams

# Interface: FactoryCheckpointParams

## Properties

### allocations

> **allocations**: `Record`\<`string`, `bigint`\>

New per-party allocations in atoms. Must conserve `totalValue`.

***

### escapeBlock

> **escapeBlock**: `number` \| `bigint`

Absolute escape block, carried forward from the committed state.

***

### fundingAddress

> **fundingAddress**: `string`

Address and coin of the factory UTXO being consumed.

***

### fundingCoinId

> **fundingCoinId**: `string`

***

### participants

> **participants**: [`FactoryParticipant`](FactoryParticipant.md)[]

***

### previousSequence?

> `optional` **previousSequence?**: `number` \| `bigint`

***

### previousStateVariables?

> `optional` **previousStateVariables?**: `StateValue`[]

Previous state variables of the spent coin (for PREVSTATE continuity).

***

### sequence

> **sequence**: `number` \| `bigint`

New sequence; must be strictly greater than `previousSequence`.

***

### tokenId

> **tokenId**: `string`

***

### tokenScale

> **tokenScale**: `number`

***

### totalValue

> **totalValue**: `bigint`

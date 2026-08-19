[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / buildProgramUpdateTx

# Function: buildProgramUpdateTx()

> **buildProgramUpdateTx**(`channel`, `sequence`, `balances`, `pendingHTLCs`, `transition?`): [`OmniaTxDraft`](../interfaces/OmniaTxDraft.md)

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### sequence

`number`

### balances

`Record`\<`string`, `bigint`\>

### pendingHTLCs

[`HTLCRecord`](../interfaces/HTLCRecord.md)[]

### transition?

[`ProgramTransition`](../interfaces/ProgramTransition.md)

## Returns

[`OmniaTxDraft`](../interfaces/OmniaTxDraft.md)

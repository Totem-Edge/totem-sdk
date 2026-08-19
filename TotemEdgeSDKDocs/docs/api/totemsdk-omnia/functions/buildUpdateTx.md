[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / buildUpdateTx

# Function: buildUpdateTx()

> **buildUpdateTx**(`channel`, `newSequence`, `newBalances`, `pendingHTLCs`, `programStateVariables?`): [`OmniaTxDraft`](../interfaces/OmniaTxDraft.md)

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### newSequence

`number`

### newBalances

`Record`\<`string`, `bigint`\>

### pendingHTLCs

[`HTLCRecord`](../interfaces/HTLCRecord.md)[]

### programStateVariables?

[`StateValue`](../interfaces/StateValue.md)[] = `[]`

## Returns

[`OmniaTxDraft`](../interfaces/OmniaTxDraft.md)

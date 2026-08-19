[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / computeStateCommitmentV2

# Function: computeStateCommitmentV2()

> **computeStateCommitmentV2**(`channel`, `sequence`, `balances`, `pendingHTLCs`, `opts?`): `Uint8Array`

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### sequence

`number`

### balances

`Record`\<`string`, `bigint`\>

### pendingHTLCs

[`HTLCRecord`](../interfaces/HTLCRecord.md)[]

### opts?

#### programStateVariables?

[`StateValue`](../interfaces/StateValue.md)[]

#### settlement?

`boolean`

## Returns

`Uint8Array`

[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / createReceipt

# Function: createReceipt()

> **createReceipt**(`params`): [`ActionReceipt`](../interfaces/ActionReceipt.md)

## Parameters

### params

#### actionId

`string`

#### commitmentHash

`string`

#### error?

\{ `code`: `string`; `details?`: `Record`\<`string`, `unknown`\>; `message`: `string`; \}

#### error.code

`string`

#### error.details?

`Record`\<`string`, `unknown`\>

#### error.message

`string`

#### issuedAt?

`number`

#### kind

`string`

#### parameters

`Record`\<`string`, `unknown`\>

#### proposalId

`string`

#### result?

`unknown`

#### status

[`ActionStatus`](../type-aliases/ActionStatus.md)

## Returns

[`ActionReceipt`](../interfaces/ActionReceipt.md)

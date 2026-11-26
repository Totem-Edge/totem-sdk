[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / computeSettlementId

# Function: computeSettlementId()

> **computeSettlementId**(`instruction`): `string`

Canonical digest of everything except the settlement id itself.

## Parameters

### instruction

[`SettlementInstructionV1`](../interfaces/SettlementInstructionV1.md) \| `Omit`\<[`SettlementInstructionV1`](../interfaces/SettlementInstructionV1.md), `"settlementId"`\>

## Returns

`string`

[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / buildDisputePayload

# Function: buildDisputePayload()

> **buildDisputePayload**(`factory`, `evidence`): [`FactoryDisputePayload`](../interfaces/FactoryDisputePayload.md)

Build a unilateral factory close (dispute) payload.

Includes the full `stateLog` (with monotonically increasing `sequence` entries)
for on-chain or arbitration verification.  Virtual channels still open at
dispute time are included by ID so the dispute resolver can adjudicate their
balances independently.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

### evidence

`string`

## Returns

[`FactoryDisputePayload`](../interfaces/FactoryDisputePayload.md)

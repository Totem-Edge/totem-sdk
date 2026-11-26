[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / resolveSettlementAddresses

# Function: resolveSettlementAddresses()

> **resolveSettlementAddresses**(`parties`, `supplied?`): `Record`\<`string`, `string`\>

Resolve the per-party settlement address map.

A supplied map (e.g. from a peer's settlement request) may only *confirm* the
channel's agreed addresses. Any value that disagrees is rejected: a negotiated
message must never be able to redirect a settlement output.

## Parameters

### parties

[`ChannelParticipant`](../interfaces/ChannelParticipant.md)[]

### supplied?

`Record`\<`string`, `string`\>

## Returns

`Record`\<`string`, `string`\>

[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / buildSettlementSigningRequest

# Function: buildSettlementSigningRequest()

> **buildSettlementSigningRequest**(`channel`, `opts?`): [`SettlementSigningRequest`](../interfaces/SettlementSigningRequest.md)

Build the deterministic settlement draft + digest for a cooperative close.
Both parties can build this independently from the same channel state, or the
settling party can send it verbatim to the counterparty to co-sign.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### opts?

`Pick`\<`ProposeSettlementOptions`, `"partyAddresses"`\>

## Returns

[`SettlementSigningRequest`](../interfaces/SettlementSigningRequest.md)

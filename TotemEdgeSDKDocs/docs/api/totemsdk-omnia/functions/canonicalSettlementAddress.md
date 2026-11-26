[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / canonicalSettlementAddress

# Function: canonicalSettlementAddress()

> **canonicalSettlementAddress**(`party`): `string`

Canonical settlement output address for a channel party.

`settlementAddress` is the agreed address recorded in the channel's
participant set (part of the channel the counterparty verified at open).
When it is absent, the address is derived from the party's channel key, so it
is always bound to that key and can never be chosen by a peer message.

The raw `publicKeyDigest` is a `SIGNEDBY` identity, not a spendable address;
paying it directly burns the funds.

## Parameters

### party

`Pick`\<[`ChannelParticipant`](../interfaces/ChannelParticipant.md), `"publicKeyDigest"` \| `"settlementAddress"`\>

## Returns

`string`

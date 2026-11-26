[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / computeForwardMessageId

# Function: computeForwardMessageId()

> **computeForwardMessageId**(`link`): `string`

OMN-086: deterministic message id for a forward. Depends only on the link
identity, so a retransmission after a restart produces the same id.

## Parameters

### link

#### hashlock

`string`

#### messageNonce

`number`

#### outChannelId

`string`

#### outHtlcId

`string`

## Returns

`string`

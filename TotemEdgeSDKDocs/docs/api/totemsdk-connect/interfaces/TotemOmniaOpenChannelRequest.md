[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / TotemOmniaOpenChannelRequest

# Interface: TotemOmniaOpenChannelRequest

## Properties

### method

> **method**: `"totem_omniaOpenChannel"`

***

### params

> **params**: `object`

#### fundingCoinId

> **fundingCoinId**: `string`

Coin the consumer funds. The wallet MUST verify ownership and build/sign
the funding witness; `fundingWitnessHex` is never accepted from a dApp.

#### localAmount

> **localAmount**: `string`

#### origin

> **origin**: `string`

#### remoteAddressIndex?

> `optional` **remoteAddressIndex?**: `number`

#### remoteAmount

> **remoteAmount**: `string`

#### remotePartyId

> **remotePartyId**: `string`

#### remotePublicKeyDigest

> **remotePublicKeyDigest**: `string`

Counterparty channel key digest (32-byte hex). Required for the 2-of-2 script.

#### remoteSettlementAddress?

> `optional` **remoteSettlementAddress?**: `string`

#### remoteTransportPubkey?

> `optional` **remoteTransportPubkey?**: `string`

#### tokenId?

> `optional` **tokenId?**: `string`

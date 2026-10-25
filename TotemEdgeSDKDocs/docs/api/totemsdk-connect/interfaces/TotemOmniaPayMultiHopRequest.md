[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / TotemOmniaPayMultiHopRequest

# Interface: TotemOmniaPayMultiHopRequest

## Properties

### method

> **method**: `"totem_omniaPayMultiHop"`

***

### params

> **params**: `object`

#### amount

> **amount**: `string`

#### expiryBlock

> **expiryBlock**: `string`

#### hashlock

> **hashlock**: `string`

#### maxHops?

> `optional` **maxHops?**: `number`

#### origin

> **origin**: `string`

#### preimage?

> `optional` **preimage?**: `string`

#### route?

> `optional` **route?**: [`Route`](Route.md)

Optional caller-selected route. Omit to let the wallet/host route.

#### targetTokenId?

> `optional` **targetTokenId?**: `string`

Required when routing from tokenId to a different settlement token.

#### tokenId

> **tokenId**: `string`

#### toPartyId

> **toPartyId**: `string`

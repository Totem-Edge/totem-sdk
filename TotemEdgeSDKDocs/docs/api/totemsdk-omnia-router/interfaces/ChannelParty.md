[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / ChannelParty

# Interface: ChannelParty

@totemsdk/omnia-router — public types

All monetary values are scaled bigints (SCALE = 10^8).
The router uses local mirrors of OmniaChannel/HTLCRecord so the package
has no hard runtime dependency on @totemsdk/omnia — callers pass the
real objects (structural typing ensures compatibility).

## Properties

### addressIndex

> **addressIndex**: `number`

***

### partyId

> **partyId**: `string`

***

### publicKeyDigest

> **publicKeyDigest**: `string`

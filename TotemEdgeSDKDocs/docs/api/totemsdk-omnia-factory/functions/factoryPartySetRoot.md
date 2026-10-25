[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / factoryPartySetRoot

# Function: factoryPartySetRoot()

> **factoryPartySetRoot**(`participants`): `string`

MMR root (hex, no `0x`) over the participants' public-key digests.

 Minima's `MMRTree` builds a perfect binary tree (power-of-two leaves), so the
 party set is padded to the next power of two with the **zero digest** sentinel
 (a fixed, publicly known padding leaf). The root is thus a Minima-native MMR
 root — the same structure the VTXO batch root commits and the on-chain `PROOF`
 verifies — over an arbitrary number of participants.

## Parameters

### participants

[`FactoryParticipant`](../interfaces/FactoryParticipant.md)[]

## Returns

`string`

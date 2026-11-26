[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / gnssFixToLocationClaim

# Function: gnssFixToLocationClaim()

> **gnssFixToLocationClaim**(`fix`, `options`): `LocationClaim`

Convert one receiver fix into a deterministic location claim.

Byte-level evidence is preserved as hashes (never the raw payload) so a
verifier can bind the claim back to the receiver output. The claim is
unsigned until `signLocationProof` is called.

## Parameters

### fix

`GnssFix`

### options

[`GnssLocationClaimOptions`](../interfaces/GnssLocationClaimOptions.md)

## Returns

`LocationClaim`

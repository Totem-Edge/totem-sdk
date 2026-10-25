[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / wotsAddressData

# Function: wotsAddressData()

> **wotsAddressData**(`publicKeyDigest`): `string`

Address data (hex) of a WOTS public-key digest's single-key script
(`RETURN SIGNEDBY(0x<pk>)`). This is the value a `VERIFYOUT` compares against
(the node compares the output coin's *address data*), distinct from the WOTS
public key used by `SIGNEDBY`.

## Parameters

### publicKeyDigest

`string`

## Returns

`string`

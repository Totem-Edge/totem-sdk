[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / indexToMiniDataBytes

# Function: indexToMiniDataBytes()

> **indexToMiniDataBytes**(`index`): `Uint8Array`

Convert index to MiniData bytes matching Java's:
  new MiniData(new BigInteger(Integer.toString(index)))

BigInteger uses minimum byte representation (no leading zeros).
This is used for per-address key derivation in Wallet.java.

## Parameters

### index

`number`

Non-negative integer (0, 1, 2, ...)

## Returns

`Uint8Array`

Minimal byte representation of the index

[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / deriveDeterministicAddress

# Function: deriveDeterministicAddress()

> **deriveDeterministicAddress**(`baseSeed`, `addressIndex`): [`DerivedAddress`](../interfaces/DerivedAddress.md)

Minima Wallet.java parity: `baseSeed + index → privseed → TreeKey(64,3) → address`.

## Parameters

### baseSeed

`Uint8Array`

### addressIndex

`number`

## Returns

[`DerivedAddress`](../interfaces/DerivedAddress.md)

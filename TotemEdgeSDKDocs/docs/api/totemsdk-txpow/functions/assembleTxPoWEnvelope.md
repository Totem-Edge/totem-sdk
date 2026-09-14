[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / assembleTxPoWEnvelope

# Function: assembleTxPoWEnvelope()

> **assembleTxPoWEnvelope**(`headerBytes`, `bodyBytes`): `Uint8Array`

Assemble the complete Minima TxPoW wire format:
  TxHeader | 0x01 (hasBody) | TxBody

This is the representation required for network submission of a genuine L1
block candidate. A mined header alone is NOT sufficient.

## Parameters

### headerBytes

`Uint8Array`

Serialized TxHeader bytes (with the winning nonce).

### bodyBytes

`Uint8Array`

Serialized TxBody bytes.

## Returns

`Uint8Array`

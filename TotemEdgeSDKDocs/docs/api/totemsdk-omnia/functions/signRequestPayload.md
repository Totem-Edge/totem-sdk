[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / signRequestPayload

# Function: signRequestPayload()

> **signRequestPayload**(`request`): `Uint8Array`

Payload a signer signs.

- `intent` (default): domain-separated digest binding the custody disclosure
  hash, so a signature under disclosure A is invalid under disclosure B.
- `chain`: the raw digest; the chain/peer verifies exactly these bytes. The
  disclosure is bound by the accompanying intent/approval signature.

## Parameters

### request

[`SignRequest`](../interfaces/SignRequest.md)

## Returns

`Uint8Array`

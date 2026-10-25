[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / buildMinimaWitnessBytes

# Function: buildMinimaWitnessBytes()

> **buildMinimaWitnessBytes**(`signatures`): `Uint8Array`

Canonical Minima witness serializer for TreeKey signers (RFC-009).

Emits the signatures section as a list of Minima `Signature` objects — each
serialized via `serializeTreeSignature`, byte-identical to Java
`Signature.writeDataStream()` — followed by the empty coin-proof and script
sections:

  `[MiniNumber(count)][Signature…][MiniNumber(0)][MiniNumber(0)]`

This is the witness shape a Minima node expects for a cooperative
`MULTISIG`/`SIGNEDBY` spend when the signers are TreeKey roots. It is the
single source of truth shared by `@totemsdk/statechain`.

## Parameters

### signatures

`TreeSignature`[]

## Returns

`Uint8Array`

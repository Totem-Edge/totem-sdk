[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / MachineWorkAdmissionProof

# Interface: MachineWorkAdmissionProof

The mined Machine Work Admission proof.

Reuses the existing TxPoW types where possible:
  - `txpow`          — serialized TxHeader bytes (SHA3-256 of these is `txpowId`)
  - `txpowEnvelope`  — the COMPLETE Minima TxPoW wire format
                       (header | 0x01 hasBody | body), required for network
                       submission of a genuine Minima block
  - `txpowId`        — SHA3-256(header)

`qualifiesAsMinimaBlock`, `isBlock`, and `superLevel` are DERIVED METADATA
recorded at mining time. They are never trusted by verification —
verification recomputes all of them from the re-derived txpowId and the
template's block difficulty.

## Properties

### actionCommitment

> **actionCommitment**: `string`

Hex commitment placed in the TxPoW header's customHash field.

***

### admissionTarget

> **admissionTarget**: `string`

The admission target (32-byte hex) the proof satisfies.

***

### challengeId

> **challengeId**: `string`

The challenge this proof was mined against.

***

### isBlock

> **isBlock**: `boolean`

DERIVED METADATA: superLevel >= 0. Never trusted by verification.

***

### minedAt

> **minedAt**: `number`

Epoch milliseconds when the proof was mined.

***

### nonce

> **nonce**: `string`

The winning nonce.

***

### qualifiesAsMinimaBlock

> **qualifiesAsMinimaBlock**: `boolean`

DERIVED METADATA: true when the mined hash also beats the block difficulty
encoded by the candidate template (i.e. a genuine Minima block). Never
trusted by verification — it is recomputed from the re-derived txpowId.

***

### qualifiesForAdmission

> **qualifiesForAdmission**: `true`

Always true for a valid admission proof.

***

### superLevel

> **superLevel**: `number`

DERIVED METADATA: Minima Super level (-1 = not a block, 0..31 = block
strength). Never trusted by verification.

***

### template

> **template**: [`MinimaWorkTemplate`](MinimaWorkTemplate.md)

Template the proof was mined against (for staleness policy).

***

### txpow

> **txpow**: `string`

Serialized TxHeader bytes (SHA3-256 of these is the TxPoW ID).

***

### txpowEnvelope

> **txpowEnvelope**: `string`

Complete Minima TxPoW envelope (header | 0x01 | body) for block relay.

***

### txpowId

> **txpowId**: `string`

SHA3-256(header) — the canonical TxPoW ID.

***

### version

> **version**: `number`

Protocol version.

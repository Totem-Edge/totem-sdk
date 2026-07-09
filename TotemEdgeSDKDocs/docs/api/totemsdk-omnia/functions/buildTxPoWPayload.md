[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / buildTxPoWPayload

# Function: buildTxPoWPayload()

> **buildTxPoWPayload**(`txBytes`, `witnessBytes`): `Uint8Array`

Wrap pre-serialized Minima TX + witness bytes in a `@totemsdk/txpow` body
ready for PoW mining and chain broadcast.

Architecture:
```
OmniaTxDraft
  → toEnhancedBuildParams()          (@totemsdk/tx-builder types)
  → @totemsdk/core serializeTransaction()  (Minima binary TX bytes)
  → buildTxPoWPayload(txBytes, witnessBytes) → serializeTxBody()
  → mineTxPoW() / broadcastTxPoW()
```

## Parameters

### txBytes

`Uint8Array`

Pre-serialized Minima Transaction bytes from `@totemsdk/core`.

### witnessBytes

`Uint8Array`

Pre-serialized Minima Witness bytes (WOTS signatures).

## Returns

`Uint8Array`

TxPoW body bytes ready for PoW mining.

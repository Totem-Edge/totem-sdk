[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / TxBodyOptions

# Interface: TxBodyOptions

@totemsdk/txpow

TxPoW envelope serialization and proof-of-work mining for the Minima protocol.

USAGE — MEG-side mining (byte-identical to extension current behaviour):
  const txpow = serializeTxPoW(txBytes, witnessBytes);
  // Submit to Axia: node re-mines with correct difficulty

USAGE — Local mining:
  const target  = await fetchTxPowTarget(axiaBaseUrl);
  const txBody  = serializeTxBody(txBytes, witnessBytes, { txnDifficulty: target });
  const result  = await mineTxPoW(txBody, target);
  const txpow   = concat(result.minedHeaderBytes, new Uint8Array([0x01]), txBody);

USAGE — Verify (relay nodes):
  const check = verifyProofOfWork(txpowId, mTxnDifficulty);
  if (!check.valid) drop(check.reason);

## Properties

### prng?

> `optional` **prng?**: `Uint8Array`\<`ArrayBufferLike`\>

Override the 32-byte PRNG field. Useful for deterministic tests only.

***

### txnDifficulty?

> `optional` **txnDifficulty?**: `Uint8Array`\<`ArrayBufferLike`\>

Transaction difficulty target (32-byte MiniData).
• MEG-side-mined path:  leave undefined → MAX_HASH (all 0xFF)
• Locally mined path:   MUST be ≤ TX_POW_MIN_DIFFICULTY, typically fetched
  via fetchTxPowTarget() from the same package.
Setting MAX_HASH for locally mined TxPoWs will cause block-level rejection.

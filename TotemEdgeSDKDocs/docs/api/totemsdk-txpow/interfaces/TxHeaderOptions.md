[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / TxHeaderOptions

# Interface: TxHeaderOptions

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

### nonce?

> `optional` **nonce?**: `bigint`

Proof-of-work nonce. Defaults to 0n. The mining loop iterates this.

***

### timeMilli?

> `optional` **timeMilli?**: `bigint`

Block timestamp in milliseconds. Defaults to Date.now() at call time.

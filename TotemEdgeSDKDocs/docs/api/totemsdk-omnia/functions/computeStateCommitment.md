[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / computeStateCommitment

# Function: computeStateCommitment()

> **computeStateCommitment**(`sequence`, `balances`, `pendingHTLCs`): `Uint8Array`

Canonical state commitment — the 32-byte digest that is WOTS-signed and
WOTS-verified for every channel update.

Covers the FULL off-chain state: sequence number, per-party balance split,
and all pending HTLCs. This ensures signatures are cryptographically bound
to balances and HTLC content and cannot be repurposed for a tampered state.

NOTE: `buildUpdateTx` intentionally encodes only the UTXO total on-chain
(eltoo design). The per-party split is off-chain. Without this commitment,
a signer could sign a state and an adversary could swap the balances while
keeping the WOTS signature valid — breaking the dispute trust model.

Sorted lexicographically by key to ensure determinism regardless of the
order in which balance/HTLC entries appear in the caller's object.

## Parameters

### sequence

`number`

### balances

`Record`\<`string`, `bigint`\>

### pendingHTLCs

[`HTLCRecord`](../interfaces/HTLCRecord.md)[]

## Returns

`Uint8Array`

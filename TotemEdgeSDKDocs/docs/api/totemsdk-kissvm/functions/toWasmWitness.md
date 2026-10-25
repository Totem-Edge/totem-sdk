[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / toWasmWitness

# Function: toWasmWitness()

> **toWasmWitness**(`witness`): `unknown`

Convert a TS `ScriptWitness` (Map keyed by signer root key) into the Rust VM
witness object. Flat WOTS entries go in `signatures`; canonical tree
signatures (RFC-009) go in `treeSignatures`, keyed by root public key — the
identity `SIGNEDBY`/`MULTISIG` match against (RFC-048).

## Parameters

### witness

[`ScriptWitness`](../interfaces/ScriptWitness.md)

## Returns

`unknown`

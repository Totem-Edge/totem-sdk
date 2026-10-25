[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildWitness

# Function: buildWitness()

> **buildWitness**(`inputs`): [`ScriptWitness`](../interfaces/ScriptWitness.md)

buildWitness — constructs a ScriptWitness from signed entries.

Flat entries are keyed by their declared WOTS public-key digest; tree
signatures are keyed by their **computed root public key** (never a
caller-supplied value), so `SIGNEDBY(<root>)` can only be satisfied by a
signature that actually reconstructs to that root.

For convenience, a `{ signatures }` map (key → signature bytes/hex or
`TreeSignature`) is also accepted.

## Parameters

### inputs

[`WitnessInput`](../type-aliases/WitnessInput.md)[] \| \{ `signatures`: `Record`\<`string`, `Uint8Array` \| `string` \| `TreeSignature`\>; \}

## Returns

[`ScriptWitness`](../interfaces/ScriptWitness.md)

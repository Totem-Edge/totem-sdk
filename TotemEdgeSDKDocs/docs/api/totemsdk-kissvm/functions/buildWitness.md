[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildWitness

# Function: buildWitness()

> **buildWitness**(`inputs`): [`ScriptWitness`](../interfaces/ScriptWitness.md)

buildWitness — constructs a ScriptWitness from a list of signed inputs.

Each entry provides the public-key digest and the corresponding WOTS
signature over the transaction digest. The evaluator uses this witness
when verifying SIGNEDBY / MULTISIG opcodes.

For convenience, a `{ signatures }` map (pubkey hex → signature bytes or
hex string) is also accepted — used by the canonical example suite.

## Parameters

### inputs

[`WitnessInput`](../interfaces/WitnessInput.md)[] \| \{ `signatures`: `Record`\<`string`, `Uint8Array` \| `string`\>; \}

## Returns

[`ScriptWitness`](../interfaces/ScriptWitness.md)

[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildWitness

# Function: buildWitness()

> **buildWitness**(`inputs`): [`ScriptWitness`](../interfaces/ScriptWitness.md)

buildWitness — constructs a ScriptWitness from a list of signed inputs.

Each entry provides the public-key digest and the corresponding WOTS
signature over the transaction digest. The evaluator uses this witness
when verifying SIGNEDBY / MULTISIG opcodes.

## Parameters

### inputs

[`WitnessInput`](../interfaces/WitnessInput.md)[]

## Returns

[`ScriptWitness`](../interfaces/ScriptWitness.md)

[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / buildRecursiveWitnessPlan

# Function: buildRecursiveWitnessPlan()

> **buildRecursiveWitnessPlan**(`selectedPath`, `disclosedScripts`, `collectedSignatures`, `roleKeys?`): `object`

Build a recursive MAST witness plan from collected signatures and
disclosed scripts. The plan describes what the witness should contain;
use materializeRecursiveWitness() from @totemsdk/recursive-mast/kissvm
to produce the canonical KISSVM ScriptWitness.

## Parameters

### selectedPath

[`PolicyPathDescriptor`](../interfaces/PolicyPathDescriptor.md)

The policy path from anchor to action.

### disclosedScripts

[`ScriptDisclosure`](../interfaces/ScriptDisclosure.md)[]

The disclosed MAST branch scripts.

### collectedSignatures

`Record`\<`string`, `string`\> \| `Map`\<`string`, `string`\>

Signatures by role.

### roleKeys?

`Record`\<`string`, `string`\>

## Returns

`object`

A witness plan (mastBranches + signatures) ready for materialization.

### mastBranches

> **mastBranches**: `Map`\<`string`, `string`\>

### scriptProofs

> **scriptProofs**: `ScriptProof`[]

### signatures

> **signatures**: `Map`\<`string`, `string`\>

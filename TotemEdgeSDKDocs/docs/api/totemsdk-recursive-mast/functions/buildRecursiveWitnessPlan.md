[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / buildRecursiveWitnessPlan

# Function: buildRecursiveWitnessPlan()

> **buildRecursiveWitnessPlan**(`selectedPath`, `disclosedScripts`, `collectedSignatures`): `object`

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

`Map`\<`string`, `string`\>

Signatures by role.

## Returns

`object`

A witness plan (mastBranches + signatures) ready for materialization.

### mastBranches

> **mastBranches**: `Map`\<`string`, `string`\>

### signatures

> **signatures**: `Map`\<`string`, `string`\>

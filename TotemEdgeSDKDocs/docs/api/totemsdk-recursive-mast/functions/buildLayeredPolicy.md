[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / buildLayeredPolicy

# Function: buildLayeredPolicy()

> **buildLayeredPolicy**(`config`): `object`

Build a layered policy tree from a config.
Returns a PolicyTree where each layer is a node, plus a proof chain
that can be used for nested MAST execution.

## Parameters

### config

[`LayeredPolicyConfig`](../interfaces/LayeredPolicyConfig.md)

## Returns

`object`

### mastScript

> **mastScript**: `string`

### proofChain

> **proofChain**: [`ProofChain`](../interfaces/ProofChain.md)

### tree

> **tree**: [`PolicyTree`](../interfaces/PolicyTree.md)

## Example

```ts
const { tree, proofChain } = buildLayeredPolicy({
  assetId: 'robot-arm-001',
  assetName: 'Robot Arm',
  layers: [
    { id: 'manufacturer', name: 'Robot Corp', script: mfgScript, authorityPkd: mfgPk },
    { id: 'regulatory', name: 'EU Machinery Directive', script: regScript, authorityPkd: regPk },
    { id: 'owner', name: 'Factory GmbH', script: ownerScript, authorityPkd: ownerPk },
    { id: 'site', name: 'Plant A', script: siteScript, authorityPkd: sitePk },
    { id: 'operator', name: 'Technician', script: opScript, authorityPkd: opPk },
  ],
});
```

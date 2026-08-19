[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / buildPolicyTree

# Function: buildPolicyTree()

> **buildPolicyTree**(`nodes`): [`PolicyTree`](../interfaces/PolicyTree.md)

Build a policy tree from a flat list of nodes.
Nodes reference parents by `parentId`. The root is the node with no parent.

## Parameters

### nodes

[`PolicyNodeInput`](../interfaces/PolicyNodeInput.md)[]

## Returns

[`PolicyTree`](../interfaces/PolicyTree.md)

## Example

```ts
const tree = buildPolicyTree([
  { id: 'root', name: 'National', script: 'RETURN TRUE' },
  { id: 'regional', name: 'Regional', script: 'ASSERT SIGNEDBY(STATE(0)) RETURN TRUE', parentId: 'root' },
  { id: 'local', name: 'Local', script: 'ASSERT SIGNEDBY(PREVSTATE(0)) RETURN TRUE', parentId: 'regional' },
]);
```

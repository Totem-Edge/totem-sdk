[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / deriveChildTreeSeedJava

# Function: deriveChildTreeSeedJava()

> **deriveChildTreeSeedJava**(`childSeed`, `childIndex`): `Uint8Array`

Derive child tree seed matching Java TreeKeyNode.java exactly

From TreeKeyNode.java getChild (line 68):
  MiniData seed = Crypto.getInstance().hashAllObjects(new MiniNumber(zChild), mChildSeed);

The child seed is derived from parent's private seed:
  mChildSeed = Crypto.getInstance().hashObject(zPrivateSeed); // line 30

## Parameters

### childSeed

`Uint8Array`

32-byte child seed (hash of parent's private seed)

### childIndex

`number`

Child index (0-63)

## Returns

`Uint8Array`

32-byte derived seed for child tree

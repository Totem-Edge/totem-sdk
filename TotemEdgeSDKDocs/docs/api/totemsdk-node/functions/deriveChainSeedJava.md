[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / deriveChainSeedJava

# Function: deriveChainSeedJava()

> **deriveChainSeedJava**(`privateSeed`, `index`): `Uint8Array`

Derive per-chain seed matching Java TreeKeyNode.java exactly

From TreeKeyNode.java constructor (line 43-44):
  MiniData seed = Crypto.getInstance().hashAllObjects(new MiniNumber(i), zPrivateSeed);

## Parameters

### privateSeed

`Uint8Array`

32-byte private seed

### index

`number`

Chain index (0-63)

## Returns

`Uint8Array`

32-byte derived seed for this chain

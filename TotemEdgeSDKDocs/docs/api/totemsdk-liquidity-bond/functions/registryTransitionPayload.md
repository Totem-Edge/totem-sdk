[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / registryTransitionPayload

# Function: registryTransitionPayload()

> **registryTransitionPayload**(`root`, `previousRoot`, `sequence`, `opHash`, `opts?`): `Uint8Array`

The exact bytes signed/verified for a transition (AUD-013): binds the
resulting root to its anchor position (`previousRoot`), its anti-reorg
`sequence`, and the mutation (`opHash`) so a signed root cannot be replayed
at a forged chain position and `op.poolId` is signature-bound.

## Parameters

### root

`string`

### previousRoot

`string` \| `undefined`

### sequence

`number` \| `undefined`

### opHash

`string`

### opts?

[`RegistryRootOptions`](../interfaces/RegistryRootOptions.md)

## Returns

`Uint8Array`

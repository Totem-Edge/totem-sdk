[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / commitPoolMembers

# Function: commitPoolMembers()

> **commitPoolMembers**(`pool`, `vtxos`, `options?`): [`CommitPoolMembersResult`](../interfaces/CommitPoolMembersResult.md)

Append VTXOs to the pool's membership set and rebuild the commitment tree
(OMN-002).

The pool's `commitmentRoot` commits to the whole set (`members`), not to a
single leaf: appending a member never removes an earlier member, and the
previous root is retained in `epochRoots` so proofs issued in earlier epochs
stay verifiable. Every batch advances `epoch`; `batchId` tracks the root.

Idempotent for a member already present with the same leaf; a conflicting
leaf for an existing `vtxoId` is rejected.

## Parameters

### pool

[`OmniaVtxoPool`](../interfaces/OmniaVtxoPool.md)

### vtxos

readonly [`OmniaVtxo`](../interfaces/OmniaVtxo.md)[]

### options?

[`CommitPoolMembersOptions`](../interfaces/CommitPoolMembersOptions.md) = `{}`

## Returns

[`CommitPoolMembersResult`](../interfaces/CommitPoolMembersResult.md)

[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / reclaimAbandoned

# Function: reclaimAbandoned()

> **reclaimAbandoned**(`chain`, `proof`, `leaseProvider?`): `Promise`\<[`ClaimPayload`](../interfaces/ClaimPayload.md)\>

Reclaim after SE abandonment (SE offline / unresponsive).

Public API: `reclaimAbandoned(chain, proof, leaseProvider) -> ClaimPayload`

Broadcasts `chain.reclaimTx` — the pre-signed unilateral reclaim TX built
during `createStateChain` (and updated on every `transferOwnership`).

This TX is signed by the CURRENT owner (not the initial owner) and spends
via `SIGNEDBY(STATE(0))` after `@COINAGE >= RECLAIM_TIMELOCK`. No SE
cooperation needed.

If `proof.timelockBlock` is provided and `leaseProvider.getTip` is present,
the current block height is validated before broadcasting.

## Parameters

### chain

[`StateChain`](../interfaces/StateChain.md)

Any non-claimed statechain.

### proof

[`AbandonedProof`](../interfaces/AbandonedProof.md)

Optional: timelockBlock + evidence.

### leaseProvider?

[`StatechainLeaseProvider`](../interfaces/StatechainLeaseProvider.md)

Bundle: optional broadcast + optional getTip.

## Returns

`Promise`\<[`ClaimPayload`](../interfaces/ClaimPayload.md)\>

ClaimPayload with pre-built reclaimTx and reclaimAddress.

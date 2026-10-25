[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / transferOwnership

# Function: transferOwnership()

> **transferOwnership**(`chain`, `newOwner`, `seClient`, `_chainProvider?`): `Promise`\<[`StateChain`](../interfaces/StateChain.md)\>

Transfer ownership of a statechain UTXO to a new owner.

Public API: `transferOwnership(chain, newOwner, seClient)`

Creates an on-chain state-update TX:
  input:  current MULTISIG coin with STATE(0) = oldOwnerRoot
  output: same locking address with STATE(0) = newOwnerRoot

Signing flow (RFC-009, Minima-faithful):
 - `chain.currentOwner.signTree(txDigest)` — old owner root-bound TreeKey sig.
 - `seClient.blindSign(hex(txDigest))` — SE leased-leaf co-signature envelope.
 Both satisfy `MULTISIG(2 STATE(0) SE)` for the input coin; the witness is a
 list of Minima `TreeSignature` objects.

Post-transfer:
 - New owner's reclaim TX is built via `newOwner.signTree(reclaimDigest)`.
   `chain.reclaimTx` always reflects CURRENT owner — never initial owner.

## Parameters

### chain

[`StateChain`](../interfaces/StateChain.md)

Active statechain (must have `currentOwner.signTree`).

### newOwner

[`StatechainOwner`](../interfaces/StatechainOwner.md)

Recipient identity + TreeKey signing capability.

### seClient

[`SEClient`](../interfaces/SEClient.md)

SE client for countersigning the state-update TX.

### \_chainProvider?

`ChainStateProvider`

Optional: broadcast the state-update TX on-chain.

## Returns

`Promise`\<[`StateChain`](../interfaces/StateChain.md)\>

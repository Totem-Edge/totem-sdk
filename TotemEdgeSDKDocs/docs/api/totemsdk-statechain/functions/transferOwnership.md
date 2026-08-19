[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / transferOwnership

# Function: transferOwnership()

> **transferOwnership**(`chain`, `newOwner`, `seClient`, `_verifyBlindSig?`, `_chainProvider?`): `Promise`\<[`StateChain`](../interfaces/StateChain.md)\>

Transfer ownership of a statechain UTXO to a new owner.

Public API: `transferOwnership(chain, newOwner, seClient)`

Creates an on-chain state-update TX:
  input:  current MULTISIG coin with STATE(0) = oldOwnerPkd
  output: same locking address with STATE(0) = newOwnerPkd

Signing flow:
 - `chain.currentOwner.sign(txDigest)` — old owner signs TX body digest.
 - `seClient.blindSign(hex(txDigest))` — SE countersigns same digest.
 Both satisfy `MULTISIG(2 STATE(0) SE)` for the input coin.

Post-transfer:
 - New owner's reclaim TX is built via `newOwner.sign(reclaimDigest)`.
   `chain.reclaimTx` always reflects CURRENT owner — never initial owner.
 - Old owner's `transferKeySeed` is moved to `TransferRecord.transferKey`
   then **zeroed in-place** on the original owner object so the secret does
   not persist in hot state after the ownership hop.

## Parameters

### chain

[`StateChain`](../interfaces/StateChain.md)

Active statechain (must have `currentOwner.sign`).

### newOwner

[`StatechainOwner`](../interfaces/StatechainOwner.md)

Recipient identity + signing capability.

### seClient

[`SEClient`](../interfaces/SEClient.md)

SE client for countersigning the state-update TX.

### \_verifyBlindSig?

(`sig`, `commitment`, `sePkdHex`) => `boolean`

Optional SE blind-sig verification override (test use).
  Defaults to `wotsVerifyDigest`. Production callers should omit this.

### \_chainProvider?

`ChainStateProvider`

Optional: broadcast the state-update TX on-chain.

## Returns

`Promise`\<[`StateChain`](../interfaces/StateChain.md)\>

[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / buildStatechainScript

# Function: buildStatechainScript()

> **buildStatechainScript**(`sePkd`): `string`

MULTISIG(2) locking script for the state chain UTXO.

The owner key is read from STATE(0) of the coin being spent.
This allows any current owner to authorize a spend without changing the
locking script or address — only the coin's stored state changes on each
ownership transfer.

Normal path  (any time):   requires MULTISIG(2 STATE(0) SE) signatures.
Reclaim path (after COINAGE >= RECLAIM_TIMELOCK): owner can reclaim
  unilaterally with just SIGNEDBY(STATE(0)) — no SE signature required.

## Parameters

### sePkd

`string`

SE's WOTS public key digest (hardcoded in script, fixed per SE).

## Returns

`string`

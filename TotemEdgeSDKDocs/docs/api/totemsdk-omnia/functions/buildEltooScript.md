[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / buildEltooScript

# Function: buildEltooScript()

> **buildEltooScript**(`parties`, `contestDelayBlocks?`): `string`

Eltoo channel script (RFC-039, CUSTODY-POLICY §2).

Two spend paths, **both requiring `MULTISIG(2 A B)`**:
  - **Update** (`SETTLEMENT` false): `BOTHSIGNED` + `SEQUENCE GT
    PREVSEQUENCE` — advance the off-chain state.
  - **Settlement** (`SETTLEMENT` true): `BOTHSIGNED` + `SEQUENCE EQ
    PREVSEQUENCE` after `@COINAGE GTE ELTOO_CONTEST_DELAY_BLOCKS` — close on the
    pre-signed state.

Unilateral close is achieved by **broadcasting the co-signed close package**:
each state carries an update + settlement transaction pre-signed by *both*
parties (`settlement.ts` `startUnilateralClose`/`finalizeUnilateralClose`), and
because the witness already contains both signatures, *either party can relay
it alone* — no counterparty liveness. `BOTHSIGNED` here is therefore the output
constraint: only a transaction both parties signed (the agreed split) can be
spent. A single-signer settlement branch would let one party pay itself
everything, so it must never be added without an explicit output constraint.

The settlement `@COINAGE GTE ELTOO_CONTEST_DELAY_BLOCKS` is a *relative* contest
delay and is deliberately not converted to an absolute `@BLOCK`: each update
resets it by design. It cannot be weaponised to push the victim's clock because
both update and settlement require `BOTHSIGNED` — no one can move the coin to
reset coinage without the victim's signature.

## Parameters

### parties

[`ChannelParticipant`](../interfaces/ChannelParticipant.md)[]

### contestDelayBlocks?

`number` = `ELTOO_CONTEST_DELAY_BLOCKS`

## Returns

`string`

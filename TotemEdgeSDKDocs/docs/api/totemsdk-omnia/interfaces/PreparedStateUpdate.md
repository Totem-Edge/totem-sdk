[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / PreparedStateUpdate

# Interface: PreparedStateUpdate

Signs a channel update state and returns the full partial `SignedChannelState`.

Signs the canonical Minima update transaction digest. The full off-chain state
is bound through StateCommitmentV2 embedded in STATE(102), making the digest
both L1-visible and KISSVM-visible.

Executes the full reserve → sign → commit WOTS lease cycle and returns a
`Partial<SignedChannelState>` with `signatures` and `signingIndices` keyed by the
signer's `partyId`, ready to be forwarded to the counterparty for co-signing.

## Param

**channel**

The channel context (used for treeId, localSigner fallback, pendingHTLCs).

## Param

**update**

New sequence number and balance split for this state.

## Param

**leaseProvider**

WOTS lease provider.

## Param

**signer**

Optional explicit signer; falls back to channel.localSigner.

## Extends

- [`UnsignedStateUpdate`](UnsignedStateUpdate.md)

## Properties

### channel

> **channel**: [`OmniaChannel`](OmniaChannel.md)

#### Inherited from

[`UnsignedStateUpdate`](UnsignedStateUpdate.md).[`channel`](UnsignedStateUpdate.md#channel)

***

### newBalances

> **newBalances**: `Record`\<`string`, `bigint`\>

#### Inherited from

[`UnsignedStateUpdate`](UnsignedStateUpdate.md).[`newBalances`](UnsignedStateUpdate.md#newbalances)

***

### newSequence

> **newSequence**: `number`

#### Inherited from

[`UnsignedStateUpdate`](UnsignedStateUpdate.md).[`newSequence`](UnsignedStateUpdate.md#newsequence)

***

### payloadHash

> **payloadHash**: `string`

#### Inherited from

[`UnsignedStateUpdate`](UnsignedStateUpdate.md).[`payloadHash`](UnsignedStateUpdate.md#payloadhash)

***

### pendingHTLCs

> **pendingHTLCs**: [`HTLCRecord`](HTLCRecord.md)[]

#### Inherited from

[`UnsignedStateUpdate`](UnsignedStateUpdate.md).[`pendingHTLCs`](UnsignedStateUpdate.md#pendinghtlcs)

***

### programTransition

> **programTransition**: [`ProgramTransition`](ProgramTransition.md) \| `undefined`

#### Inherited from

[`UnsignedStateUpdate`](UnsignedStateUpdate.md).[`programTransition`](UnsignedStateUpdate.md#programtransition)

***

### settlementDigest

> **settlementDigest**: `Uint8Array`

#### Inherited from

[`UnsignedStateUpdate`](UnsignedStateUpdate.md).[`settlementDigest`](UnsignedStateUpdate.md#settlementdigest)

***

### settlementReservation

> **settlementReservation**: `object`

#### indices

> **indices**: `SigningIndices`

#### reservationId

> **reservationId**: `string`

***

### signerPartyId

> **signerPartyId**: `string`

#### Inherited from

[`UnsignedStateUpdate`](UnsignedStateUpdate.md).[`signerPartyId`](UnsignedStateUpdate.md#signerpartyid)

***

### stateVariables

> **stateVariables**: [`StateValue`](StateValue.md)[]

#### Inherited from

[`UnsignedStateUpdate`](UnsignedStateUpdate.md).[`stateVariables`](UnsignedStateUpdate.md#statevariables)

***

### transactionHex

> **transactionHex**: `string`

#### Inherited from

[`UnsignedStateUpdate`](UnsignedStateUpdate.md).[`transactionHex`](UnsignedStateUpdate.md#transactionhex)

***

### unsignedClosePackage

> **unsignedClosePackage**: [`SignedClosePackage`](SignedClosePackage.md)

#### Inherited from

[`UnsignedStateUpdate`](UnsignedStateUpdate.md).[`unsignedClosePackage`](UnsignedStateUpdate.md#unsignedclosepackage)

***

### updateDigest

> **updateDigest**: `Uint8Array`

#### Inherited from

[`UnsignedStateUpdate`](UnsignedStateUpdate.md).[`updateDigest`](UnsignedStateUpdate.md#updatedigest)

***

### updateReservation

> **updateReservation**: `object`

#### indices

> **indices**: `SigningIndices`

#### reservationId

> **reservationId**: `string`

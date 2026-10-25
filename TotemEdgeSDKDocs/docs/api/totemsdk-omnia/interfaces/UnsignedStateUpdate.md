[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / UnsignedStateUpdate

# Interface: UnsignedStateUpdate

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

## Extended by

- [`PreparedStateUpdate`](PreparedStateUpdate.md)

## Properties

### channel

> **channel**: [`OmniaChannel`](OmniaChannel.md)

***

### newBalances

> **newBalances**: `Record`\<`string`, `bigint`\>

***

### newSequence

> **newSequence**: `number`

***

### payloadHash

> **payloadHash**: `string`

***

### pendingHTLCs

> **pendingHTLCs**: [`HTLCRecord`](HTLCRecord.md)[]

***

### programTransition

> **programTransition**: [`ProgramTransition`](ProgramTransition.md) \| `undefined`

***

### settlementDigest

> **settlementDigest**: `Uint8Array`

***

### signerPartyId

> **signerPartyId**: `string`

***

### stateVariables

> **stateVariables**: [`StateValue`](StateValue.md)[]

***

### transactionHex

> **transactionHex**: `string`

***

### unsignedClosePackage

> **unsignedClosePackage**: [`SignedClosePackage`](SignedClosePackage.md)

***

### updateDigest

> **updateDigest**: `Uint8Array`

[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / FactoryParticipant

# Interface: FactoryParticipant

## Properties

### addressIndex

> **addressIndex**: `number`

***

### contributionAmount

> **contributionAmount**: `bigint`

Amount this participant contributes to the factory.

***

### fundingCoinId?

> `optional` **fundingCoinId?**: `string`

UTXO coin ID this participant contributes to the factory funding TX.
When ALL participants supply a fundingCoinId and a chainProvider is given
to `createFactory`, the N-input → 1-output funding TX is built, mined,
and broadcast on-chain.  Omit for in-memory / test-only factories.

***

### partyId

> **partyId**: `string`

***

### publicKeyDigest

> **publicKeyDigest**: `string`

***

### settlementAddress?

> `optional` **settlementAddress?**: `string`

Address to receive funds on cooperative settlement. Falls back to publicKeyDigest.

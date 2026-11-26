[**@totemsdk/omnia-lsp-provider**](../index.md)

***

[@totemsdk/omnia-lsp-provider](../index.md) / OmniaLspHostOpenInput

# Interface: OmniaLspHostOpenInput

## Extends

- `OmniaLspHostFunding`

## Properties

### contestDelayBlocks?

> `optional` **contestDelayBlocks?**: `number`

Channel contest delay. Omit for the host/program default (normally 256).
Test/dev hosts may pass a shorter value when OMNIA_ALLOW_SHORT_CONTEST_DELAY=1.

#### Inherited from

`OmniaLspHostFunding.contestDelayBlocks`

***

### fundingAddress?

> `optional` **fundingAddress?**: `string`

Address to select the provider funding coin from (simple wallet address).

#### Inherited from

`OmniaLspHostFunding.fundingAddress`

***

### fundingCoinId?

> `optional` **fundingCoinId?**: `string`

#### Inherited from

`OmniaLspHostFunding.fundingCoinId`

***

### fundingCoinProofsHex?

> `optional` **fundingCoinProofsHex?**: `string` \| `string`[]

#### Inherited from

`OmniaLspHostFunding.fundingCoinProofsHex`

***

### fundingPubkey?

> `optional` **fundingPubkey?**: `string`

#### Inherited from

`OmniaLspHostFunding.fundingPubkey`

***

### fundingScript?

> `optional` **fundingScript?**: `string`

#### Inherited from

`OmniaLspHostFunding.fundingScript`

***

### fundingWitnessHex?

> `optional` **fundingWitnessHex?**: `string`

Provider-wallet-built witness. The consumer/dApp witness is still forbidden.

#### Inherited from

`OmniaLspHostFunding.fundingWitnessHex`

***

### quote

> **quote**: `OmniaLspOpenQuote`

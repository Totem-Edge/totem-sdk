[**@totemsdk/omnia-lsp**](../index.md)

***

[@totemsdk/omnia-lsp](../index.md) / OmniaLspManifest

# Interface: OmniaLspManifest

## Properties

### assets

> **assets**: [`OmniaLspAsset`](OmniaLspAsset.md)[]

***

### bond?

> `optional` **bond?**: [`OmniaLspBond`](OmniaLspBond.md)

***

### channel

> **channel**: `object`

#### addressIndex?

> `optional` **addressIndex?**: `number`

#### partyId

> **partyId**: `string`

#### publicKeyDigest

> **publicKeyDigest**: `string`

#### settlementAddress

> **settlementAddress**: `string`

***

### custody

> **custody**: [`OmniaLspCustody`](OmniaLspCustody.md)

***

### expiresAt

> **expiresAt**: `number`

***

### fees

> **fees**: [`OmniaLspFees`](OmniaLspFees.md)

***

### identity

> **identity**: `object`

#### address

> **address**: `string`

#### proofRef?

> `optional` **proofRef?**: `string`

#### publicKey?

> `optional` **publicKey?**: `string`

***

### providerId

> **providerId**: `string`

***

### publishedAt

> **publishedAt**: `number`

***

### sequence

> **sequence**: `number`

***

### service

> **service**: `object`

#### name

> **name**: `string`

#### relayUrl

> **relayUrl**: `string`

#### type

> **type**: `"omnia-lsp"`

#### version

> **version**: `string`

***

### terms

> **terms**: [`OmniaLspTerms`](OmniaLspTerms.md)

***

### topics?

> `optional` **topics?**: `string`[]

***

### version

> **version**: `"omnia-lsp/v1"`

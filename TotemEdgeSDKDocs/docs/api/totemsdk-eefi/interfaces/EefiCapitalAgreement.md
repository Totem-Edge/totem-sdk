[**@totemsdk/eefi**](../index.md)

***

[@totemsdk/eefi](../index.md) / EefiCapitalAgreement

# Interface: EefiCapitalAgreement

Binds MASH authorisation to Omnia terms and settlement rights.

`termsHash` is the canonical digest of `{ funding, operation, settlement }`
(see `eefiCapitalTermsHash`) and MUST be recomputed/verified wherever the
agreement is enforced — never trusted from storage alone.

## Properties

### funding

> **funding**: [`EefiFundingTerms`](EefiFundingTerms.md)

***

### operation

> **operation**: [`EefiOperationTerms`](EefiOperationTerms.md)

***

### settlement

> **settlement**: [`EefiSettlementTerms`](EefiSettlementTerms.md)

***

### termsHash

> **termsHash**: `string`

***

### version

> **version**: `"eefi-capital/v1"`

[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / UsageAgreementResolver

# Type Alias: UsageAgreementResolver

> **UsageAgreementResolver** = (`input`) => `Promise`\<[`UsageAgreementReference`](../interfaces/UsageAgreementReference.md) \| `undefined`\> \| [`UsageAgreementReference`](../interfaces/UsageAgreementReference.md) \| `undefined`

Resolve the agreement a completed dispatch bills against. Return undefined
when the dispatch is not purchase-bound or the agreement cannot be found
(the fold skips it — nothing is billed by guessing).

## Parameters

### input

[`UsageFoldContext`](../interfaces/UsageFoldContext.md)

## Returns

`Promise`\<[`UsageAgreementReference`](../interfaces/UsageAgreementReference.md) \| `undefined`\> \| [`UsageAgreementReference`](../interfaces/UsageAgreementReference.md) \| `undefined`

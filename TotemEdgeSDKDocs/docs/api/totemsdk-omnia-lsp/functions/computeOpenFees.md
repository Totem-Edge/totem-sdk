[**@totemsdk/omnia-lsp**](../index.md)

***

[@totemsdk/omnia-lsp](../index.md) / computeOpenFees

# Function: computeOpenFees()

> **computeOpenFees**(`manifest`, `input`, `basis?`): [`FeeScheduleResult`](../type-aliases/FeeScheduleResult.md)

Compute the complete fee schedule for an open request.

Flat and percentage fees are resolved into one atom total so admission can
compare a single number against the consumer's ceiling.

## Parameters

### manifest

[`OmniaLspManifest`](../interfaces/OmniaLspManifest.md)

### input

[`OmniaLspFeeInput`](../interfaces/OmniaLspFeeInput.md)

### basis?

[`OmniaLspFeeBasis`](../type-aliases/OmniaLspFeeBasis.md) = `DEFAULT_FEE_BASIS`

## Returns

[`FeeScheduleResult`](../type-aliases/FeeScheduleResult.md)

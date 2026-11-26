[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / createAxiaFundingProofProvider

# Function: createAxiaFundingProofProvider()

> **createAxiaFundingProofProvider**(`config`): [`FundingProofProvider`](../interfaces/FundingProofProvider.md)

Axia funding-proof provider.

- With a hardened lease token, use `/v1/wots-hardened/coinproofs` so the
  CoinProof is bound to the lease.
- With a local lease, fall back to `/v1/wallet/sdk/proofs`, which requires a
  real project x-api-key (not the shared `totem-shared` default).

## Parameters

### config

[`AxiaFundingProofProviderConfig`](../interfaces/AxiaFundingProofProviderConfig.md)

## Returns

[`FundingProofProvider`](../interfaces/FundingProofProvider.md)

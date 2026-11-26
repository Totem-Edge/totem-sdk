[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / buildFactoryPresignedDistributionScript

# Function: buildFactoryPresignedDistributionScript()

> **buildFactoryPresignedDistributionScript**(`config`): `string`

Pre-signed all-party distribution (RFC-048 §12.4) — kept as a **separate**
mechanism for a dedicated distribution coin.

This script authorizes the spend with `MULTISIG` after the escape height. It
does **not** verify the payout set; allocation correctness comes from the
pre-signed transaction that the parties exchange. Do not describe or use it as
an allocation verifier — use `buildFactoryDistributionScript` (output-enforced)
or the `settlement: 'full-distribution'` funding branch instead.

## Parameters

### config

[`FactoryDistributionScriptConfig`](../interfaces/FactoryDistributionScriptConfig.md)

## Returns

`string`

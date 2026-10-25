[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / buildFactoryDistributionScript

# Function: buildFactoryDistributionScript()

> **buildFactoryDistributionScript**(`config`): `string`

Scalable factory escape covenant (RFC-048 §12.4) — the pre-signed all-party
distribution. After the committed escape block **any** party may broadcast the
distribution (all-party `MULTISIG`), with no counterparty liveness and no
on-chain root recomputation. The committed party-set and balance roots are
pinned (`SAMESTATE`) so the set and balances cannot move.

## Parameters

### config

[`FactoryDistributionScriptConfig`](../interfaces/FactoryDistributionScriptConfig.md)

## Returns

`string`

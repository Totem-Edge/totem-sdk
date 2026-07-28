[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildAuthorityRevocationScript

# Function: buildAuthorityRevocationScript()

> **buildAuthorityRevocationScript**(`config`): `string`

Build a revocation script that enforces:
  1. Authority signed the revocation
  2. Current epoch matches the expected revocation epoch
  3. Epoch state is unchanged by this transaction

## Parameters

### config

[`AuthorityRevocationConfig`](../interfaces/AuthorityRevocationConfig.md)

## Returns

`string`

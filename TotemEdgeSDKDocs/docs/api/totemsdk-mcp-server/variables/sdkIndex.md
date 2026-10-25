[**@totemsdk/mcp-server**](../index.md)

***

[@totemsdk/mcp-server](../index.md) / sdkIndex

# ~~Variable: sdkIndex~~

> `const` **sdkIndex**: `SdkIndex`

## Deprecated

Importing this at module load forces index construction. Prefer
`getIndexState()`/`getIndex()` so a missing index is handled, not thrown.

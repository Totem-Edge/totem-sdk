[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / createWalletChannelSigningMaterial

# Function: createWalletChannelSigningMaterial()

> **createWalletChannelSigningMaterial**(`treeKey`, `options?`): [`WalletChannelSigningMaterial`](../interfaces/WalletChannelSigningMaterial.md)

Build the wallet's Omnia signing material from a unified WOTS `TreeKey`.
`sign(payload, indices)` signs with the leaf reserved by the lease and returns
the serialized `TreeSignature` Omnia verifies (RFC-037).

## Parameters

### treeKey

`TreeKey`

### options?

[`WalletChannelSigningOptions`](../interfaces/WalletChannelSigningOptions.md) = `{}`

## Returns

[`WalletChannelSigningMaterial`](../interfaces/WalletChannelSigningMaterial.md)

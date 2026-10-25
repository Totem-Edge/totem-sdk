[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / publishAxiaWalletCapabilities

# Function: publishAxiaWalletCapabilities()

> **publishAxiaWalletCapabilities**(`manifest`, `options?`): `Promise`\<[`PublishCapabilityResult`](../interfaces/PublishCapabilityResult.md)\>

Publish (mirror) a wallet's manifest to Axia. Admin-guarded on the server;
`options.adminKey` is required and never logged.

## Parameters

### manifest

[`WalletCapabilityManifest`](../interfaces/WalletCapabilityManifest.md)

### options?

[`AxiaContractClientOptions`](../interfaces/AxiaContractClientOptions.md) = `{}`

## Returns

`Promise`\<[`PublishCapabilityResult`](../interfaces/PublishCapabilityResult.md)\>

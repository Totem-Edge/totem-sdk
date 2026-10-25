[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / fetchAxiaWalletCapabilities

# Function: fetchAxiaWalletCapabilities()

> **fetchAxiaWalletCapabilities**(`wallet`, `options?`): `Promise`\<[`WalletCapabilityManifest`](../interfaces/WalletCapabilityManifest.md)\>

Read a wallet's capability manifest as mirrored by Axia. The wallet is the
source of truth; this is the discovery read used by dApps and by the wallet to
verify its own mirror.

## Parameters

### wallet

`string`

### options?

[`AxiaContractClientOptions`](../interfaces/AxiaContractClientOptions.md) & `object` = `{}`

## Returns

`Promise`\<[`WalletCapabilityManifest`](../interfaces/WalletCapabilityManifest.md)\>

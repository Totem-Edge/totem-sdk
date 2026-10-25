[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / diffWalletCapabilityManifests

# Function: diffWalletCapabilityManifests()

> **diffWalletCapabilityManifests**(`local`, `remote`): [`ManifestDrift`](../interfaces/ManifestDrift.md)[]

Compare the wallet's locally-built manifest (source of truth) with the one
Axia serves. An empty result means the mirror is in sync. Used by the
anti-drift gate and by wallets that re-publish on mismatch.

## Parameters

### local

[`WalletCapabilityManifest`](../interfaces/WalletCapabilityManifest.md)

### remote

[`WalletCapabilityManifest`](../interfaces/WalletCapabilityManifest.md)

## Returns

[`ManifestDrift`](../interfaces/ManifestDrift.md)[]

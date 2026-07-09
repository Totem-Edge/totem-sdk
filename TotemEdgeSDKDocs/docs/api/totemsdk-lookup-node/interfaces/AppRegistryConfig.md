[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / AppRegistryConfig

# Interface: AppRegistryConfig

## Properties

### enabled

> **enabled**: `true`

***

### requireSignature?

> `optional` **requireSignature?**: `boolean`

Require a valid Ed25519 signature on every APP_ANNOUNCE.
Default: true (secure by default — rejects unsigned or invalidly-signed announcements).
Set to false only on private/trusted networks.

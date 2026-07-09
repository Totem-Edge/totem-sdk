[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / AgentRegistryConfig

# Interface: AgentRegistryConfig

## Properties

### enabled

> **enabled**: `true`

***

### expiryCheckIntervalMs?

> `optional` **expiryCheckIntervalMs?**: `number`

***

### requireSignature?

> `optional` **requireSignature?**: `boolean`

Require a valid Ed25519 signature on every AGENT_ANNOUNCE.
Default: true (secure by default — rejects unsigned or invalidly-signed announcements).
Set to false only on private/trusted networks.

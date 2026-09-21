[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / OmniaHostConfig

# Interface: OmniaHostConfig

## Properties

### analyticsDbPath?

> `optional` **analyticsDbPath?**: `string`

***

### chainRpcPassword?

> `optional` **chainRpcPassword?**: `string`

***

### chainRpcUrl

> **chainRpcUrl**: `string`

***

### dbPath

> **dbPath**: `string`

***

### deviceId?

> `optional` **deviceId?**: `string`

Stable device id for the lease journal.

***

### host

> **host**: `string`

***

### identityFile?

> `optional` **identityFile?**: `string`

Identity file containing a delegated identity claim (operator root → service delegate).

***

### keyfile?

> `optional` **keyfile?**: `string`

Path to a keyfile JSON (resolved against cwd).

***

### keyfilePassphrase?

> `optional` **keyfilePassphrase?**: `string`

Keyfile decryption passphrase.

***

### localAddressIndex?

> `optional` **localAddressIndex?**: `number`

***

### localPartyId?

> `optional` **localPartyId?**: `string`

***

### localPubkey?

> `optional` **localPubkey?**: `string`

***

### localSettlementAddress?

> `optional` **localSettlementAddress?**: `string`

***

### nodeMode?

> `optional` **nodeMode?**: `string`

***

### port

> **port**: `number`

***

### readOnly

> **readOnly**: `boolean`

"1" forces read-only mode even with keys present.

***

### relay?

> `optional` **relay?**: `string`

***

### seed?

> `optional` **seed?**: `string`

BIP39 mnemonic or hex seed (same formats @totemsdk/core accepts).

***

### serviceType

> **serviceType**: `string`

EdgeServiceManifest serviceType (default "omnia-router").

***

### wsPath

> **wsPath**: `string`

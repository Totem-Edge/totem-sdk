[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / OmniaHostConfig

# Interface: OmniaHostConfig

## Properties

### allowedOrigins?

> `optional` **allowedOrigins?**: `string`[]

Browser Origin allowlist for the control plane (OMNIA_ALLOWED_ORIGINS,
comma-separated). Undefined/empty allows any Origin.

***

### analyticsDbPath?

> `optional` **analyticsDbPath?**: `string`

***

### chainRpcPassword?

> `optional` **chainRpcPassword?**: `string`

***

### chainRpcUrl

> **chainRpcUrl**: `string`

***

### controlToken?

> `optional` **controlToken?**: `string`

Bearer token required on control-plane requests (OMNIA_CONTROL_TOKEN).
Undefined disables token auth.

***

### custodyMode?

> `optional` **custodyMode?**: `CustodyMode`

Deployment custody mode (RFC-058). Defaults to self-custody; hosted custody
is explicit and policy-controlled. This does not change on-chain custody.

***

### dbPath

> **dbPath**: `string`

***

### deviceId?

> `optional` **deviceId?**: `string`

Stable device id for the lease journal.

***

### fundingPubkey?

> `optional` **fundingPubkey?**: `string`

Public key (0x…) that owns the funding coin. When set, the host signs the
funding-transaction digest via the node's `sign` command to assemble the
channel funding witness (OMNIA_FUNDING_PUBKEY).

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

### networkId?

> `optional` **networkId?**: `string`

Observation network id (multi-network deployments).

***

### nodeMode?

> `optional` **nodeMode?**: `string`

***

### observeDbPath?

> `optional` **observeDbPath?**: `string`

Durable observation journal DB (default: alongside dbPath).

***

### observeDisabled?

> `optional` **observeDisabled?**: `boolean`

Disable the observation feed entirely (OMNIA_OBSERVE=0).

***

### p2pHubHost?

> `optional` **p2pHubHost?**: `string`

***

### p2pHubOrigins?

> `optional` **p2pHubOrigins?**: `string`[]

***

### p2pHubPort?

> `optional` **p2pHubPort?**: `number`

RFC-062 local P2P hub (optional). One Hyperswarm shared by dapps.

***

### p2pHubToken?

> `optional` **p2pHubToken?**: `string`

***

### p2pHubTopics?

> `optional` **p2pHubTopics?**: `string`[]

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

### sourceNodeId?

> `optional` **sourceNodeId?**: `string`

Stable observation source id (default: localPartyId or "omnia-host").

***

### wsPath

> **wsPath**: `string`

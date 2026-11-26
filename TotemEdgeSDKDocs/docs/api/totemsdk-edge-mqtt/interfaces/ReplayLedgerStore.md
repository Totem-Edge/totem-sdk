[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / ReplayLedgerStore

# Interface: ReplayLedgerStore

Atomic durable replay claims. Plain StorageAdapter get/set is insufficient.
All handlers for a device must share the same store and validity settings.

## Methods

### claim()

> **claim**(`key`, `expiresAt`, `now`): `Promise`\<`boolean`\>

Atomically insert a claim only when no claim exists or its expiresAt < now.
Return true only after the new claim is durable; false means duplicate.
Entries must remain present through expiresAt (inclusive). This operation
must be exclusive across every process using the store. On uncertainty,
throw; never return true for a claim whose persistence is unknown.

#### Parameters

##### key

`string`

##### expiresAt

`number`

##### now

`number`

#### Returns

`Promise`\<`boolean`\>

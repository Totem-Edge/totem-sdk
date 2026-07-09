[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / BalanceStreamBackend

# Interface: BalanceStreamBackend

Plug-in interface for the balance data source.

Implement this to use any chain provider — LookupNode, a raw Minima RPC,
a custom indexer — instead of the default Axia hosted API.

## Examples

```ts
import { LookupBackend } from '@totemsdk/realtime';
import { connectLookupNode } from '@totemsdk/lookup-client';

const client = await connectLookupNode({ hyperswarmTopic: 'abc...' });
const manager = createBalanceStreamManager(deps, {
  backend: new LookupBackend(client),
});
```

```ts
import { PureMinimaBackend } from '@totemsdk/realtime';
import { createPureMinimaClient } from '@totemsdk/pureminima-rpc';

const rpc = createPureMinimaClient({ host: 'localhost', port: 9005 });
const manager = createBalanceStreamManager(deps, {
  backend: new PureMinimaBackend(rpc),
});
```

## Properties

### supportsPush?

> `readonly` `optional` **supportsPush?**: `boolean`

Whether this backend delivers push updates via `subscribe()`.
If false or absent the manager will call `getBalance()` on a timer.

## Methods

### getBalance()

> **getBalance**(`address`): `Promise`\<[`BalanceEntry`](BalanceEntry.md)[]\>

Fetch the current balance for one address.
Called for the initial snapshot and for poll cycles on non-push backends.

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`BalanceEntry`](BalanceEntry.md)[]\>

***

### subscribe()?

> `optional` **subscribe**(`addresses`, `onUpdate`): `Promise`\<[`BackendUnsubscribe`](../type-aliases/BackendUnsubscribe.md)\>

(Optional) Subscribe to real-time updates for a set of addresses.
Only called when `supportsPush` is true.
Must call `onUpdate(address, entries)` whenever the balance changes.
Returns an unsubscribe function to clean up listeners and watches.

#### Parameters

##### addresses

`string`[]

##### onUpdate

(`address`, `entries`) => `void`

#### Returns

`Promise`\<[`BackendUnsubscribe`](../type-aliases/BackendUnsubscribe.md)\>

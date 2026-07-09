[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / PureMinimaBackend

# Class: PureMinimaBackend

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

## Implements

- [`BalanceStreamBackend`](../interfaces/BalanceStreamBackend.md)

## Constructors

### Constructor

> **new PureMinimaBackend**(`client`): `PureMinimaBackend`

#### Parameters

##### client

[`PureMinimaLike`](../interfaces/PureMinimaLike.md)

#### Returns

`PureMinimaBackend`

## Properties

### supportsPush

> `readonly` **supportsPush**: `false` = `false`

Whether this backend delivers push updates via `subscribe()`.
If false or absent the manager will call `getBalance()` on a timer.

#### Implementation of

[`BalanceStreamBackend`](../interfaces/BalanceStreamBackend.md).[`supportsPush`](../interfaces/BalanceStreamBackend.md#supportspush)

## Methods

### getBalance()

> **getBalance**(`address`): `Promise`\<[`BalanceEntry`](../interfaces/BalanceEntry.md)[]\>

Fetch the current balance for one address.
Called for the initial snapshot and for poll cycles on non-push backends.

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`BalanceEntry`](../interfaces/BalanceEntry.md)[]\>

#### Implementation of

[`BalanceStreamBackend`](../interfaces/BalanceStreamBackend.md).[`getBalance`](../interfaces/BalanceStreamBackend.md#getbalance)

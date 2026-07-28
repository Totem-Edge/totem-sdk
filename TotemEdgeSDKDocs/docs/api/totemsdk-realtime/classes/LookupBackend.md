[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / LookupBackend

# Class: LookupBackend

Plug-in interface for the portfolio data source.

Implement this to use any chain provider — LookupNode, a raw Minima RPC,
a custom indexer — instead of the default Axia hosted API.

## Examples

```ts
import { LookupBackend } from '@totemsdk/realtime';
import { connectLookupNode } from '@totemsdk/lookup-client';

const client = await connectLookupNode({ hyperswarmTopic: 'abc...' });
const manager = createPortfolioStreamManager(deps, {
  backend: new LookupBackend(client),
});
```

```ts
import { PureMinimaBackend } from '@totemsdk/realtime';
import { createPureMinimaClient } from '@totemsdk/pureminima-rpc';

const rpc = createPureMinimaClient({ host: 'localhost', port: 9005 });
const manager = createPortfolioStreamManager(deps, {
  backend: new PureMinimaBackend(rpc),
});
```

## Implements

- [`PortfolioBackend`](../interfaces/PortfolioBackend.md)

## Constructors

### Constructor

> **new LookupBackend**(`client`): `LookupBackend`

#### Parameters

##### client

[`LookupLike`](../interfaces/LookupLike.md)

#### Returns

`LookupBackend`

## Properties

### supportsPush

> `readonly` **supportsPush**: `true` = `true`

Whether this backend delivers push updates via `subscribe()`.
If false or absent the manager will call `getPortfolio()` on a timer.

#### Implementation of

[`PortfolioBackend`](../interfaces/PortfolioBackend.md).[`supportsPush`](../interfaces/PortfolioBackend.md#supportspush)

## Methods

### getPortfolio()

> **getPortfolio**(`address`): `Promise`\<[`PortfolioEntry`](../interfaces/PortfolioEntry.md)[]\>

Fetch the current portfolio for one address.
Called for the initial snapshot and for poll cycles on non-push backends.

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`PortfolioEntry`](../interfaces/PortfolioEntry.md)[]\>

#### Implementation of

[`PortfolioBackend`](../interfaces/PortfolioBackend.md).[`getPortfolio`](../interfaces/PortfolioBackend.md#getportfolio)

***

### subscribe()

> **subscribe**(`addresses`, `onUpdate`): `Promise`\<[`BackendUnsubscribe`](../type-aliases/BackendUnsubscribe.md)\>

(Optional) Subscribe to real-time updates for a set of addresses.
Only called when `supportsPush` is true.
Must call `onUpdate(address, entries)` whenever the portfolio changes.
Returns an unsubscribe function to clean up listeners and watches.

#### Parameters

##### addresses

`string`[]

##### onUpdate

(`address`, `entries`) => `void`

#### Returns

`Promise`\<[`BackendUnsubscribe`](../type-aliases/BackendUnsubscribe.md)\>

#### Implementation of

[`PortfolioBackend`](../interfaces/PortfolioBackend.md).[`subscribe`](../interfaces/PortfolioBackend.md#subscribe)

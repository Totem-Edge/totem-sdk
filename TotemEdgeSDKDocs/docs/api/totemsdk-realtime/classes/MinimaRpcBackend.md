[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / MinimaRpcBackend

# Class: MinimaRpcBackend

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
import { MinimaRpcBackend } from '@totemsdk/realtime';
import { createMinimaRpcClient } from '@totemsdk/minima-rpc';

const rpc = createMinimaRpcClient({ host: 'localhost', port: 9005 });
const manager = createPortfolioStreamManager(deps, {
  backend: new MinimaRpcBackend(rpc),
});
```

## Implements

- [`PortfolioBackend`](../interfaces/PortfolioBackend.md)

## Constructors

### Constructor

> **new MinimaRpcBackend**(`client`): `MinimaRpcBackend`

#### Parameters

##### client

[`MinimaRpcLike`](../interfaces/MinimaRpcLike.md)

#### Returns

`MinimaRpcBackend`

## Properties

### supportsPush

> `readonly` **supportsPush**: `false` = `false`

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

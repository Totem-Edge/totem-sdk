[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / sendTransaction

# Function: sendTransaction()

> **sendTransaction**(`params`): `Promise`\<[`SendResult`](../interfaces/SendResult.md)\>

Send a Minima transaction end-to-end.

Fetches spendable coins for the sender address, builds and signs a
transaction using a per-address WOTS TreeKey, mines TxPoW in a
`worker_threads` Worker (non-blocking), then submits the mined TxPoW to
Axia for broadcast on the Minima network.

The difficulty target is cached per `axiaBaseUrl` for 60 seconds to avoid
redundant network round-trips in high-throughput scenarios.

## Parameters

### params

[`SendParams`](../interfaces/SendParams.md)

## Returns

`Promise`\<[`SendResult`](../interfaces/SendResult.md)\>

## Example

```ts
import { sendTransaction } from '@totemsdk/node';

const result = await sendTransaction({
  seed: 'word1 word2 ... word24',
  addressIndex: 0,
  toAddress: 'MxABC...',
  amount: '10',
  axiaBaseUrl: 'https://api.axia.to',
  apiKey: 'ak_live_...',
  signingIndices: { l1: 0, l2: 0 },
});
console.log('TxPoW ID:', result.txpowId);
console.log(`Mined in ${result.elapsedMs}ms via ${result.miningSource}`);
```

## Throws

If there are insufficient coins, signing fails, mining is aborted,
  or the Axia API returns an error.

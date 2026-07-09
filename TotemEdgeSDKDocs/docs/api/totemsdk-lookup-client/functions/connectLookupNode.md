[**@totemsdk/lookup-client**](../index.md)

***

[@totemsdk/lookup-client](../index.md) / connectLookupNode

# Function: connectLookupNode()

> **connectLookupNode**(`config`): `Promise`\<[`LookupClient`](../classes/LookupClient.md)\>

Create and connect a LookupClient to a personal lookup node.

## Parameters

### config

[`LookupClientConfig`](../interfaces/LookupClientConfig.md)

## Returns

`Promise`\<[`LookupClient`](../classes/LookupClient.md)\>

## Example

```ts
// P2P via Hyperswarm (Pear/Bare/Node)
const client = await connectLookupNode({ hyperswarmTopic: 'deadbeef...' });
const coins = await client.getCoins({ address: '0xMx...' });

// Subscribe to real-time coin updates
const unsub = client.subscribeCoinUpdates(ev => console.log('coin event', ev));
await client.watchAddress('0xMx...');

// Clean up
unsub();
client.disconnect();
```

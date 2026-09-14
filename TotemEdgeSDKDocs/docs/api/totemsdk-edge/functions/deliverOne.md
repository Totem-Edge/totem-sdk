[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / deliverOne

# Function: deliverOne()

> **deliverOne**(`opts`, `entry`): `Promise`\<`boolean` \| `"held"`\>

Deliver one outbox message and mark it delivered only on a durable receipt.
Returns true when delivered, false when retry needed, 'held' when the retry
budget is exhausted.

## Parameters

### opts

[`OutboxDrainerOptions`](../interfaces/OutboxDrainerOptions.md)

### entry

[`OutboxEntry`](../interfaces/OutboxEntry.md)

## Returns

`Promise`\<`boolean` \| `"held"`\>

[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / observeSpliceSuccessor

# Function: observeSpliceSuccessor()

> **observeSpliceSuccessor**(`chain`, `options`): `Promise`\<[`ObservedSuccessor`](../interfaces/ObservedSuccessor.md) \| `null`\>

Find the successor coin at the channel address, excluding the spent old
coin. A coin with `spent: true` is never a valid successor. Confirmation
depth is derived from the coin's creation height when the provider supplies
it; otherwise it is treated as unconfirmed.

## Parameters

### chain

[`SpliceChainObserver`](../interfaces/SpliceChainObserver.md)

### options

[`SpliceSuccessorOptions`](../interfaces/SpliceSuccessorOptions.md)

## Returns

`Promise`\<[`ObservedSuccessor`](../interfaces/ObservedSuccessor.md) \| `null`\>

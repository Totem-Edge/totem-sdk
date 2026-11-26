[**@totemsdk/manifest**](../index.md)

***

[@totemsdk/manifest](../index.md) / evaluateReleaseFeed

# Function: evaluateReleaseFeed()

> **evaluateReleaseFeed**(`feed`, `installed`): [`ReleaseFeedEvaluation`](../interfaces/ReleaseFeedEvaluation.md)

Compare installed versions against the feed. Read-only: callers decide what to
do with the result. Never throws on unknown versions.

## Parameters

### feed

[`ReleaseFeed`](../interfaces/ReleaseFeed.md)

### installed

`Record`\<`string`, `string`\>

## Returns

[`ReleaseFeedEvaluation`](../interfaces/ReleaseFeedEvaluation.md)

[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / channelContestDelay

# Function: channelContestDelay()

> **channelContestDelay**(`channel`): `number`

The contest window this channel was actually opened with. The script embeds
`contestDelayBlocks`; settlement logic must use the same value rather than the
module default.

## Parameters

### channel

`Pick`\<[`OmniaChannel`](../interfaces/OmniaChannel.md), `"contestDelayBlocks"`\>

## Returns

`number`

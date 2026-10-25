[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / createPoolAnnouncement

# Function: createPoolAnnouncement()

> **createPoolAnnouncement**(`params`): `AnnouncementEnvelope`\<[`PoolAnnouncementPayload`](../interfaces/PoolAnnouncementPayload.md)\>

Project a signed pool manifest into the generic announcement envelope.
The announcement references the pool manifest by id + hash; it does not
restate pool economics.

## Parameters

### params

[`CreatePoolAnnouncementParams`](../interfaces/CreatePoolAnnouncementParams.md)

## Returns

`AnnouncementEnvelope`\<[`PoolAnnouncementPayload`](../interfaces/PoolAnnouncementPayload.md)\>

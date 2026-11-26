[**@totemsdk/manifest**](../index.md)

***

[@totemsdk/manifest](../index.md) / releaseFeedFromAnnouncements

# Function: releaseFeedFromAnnouncements()

> **releaseFeedFromAnnouncements**(`signed`, `options?`): [`ReleaseFeed`](../interfaces/ReleaseFeed.md)

Project publisher-signed announcements into the evaluator's feed shape.

Signed announcements are the source of truth (they carry publisher, sequence
and expiry); `release-feed.json` produced by scripts/emit-release-feed.mjs is
only a CI artifact / offline snapshot. Highest sequence wins per package or
advisory id; expired announcements are ignored.

## Parameters

### signed

[`SignedReleaseAnnouncementLike`](../interfaces/SignedReleaseAnnouncementLike.md)[]

### options?

#### now?

`number`

## Returns

[`ReleaseFeed`](../interfaces/ReleaseFeed.md)

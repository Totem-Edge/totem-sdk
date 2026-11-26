[**@totemsdk/manifest**](../index.md)

***

[@totemsdk/manifest](../index.md) / publishReleaseAnnouncement

# Function: publishReleaseAnnouncement()

> **publishReleaseAnnouncement**\<`T`\>(`input`): `Promise`\<[`SignedAnnouncement`](../interfaces/SignedAnnouncement.md)\<`T`\>\>

Build, validate and sign a release/advisory announcement. The result is the
canonical envelope that lookup nodes replicate, so fleets verify a publisher
signature instead of trusting a JSON file over HTTPS.

## Type Parameters

### T

`T`

## Parameters

### input

[`PublishReleaseAnnouncementInput`](../interfaces/PublishReleaseAnnouncementInput.md)\<`T`\>

## Returns

`Promise`\<[`SignedAnnouncement`](../interfaces/SignedAnnouncement.md)\<`T`\>\>

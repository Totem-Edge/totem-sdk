[**@totemsdk/manifest**](../index.md)

***

[@totemsdk/manifest](../index.md) / ReplicatedAnnouncementStore

# Class: ReplicatedAnnouncementStore

## Constructors

### Constructor

> **new ReplicatedAnnouncementStore**(`log`): `ReplicatedAnnouncementStore`

#### Parameters

##### log

`ReplicatedLog`\<[`SignedAnnouncement`](../interfaces/SignedAnnouncement.md)\<`unknown`\>\>

#### Returns

`ReplicatedAnnouncementStore`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`announcementId`): `Promise`\<[`SignedAnnouncement`](../interfaces/SignedAnnouncement.md)\<`unknown`\> \| `undefined`\>

#### Parameters

##### announcementId

`string`

#### Returns

`Promise`\<[`SignedAnnouncement`](../interfaces/SignedAnnouncement.md)\<`unknown`\> \| `undefined`\>

***

### list()

> **list**(`query?`): `Promise`\<[`SignedAnnouncement`](../interfaces/SignedAnnouncement.md)\<`unknown`\>[]\>

Replay the replicated log through the verified, ranked in-memory store.

#### Parameters

##### query?

[`AnnouncementQuery`](../interfaces/AnnouncementQuery.md) = `{}`

#### Returns

`Promise`\<[`SignedAnnouncement`](../interfaces/SignedAnnouncement.md)\<`unknown`\>[]\>

***

### upsert()

> **upsert**(`signed`, `options?`): `Promise`\<[`AnnouncementAcceptResult`](../interfaces/AnnouncementAcceptResult.md)\>

Verify, accept locally, then append the signed envelope to the replica.

#### Parameters

##### signed

[`SignedAnnouncement`](../interfaces/SignedAnnouncement.md)

##### options?

[`AnnouncementAcceptOptions`](../interfaces/AnnouncementAcceptOptions.md) = `{}`

#### Returns

`Promise`\<[`AnnouncementAcceptResult`](../interfaces/AnnouncementAcceptResult.md)\>

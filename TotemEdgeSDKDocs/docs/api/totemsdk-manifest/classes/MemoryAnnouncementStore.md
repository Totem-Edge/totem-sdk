[**@totemsdk/manifest**](../index.md)

***

[@totemsdk/manifest](../index.md) / MemoryAnnouncementStore

# Class: MemoryAnnouncementStore

In-memory announcement index.

A store is a discovery convenience, not a source of truth: it verifies the
envelope, enforces monotonic sequence per (publisher, subjectId), drops
expired records and returns ranked results. Durable/transport-backed stores
belong in the host/lookup layer.

## Constructors

### Constructor

> **new MemoryAnnouncementStore**(`options?`): `MemoryAnnouncementStore`

#### Parameters

##### options?

[`AnnouncementStoreOptions`](../interfaces/AnnouncementStoreOptions.md) = `{}`

#### Returns

`MemoryAnnouncementStore`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

##### Returns

`number`

## Methods

### clear()

> **clear**(): `void`

#### Returns

`void`

***

### get()

> **get**(`announcementId`): [`SignedAnnouncement`](../interfaces/SignedAnnouncement.md)\<`unknown`\> \| `undefined`

#### Parameters

##### announcementId

`string`

#### Returns

[`SignedAnnouncement`](../interfaces/SignedAnnouncement.md)\<`unknown`\> \| `undefined`

***

### list()

> **list**(`query?`): [`SignedAnnouncement`](../interfaces/SignedAnnouncement.md)\<`unknown`\>[]

#### Parameters

##### query?

[`AnnouncementQuery`](../interfaces/AnnouncementQuery.md) = `{}`

#### Returns

[`SignedAnnouncement`](../interfaces/SignedAnnouncement.md)\<`unknown`\>[]

***

### removeExpired()

> **removeExpired**(`now?`): `number`

#### Parameters

##### now?

`number` = `...`

#### Returns

`number`

***

### upsert()

> **upsert**(`signed`, `options?`): `Promise`\<[`AnnouncementAcceptResult`](../interfaces/AnnouncementAcceptResult.md)\>

#### Parameters

##### signed

[`SignedAnnouncement`](../interfaces/SignedAnnouncement.md)

##### options?

[`AnnouncementAcceptOptions`](../interfaces/AnnouncementAcceptOptions.md) = `{}`

#### Returns

`Promise`\<[`AnnouncementAcceptResult`](../interfaces/AnnouncementAcceptResult.md)\>

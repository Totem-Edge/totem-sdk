[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / ResourceLockManager

# Interface: ResourceLockManager

## Methods

### acquire()

> **acquire**(`resourceId`, `holderId`, `opts?`): `Promise`\<[`AcquireResult`](AcquireResult.md)\>

#### Parameters

##### resourceId

[`ResourceId`](ResourceId.md)

##### holderId

`string`

##### opts?

###### ttlMs?

`number`

#### Returns

`Promise`\<[`AcquireResult`](AcquireResult.md)\>

***

### isLocked()

> **isLocked**(`resourceId`): `Promise`\<[`ResourceLock`](ResourceLock.md) \| `undefined`\>

#### Parameters

##### resourceId

[`ResourceId`](ResourceId.md)

#### Returns

`Promise`\<[`ResourceLock`](ResourceLock.md) \| `undefined`\>

***

### release()

> **release**(`resourceId`, `holderId`): `Promise`\<`boolean`\>

#### Parameters

##### resourceId

[`ResourceId`](ResourceId.md)

##### holderId

`string`

#### Returns

`Promise`\<`boolean`\>

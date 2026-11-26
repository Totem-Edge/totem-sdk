[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / MemorySigningJournal

# Class: MemorySigningJournal

In-process journal. Survives nothing; use as the default and in tests.

## Implements

- [`SigningIntentJournal`](../interfaces/SigningIntentJournal.md)

## Constructors

### Constructor

> **new MemorySigningJournal**(): `MemorySigningJournal`

#### Returns

`MemorySigningJournal`

## Methods

### clear()

> **clear**(): `void`

#### Returns

`void`

***

### list()

> **list**(`channelId`): [`SigningIntent`](../interfaces/SigningIntent.md)[]

#### Parameters

##### channelId

`string`

#### Returns

[`SigningIntent`](../interfaces/SigningIntent.md)[]

#### Implementation of

[`SigningIntentJournal`](../interfaces/SigningIntentJournal.md).[`list`](../interfaces/SigningIntentJournal.md#list)

***

### record()

> **record**(`intent`): `void`

#### Parameters

##### intent

[`SigningIntent`](../interfaces/SigningIntent.md)

#### Returns

`void`

#### Implementation of

[`SigningIntentJournal`](../interfaces/SigningIntentJournal.md).[`record`](../interfaces/SigningIntentJournal.md#record)

***

### update()

> **update**(`intent`): `void`

#### Parameters

##### intent

[`SigningIntent`](../interfaces/SigningIntent.md)

#### Returns

`void`

#### Implementation of

[`SigningIntentJournal`](../interfaces/SigningIntentJournal.md).[`update`](../interfaces/SigningIntentJournal.md#update)

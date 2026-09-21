[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / SqliteChannelStore

# Class: SqliteChannelStore

SQLite-backed Map facade accepted by @totemsdk/omnia's ChannelStore type.

## Extends

- `Map`\<`string`, `OmniaChannel`\>

## Constructors

### Constructor

> **new SqliteChannelStore**(`dbPath`): `SqliteChannelStore`

#### Parameters

##### dbPath

`string`

#### Returns

`SqliteChannelStore`

#### Overrides

`Map<string, OmniaChannel>.constructor`

## Properties

### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `string`

#### Inherited from

`Map.[toStringTag]`

***

### \[species\]

> `readonly` `static` **\[species\]**: `MapConstructor`

#### Inherited from

`Map.[species]`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

##### Returns

`number`

the number of elements in the Map.

#### Overrides

`Map.size`

## Methods

### \[iterator\]()

> **\[iterator\]**(): `MapIterator`\<\[`string`, `OmniaChannel`\]\>

#### Returns

`MapIterator`\<\[`string`, `OmniaChannel`\]\>

#### Overrides

`Map.[iterator]`

***

### clear()

> **clear**(): `void`

#### Returns

`void`

#### Overrides

`Map.clear`

***

### close()

> **close**(): `void`

#### Returns

`void`

***

### delete()

> **delete**(`channelId`): `boolean`

#### Parameters

##### channelId

`string`

#### Returns

`boolean`

true if an element in the Map existed and has been removed, or false if the element does not exist.

#### Overrides

`Map.delete`

***

### entries()

> **entries**(): `MapIterator`\<\[`string`, `OmniaChannel`\]\>

Returns an iterable of key, value pairs for every entry in the map.

#### Returns

`MapIterator`\<\[`string`, `OmniaChannel`\]\>

#### Overrides

`Map.entries`

***

### forEach()

> **forEach**(`callbackfn`): `void`

Executes a provided function once per each key/value pair in the Map, in insertion order.

#### Parameters

##### callbackfn

(`value`, `key`, `map`) => `void`

#### Returns

`void`

#### Overrides

`Map.forEach`

***

### get()

> **get**(`channelId`): `OmniaChannel` \| `undefined`

Returns a specified element from the Map object. If the value that is associated to the provided key is an object, then you will get a reference to that object and any change made to that object will effectively modify it inside the Map.

#### Parameters

##### channelId

`string`

#### Returns

`OmniaChannel` \| `undefined`

Returns the element associated with the specified key. If no element is associated with the specified key, undefined is returned.

#### Overrides

`Map.get`

***

### has()

> **has**(`channelId`): `boolean`

#### Parameters

##### channelId

`string`

#### Returns

`boolean`

boolean indicating whether an element with the specified key exists or not.

#### Overrides

`Map.has`

***

### keys()

> **keys**(): `MapIterator`\<`string`\>

Returns an iterable of keys in the map

#### Returns

`MapIterator`\<`string`\>

#### Overrides

`Map.keys`

***

### set()

> **set**(`channelId`, `channel`): `this`

Adds a new element with a specified key and value to the Map. If an element with the same key already exists, the element will be updated.

#### Parameters

##### channelId

`string`

##### channel

`OmniaChannel`

#### Returns

`this`

#### Overrides

`Map.set`

***

### values()

> **values**(): `MapIterator`\<`OmniaChannel`\>

Returns an iterable of values in the map

#### Returns

`MapIterator`\<`OmniaChannel`\>

#### Overrides

`Map.values`

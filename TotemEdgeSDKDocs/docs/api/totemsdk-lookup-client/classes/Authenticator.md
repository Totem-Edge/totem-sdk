[**@totemsdk/lookup-client**](../index.md)

***

[@totemsdk/lookup-client](../index.md) / Authenticator

# Class: Authenticator

Stamps WOTS auth envelopes onto outgoing messages. Stateful: each message
consumes one identity use, and the use index is the wire nonce.

## Constructors

### Constructor

> **new Authenticator**(`options`): `Authenticator`

#### Parameters

##### options

[`AuthenticatorOptions`](../interfaces/AuthenticatorOptions.md)

#### Returns

`Authenticator`

## Accessors

### maxUses

#### Get Signature

> **get** **maxUses**(): `number`

##### Returns

`number`

***

### rootPublicKey

#### Get Signature

> **get** **rootPublicKey**(): `string`

##### Returns

`string`

***

### sessionTtlMs

#### Get Signature

> **get** **sessionTtlMs**(): `number` \| `undefined`

RFC-032-A: requested ticket lifetime.

##### Returns

`number` \| `undefined`

***

### uses

#### Get Signature

> **get** **uses**(): `number`

##### Returns

`number`

***

### useTickets

#### Get Signature

> **get** **useTickets**(): `boolean`

RFC-032-A: whether tickets should be requested/used.

##### Returns

`boolean`

## Methods

### clearTicket()

> **clearTicket**(): `void`

Drop the current ticket (expired/exhausted/reconnect).

#### Returns

`void`

***

### hasValidTicket()

> **hasValidTicket**(): `boolean`

True when a currently-valid (unexpired) ticket is held.

#### Returns

`boolean`

***

### setTicket()

> **setTicket**(`ticket`): `void`

Record a freshly received session ticket (resets the local seq).

#### Parameters

##### ticket

`SessionTicket`

#### Returns

`void`

***

### stamp()

> **stamp**\<`T`\>(`msg`): `T`

Attach authentication to a message (returns a new message object):
 - a full WOTS `auth` envelope (SESSION_OPEN, high-value, or no ticket), or
 - a `ticket: { ticketId, seq }` reference (amortised).

#### Type Parameters

##### T

`T` *extends* `LookupMessage`

#### Parameters

##### msg

`Omit`\<`T`, `"auth"` \| `"ticket"`\>

#### Returns

`T`

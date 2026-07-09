[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / PaymentIntent

# Interface: PaymentIntent

The action an agent wants the wallet to take.
Agents produce intents; they do not execute them.

## Properties

### amount?

> `optional` **amount?**: `string`

Amount in the token's native unit (string to preserve precision).

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

Arbitrary extra context the agent wants to attach (e.g. invoice ref).

***

### reason?

> `optional` **reason?**: `string`

Human-readable reason for the payment (shown to user in approval UI).

***

### recipient?

> `optional` **recipient?**: `string`

Recipient Minima address (Mx… or hex).

***

### risk?

> `optional` **risk?**: `"low"` \| `"medium"` \| `"high"`

Agent's self-assessed risk level — used by AgentPolicy routing.

***

### tokenId?

> `optional` **tokenId?**: `string`

Minima tokenId, or '0x00' for native Minima.

***

### type

> **type**: `"settlement"` \| `"payment"` \| `"channel_update"` \| `"lookup"` \| `"receipt"`

Discriminator — what kind of operation this intent represents.

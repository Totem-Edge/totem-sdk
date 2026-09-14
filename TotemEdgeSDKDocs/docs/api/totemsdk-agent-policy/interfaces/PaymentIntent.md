[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / PaymentIntent

# Interface: PaymentIntent

The action an agent wants the wallet to take.
Agents produce intents; they do not execute them.

## Properties

### amount?

> `optional` **amount?**: `string`

Amount in the token's native unit (string to preserve precision).

***

### inference?

> `optional` **inference?**: `object`

Inference block — present when `type === 'inference'` and describes the
compute the agent wants authorized. Its `usage` output is the metering
unit budget/cap policies convert into spend.

#### budgetTokenId?

> `optional` **budgetTokenId?**: `string`

Token id the provider meters in, if inference is token-denominated.

#### domain

> **domain**: [`InferenceDomain`](../type-aliases/InferenceDomain.md)

#### input?

> `optional` **input?**: `unknown`

Prompt / audio / image reference to compute over.

#### maxTokens?

> `optional` **maxTokens?**: `number`

Upper bound on output tokens, used by budget policies.

#### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

#### model?

> `optional` **model?**: `string`

Requested model, when the intent targets a specific one.

#### op

> **op**: `string`

Provider-neutral operation name, e.g. 'completion', 'ragSearch'.

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

> **type**: `"payment"` \| `"channel_update"` \| `"settlement"` \| `"lookup"` \| `"receipt"` \| `"inference"`

Discriminator — what kind of operation this intent represents.

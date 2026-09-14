[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / ReplayEntry

# Type Alias: ReplayEntry

> **ReplayEntry** = \{ `claimedAt`: `number`; `leaseUntil?`: `number`; `state`: `"PROCESSING"`; \} \| \{ `completedAt`: `number`; `outcome`: [`ReplayOutcome`](../interfaces/ReplayOutcome.md); `state`: `"COMPLETED"`; \}

A durable replay entry.

Processing claims are recoverable: if a claim is never completed (process
crash), the lease expires and the message may be reclaimed safely. The
engine's CAS/idempotency protection makes reclamation safe.

## Union Members

### Type Literal

\{ `claimedAt`: `number`; `leaseUntil?`: `number`; `state`: `"PROCESSING"`; \}

#### claimedAt

> **claimedAt**: `number`

#### leaseUntil?

> `optional` **leaseUntil?**: `number`

When the processing lease expires. After this, the claim may be reclaimed.

#### state

> **state**: `"PROCESSING"`

***

### Type Literal

\{ `completedAt`: `number`; `outcome`: [`ReplayOutcome`](../interfaces/ReplayOutcome.md); `state`: `"COMPLETED"`; \}

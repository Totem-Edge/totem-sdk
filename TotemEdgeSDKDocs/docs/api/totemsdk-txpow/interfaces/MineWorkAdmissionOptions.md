[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / MineWorkAdmissionOptions

# Interface: MineWorkAdmissionOptions

## Properties

### \_skipWorker?

> `optional` **\_skipWorker?**: `boolean`

Skip the Node.js worker_threads Worker (for testing).

***

### chunkSize?

> `optional` **chunkSize?**: `number`

Hash iterations per async yield (default: 10_000).

***

### forceJs?

> `optional` **forceJs?**: `boolean`

Force the pure-JS mining path (for testing).

***

### maxIterations?

> `optional` **maxIterations?**: `number`

Hard cap on total iterations (default: unlimited).

***

### prng?

> `optional` **prng?**: `Uint8Array`\<`ArrayBufferLike`\>

Deterministic 32-byte PRNG for the TxBody (testing only). When omitted a
cryptographically random PRNG is generated.

***

### relay?

> `optional` **relay?**: [`MinimaWorkRelay`](MinimaWorkRelay.md)

Preferred Minima block relay boundary. When supplied, a genuine current
Minima block is submitted through the relay exactly once. Falls back to
the deprecated provider.broadcastBlockCandidate only when no relay is set.

***

### signal?

> `optional` **signal?**: `AbortSignal`

AbortSignal — rejects the Promise when aborted.

***

### timeMilli?

> `optional` **timeMilli?**: `bigint`

Override the template timeMilli for deterministic testing.

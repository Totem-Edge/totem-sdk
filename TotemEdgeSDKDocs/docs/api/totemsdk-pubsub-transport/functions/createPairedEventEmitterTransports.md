[**@totemsdk/pubsub-transport**](../index.md)

***

[@totemsdk/pubsub-transport](../index.md) / createPairedEventEmitterTransports

# Function: createPairedEventEmitterTransports()

> **createPairedEventEmitterTransports**(): \[[`EventEmitterTransport`](../classes/EventEmitterTransport.md), [`EventEmitterTransport`](../classes/EventEmitterTransport.md)\]

Create a bidirectional pair of EventEmitterTransports sharing one bus.
What [0] publishes, [1] receives via onMessage, and vice-versa.

## Returns

\[[`EventEmitterTransport`](../classes/EventEmitterTransport.md), [`EventEmitterTransport`](../classes/EventEmitterTransport.md)\]

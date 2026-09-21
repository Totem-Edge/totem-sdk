[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / DurableMqttEdgeQueueOptions

# Interface: DurableMqttEdgeQueueOptions

## Properties

### namespace?

> `optional` **namespace?**: `string`

Namespace prefix for the queue keys (default 'mqtt').

***

### requireAckMode?

> `optional` **requireAckMode?**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"`

Required write-ack level the backing adapter must satisfy (default
'durably-acknowledged').

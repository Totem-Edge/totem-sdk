[**@totemsdk/edge-ros2**](../index.md)

***

[@totemsdk/edge-ros2](../index.md) / Ros2Message

# Interface: Ros2Message

## Properties

### data

> **data**: `Uint8Array`

Serialised message bytes (CDR or custom serialisation).

***

### frameId?

> `optional` **frameId?**: `string`

Frame ID for TF transforms.

***

### receivedAt

> **receivedAt**: `number`

Timestamp of receipt.

***

### sourceNode?

> `optional` **sourceNode?**: `string`

Source node name.

***

### timestamp?

> `optional` **timestamp?**: `bigint`

ROS timestamp (nanoseconds since epoch).

***

### type

> **type**: `string`

Message type name (e.g. "sensor_msgs/msg/Image").

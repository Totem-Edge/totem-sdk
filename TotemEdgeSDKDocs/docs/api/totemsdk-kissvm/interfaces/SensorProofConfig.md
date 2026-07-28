[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / SensorProofConfig

# Interface: SensorProofConfig

## Properties

### deviceId

> **deviceId**: `string`

Sensor/device identifier.

***

### devicePkd

> **devicePkd**: `string`

The device's WOTS public key digest.

***

### deviceProof

> **deviceProof**: `string`

Merkle proof that the device is in the policy root.

***

### maxAgeSeconds

> **maxAgeSeconds**: `number`

Maximum age of the reading in seconds.

***

### policyRoot

> **policyRoot**: `string`

The policy root that authorizes this device.

***

### reading

> **reading**: `string`

The sensor reading value.

***

### signature

> **signature**: `string`

The device's WOTS signature over the reading.

***

### timestamp

> **timestamp**: `number`

The sensor reading timestamp (Unix ms).

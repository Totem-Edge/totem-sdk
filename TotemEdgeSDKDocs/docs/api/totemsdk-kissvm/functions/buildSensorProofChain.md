[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildSensorProofChain

# Function: buildSensorProofChain()

> **buildSensorProofChain**(`devicePkd`, `fleetPolicy`, `reading`, `timestamp`): [`ProofLink`](../interfaces/ProofLink.md)[]

Build a proof chain for a sensor reading through a policy hierarchy.

## Parameters

### devicePkd

`string`

The device's public key digest.

### fleetPolicy

[`PolicyTree`](../interfaces/PolicyTree.md)

The fleet policy tree.

### reading

`string`

The sensor reading value.

### timestamp

`number`

The reading timestamp.

## Returns

[`ProofLink`](../interfaces/ProofLink.md)[]

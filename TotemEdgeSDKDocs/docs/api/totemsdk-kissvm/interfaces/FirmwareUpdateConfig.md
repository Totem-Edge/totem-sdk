[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / FirmwareUpdateConfig

# Interface: FirmwareUpdateConfig

## Properties

### hashPort

> **hashPort**: `number`

STATE port for firmware hash.

***

### manufacturerPkd

> **manufacturerPkd**: `string`

The manufacturer's public key digest.

***

### manufacturerPort

> **manufacturerPort**: `number`

STATE port for manufacturer public key.

***

### ownerPkd

> **ownerPkd**: `string`

The device owner's public key digest.

***

### policyRoot

> **policyRoot**: `string`

The policy root authorizing firmware updates.

***

### updateProof

> **updateProof**: `string`

Merkle proof that the update script is in the policy root.

***

### versionPort

> **versionPort**: `number`

STATE port for firmware version.

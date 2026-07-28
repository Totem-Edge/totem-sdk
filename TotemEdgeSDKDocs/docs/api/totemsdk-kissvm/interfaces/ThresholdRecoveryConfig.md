[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / ThresholdRecoveryConfig

# Interface: ThresholdRecoveryConfig

## Properties

### custodians

> **custodians**: `string`[]

Recovery custodian public key digests.

***

### delayBlocks

> **delayBlocks**: `number`

Delay in blocks before recovery activates.

***

### institutionalRoot

> **institutionalRoot**: `string`

The institutional identity root being recovered.

***

### noticeEndpoint?

> `optional` **noticeEndpoint?**: `string`

Public notice endpoint (for audit).

***

### recoveryId

> **recoveryId**: `string`

Recovery identifier.

***

### threshold

> **threshold**: `number`

Number of custodians required to approve recovery.

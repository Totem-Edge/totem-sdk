[**@totemsdk/provider-bond**](../index.md)

***

[@totemsdk/provider-bond](../index.md) / MemoryProviderBondStore

# Class: MemoryProviderBondStore

## Constructors

### Constructor

> **new MemoryProviderBondStore**(): `MemoryProviderBondStore`

#### Returns

`MemoryProviderBondStore`

## Methods

### attachBondProof()

> **attachBondProof**(`providerId`, `proof`): `Promise`\<`void`\>

#### Parameters

##### providerId

`string`

##### proof

[`BondProofRef`](../interfaces/BondProofRef.md)

#### Returns

`Promise`\<`void`\>

***

### getProvider()

> **getProvider**(`providerId`): `Promise`\<[`ProviderBondManifest`](../interfaces/ProviderBondManifest.md) \| `undefined`\>

#### Parameters

##### providerId

`string`

#### Returns

`Promise`\<[`ProviderBondManifest`](../interfaces/ProviderBondManifest.md) \| `undefined`\>

***

### getSnapshot()

> **getSnapshot**(): `Promise`\<[`ProviderBondRegistryState`](../interfaces/ProviderBondRegistryState.md)\>

#### Returns

`Promise`\<[`ProviderBondRegistryState`](../interfaces/ProviderBondRegistryState.md)\>

***

### listOfflineProviders()

> **listOfflineProviders**(`maxHeartbeatAgeMs`, `now`): `Promise`\<[`ProviderBondManifest`](../interfaces/ProviderBondManifest.md)[]\>

#### Parameters

##### maxHeartbeatAgeMs

`number`

##### now

`number`

#### Returns

`Promise`\<[`ProviderBondManifest`](../interfaces/ProviderBondManifest.md)[]\>

***

### listProviders()

> **listProviders**(): `Promise`\<[`ProviderBondManifest`](../interfaces/ProviderBondManifest.md)[]\>

#### Returns

`Promise`\<[`ProviderBondManifest`](../interfaces/ProviderBondManifest.md)[]\>

***

### listProvidersByServiceType()

> **listProvidersByServiceType**(`serviceType`): `Promise`\<[`ProviderBondManifest`](../interfaces/ProviderBondManifest.md)[]\>

#### Parameters

##### serviceType

`string`

#### Returns

`Promise`\<[`ProviderBondManifest`](../interfaces/ProviderBondManifest.md)[]\>

***

### listRiskyProviders()

> **listRiskyProviders**(`threshold`): `Promise`\<[`ProviderBondManifest`](../interfaces/ProviderBondManifest.md)[]\>

#### Parameters

##### threshold

`number`

#### Returns

`Promise`\<[`ProviderBondManifest`](../interfaces/ProviderBondManifest.md)[]\>

***

### recordIncident()

> **recordIncident**(`providerId`, `incident`): `Promise`\<`void`\>

#### Parameters

##### providerId

`string`

##### incident

[`IncidentRecord`](../interfaces/IncidentRecord.md)

#### Returns

`Promise`\<`void`\>

***

### recordProbe()

> **recordProbe**(`providerId`, `probe`): `Promise`\<`void`\>

#### Parameters

##### providerId

`string`

##### probe

[`ProbeResult`](../interfaces/ProbeResult.md)

#### Returns

`Promise`\<`void`\>

***

### registerProvider()

> **registerProvider**(`manifest`): `Promise`\<`void`\>

#### Parameters

##### manifest

[`ProviderBondManifest`](../interfaces/ProviderBondManifest.md)

#### Returns

`Promise`\<`void`\>

***

### updateProviderManifest()

> **updateProviderManifest**(`manifest`): `Promise`\<`void`\>

#### Parameters

##### manifest

[`ProviderBondManifest`](../interfaces/ProviderBondManifest.md)

#### Returns

`Promise`\<`void`\>

***

### updateScore()

> **updateScore**(`providerId`, `score`): `Promise`\<`void`\>

#### Parameters

##### providerId

`string`

##### score

[`ProviderScore`](../interfaces/ProviderScore.md)

#### Returns

`Promise`\<`void`\>

[**@totemsdk/provider-bond**](../index.md)

***

[@totemsdk/provider-bond](../index.md) / DurableProviderBondStore

# Interface: DurableProviderBondStore

## Methods

### attachBondProof()

> **attachBondProof**(`providerId`, `proof`): `Promise`\<`void`\>

#### Parameters

##### providerId

`string`

##### proof

[`BondProofRef`](BondProofRef.md)

#### Returns

`Promise`\<`void`\>

***

### getProvider()

> **getProvider**(`providerId`): `Promise`\<[`ProviderBondManifest`](ProviderBondManifest.md) \| `undefined`\>

#### Parameters

##### providerId

`string`

#### Returns

`Promise`\<[`ProviderBondManifest`](ProviderBondManifest.md) \| `undefined`\>

***

### getRevision()

> **getRevision**(): `Promise`\<`number`\>

Current registry transition counter (0 before the first write).

#### Returns

`Promise`\<`number`\>

***

### getSnapshot()

> **getSnapshot**(): `Promise`\<[`ProviderBondRegistryState`](ProviderBondRegistryState.md)\>

#### Returns

`Promise`\<[`ProviderBondRegistryState`](ProviderBondRegistryState.md)\>

***

### hasState()

> **hasState**(): `Promise`\<`boolean`\>

True once any registry record has been persisted.

#### Returns

`Promise`\<`boolean`\>

***

### listOfflineProviders()

> **listOfflineProviders**(`maxHeartbeatAgeMs`, `now`): `Promise`\<[`ProviderBondManifest`](ProviderBondManifest.md)[]\>

#### Parameters

##### maxHeartbeatAgeMs

`number`

##### now

`number`

#### Returns

`Promise`\<[`ProviderBondManifest`](ProviderBondManifest.md)[]\>

***

### listProviders()

> **listProviders**(): `Promise`\<[`ProviderBondManifest`](ProviderBondManifest.md)[]\>

#### Returns

`Promise`\<[`ProviderBondManifest`](ProviderBondManifest.md)[]\>

***

### listProvidersByServiceType()

> **listProvidersByServiceType**(`serviceType`): `Promise`\<[`ProviderBondManifest`](ProviderBondManifest.md)[]\>

#### Parameters

##### serviceType

`string`

#### Returns

`Promise`\<[`ProviderBondManifest`](ProviderBondManifest.md)[]\>

***

### listRiskyProviders()

> **listRiskyProviders**(`threshold`): `Promise`\<[`ProviderBondManifest`](ProviderBondManifest.md)[]\>

#### Parameters

##### threshold

`number`

#### Returns

`Promise`\<[`ProviderBondManifest`](ProviderBondManifest.md)[]\>

***

### recordIncident()

> **recordIncident**(`providerId`, `incident`): `Promise`\<`void`\>

#### Parameters

##### providerId

`string`

##### incident

[`IncidentRecord`](IncidentRecord.md)

#### Returns

`Promise`\<`void`\>

***

### recordProbe()

> **recordProbe**(`providerId`, `probe`): `Promise`\<`void`\>

#### Parameters

##### providerId

`string`

##### probe

[`ProbeResult`](ProbeResult.md)

#### Returns

`Promise`\<`void`\>

***

### registerProvider()

> **registerProvider**(`manifest`): `Promise`\<`void`\>

#### Parameters

##### manifest

[`ProviderBondManifest`](ProviderBondManifest.md)

#### Returns

`Promise`\<`void`\>

***

### updateProviderManifest()

> **updateProviderManifest**(`manifest`): `Promise`\<`void`\>

#### Parameters

##### manifest

[`ProviderBondManifest`](ProviderBondManifest.md)

#### Returns

`Promise`\<`void`\>

***

### updateScore()

> **updateScore**(`providerId`, `score`): `Promise`\<`void`\>

#### Parameters

##### providerId

`string`

##### score

[`ProviderScore`](ProviderScore.md)

#### Returns

`Promise`\<`void`\>

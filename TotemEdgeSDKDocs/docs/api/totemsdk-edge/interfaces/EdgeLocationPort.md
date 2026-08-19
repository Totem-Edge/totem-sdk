[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeLocationPort

# Interface: EdgeLocationPort

## Methods

### createClaim()

> **createClaim**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `claim`: `unknown`; `claimId`: `string`; \}\>\>

#### Parameters

##### params

###### challenge?

\{ `expiresAt?`: `number`; `issuedAt`: `number`; `nonce`: `string`; `verifierId`: `string`; \}

###### challenge.expiresAt?

`number`

###### challenge.issuedAt

`number`

###### challenge.nonce

`string`

###### challenge.verifierId

`string`

###### corroboration?

\{ `beaconsSeen?`: `string`[]; `cellTowers?`: `string`[]; `lorawanGateways?`: `string`[]; `metadata?`: `Record`\<`string`, `unknown`\>; `nearbyDeviceProofIds?`: `string`[]; `networkProfileId?`: `string`; `wifiFingerprints?`: `string`[]; \}

###### corroboration.beaconsSeen?

`string`[]

###### corroboration.cellTowers?

`string`[]

###### corroboration.lorawanGateways?

`string`[]

###### corroboration.metadata?

`Record`\<`string`, `unknown`\>

###### corroboration.nearbyDeviceProofIds?

`string`[]

###### corroboration.networkProfileId?

`string`

###### corroboration.wifiFingerprints?

`string`[]

###### deviceClass?

`string`

###### deviceId

`string`

###### location

\{ `accuracyM?`: `number`; `altitudeM?`: `number`; `lat`: `number`; `lon`: `number`; \}

###### location.accuracyM?

`number`

###### location.altitudeM?

`number`

###### location.lat

`number`

###### location.lon

`number`

###### metadata?

`Record`\<`string`, `unknown`\>

###### observedAt?

`number`

###### operatorId?

`string`

###### source

\{ `fixType?`: `string`; `hdop?`: `number`; `jammingFlag?`: `boolean`; `metadata?`: `Record`\<`string`, `unknown`\>; `nmeaPayloadHash?`: `string`; `pdop?`: `number`; `rawPayloadHash?`: `string`; `satellitesUsed?`: `number`; `spoofingFlag?`: `boolean`; `type`: `string`; `vdop?`: `number`; \}

###### source.fixType?

`string`

###### source.hdop?

`number`

###### source.jammingFlag?

`boolean`

###### source.metadata?

`Record`\<`string`, `unknown`\>

###### source.nmeaPayloadHash?

`string`

###### source.pdop?

`number`

###### source.rawPayloadHash?

`string`

###### source.satellitesUsed?

`number`

###### source.spoofingFlag?

`boolean`

###### source.type

`string`

###### source.vdop?

`number`

###### subjectId

`string`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `claim`: `unknown`; `claimId`: `string`; \}\>\>

***

### createProof()

> **createProof**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `proof`: `unknown`; `proofId`: `string`; \}\>\>

#### Parameters

##### params

###### claim

`unknown`

###### context?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `proof`: `unknown`; `proofId`: `string`; \}\>\>

***

### createTrail()

> **createTrail**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `trail`: `unknown`; `trailId`: `string`; \}\>\>

#### Parameters

##### params

###### deviceId

`string`

###### maxSpeedMps?

`number`

###### metadata?

`Record`\<`string`, `unknown`\>

###### samples

`object`[]

###### subjectId

`string`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `trail`: `unknown`; `trailId`: `string`; \}\>\>

***

### scoreClaim()

> **scoreClaim**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `level`: `string`; `negativeSignals`: `string`[]; `positiveSignals`: `string`[]; `score`: `number`; \}\>\>

#### Parameters

##### params

###### claim

`unknown`

###### options?

\{ `accuracyThresholdM?`: `number`; `maxAgeMs?`: `number`; `now?`: `number`; `strongHdop?`: `number`; `strongSatellites?`: `number`; `weakAccuracyThresholdM?`: `number`; \}

###### options.accuracyThresholdM?

`number`

###### options.maxAgeMs?

`number`

###### options.now?

`number`

###### options.strongHdop?

`number`

###### options.strongSatellites?

`number`

###### options.weakAccuracyThresholdM?

`number`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `level`: `string`; `negativeSignals`: `string`[]; `positiveSignals`: `string`[]; `score`: `number`; \}\>\>

***

### verifyProof()

> **verifyProof**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `claimId?`: `string`; `expired?`: `boolean`; `reason?`: `string`; `signerAddress?`: `string`; `valid`: `boolean`; \}\>\>

#### Parameters

##### params

###### now?

`number`

###### proof

`unknown`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `claimId?`: `string`; `expired?`: `boolean`; `reason?`: `string`; `signerAddress?`: `string`; `valid`: `boolean`; \}\>\>

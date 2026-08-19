# @totemsdk/location-proof

Generic location and movement proof primitives for Totem Edge — device-neutral GPS/GNSS claims, confidence scoring, motion trails, and proof envelope integration.

No hardware drivers. No NMEA serial transport. No phone OS APIs. No network. No storage. Pure claim, scoring, and proof primitives.

## What this package does

`@totemsdk/location-proof` lets any device — drone, car, robot, ship, tractor, phone, gateway, weather station, security device — produce a **verifiable location claim**:

> "This device identity claimed this position, at this time, with this accuracy, under this source context, signed by this key, optionally linked to a nonce challenge, beacon context, movement trail, proofgraph, and other corroborating evidence."

It provides:

- **Location claims** — GNSS/GPS/RTK/cell/Wi-Fi/BLE/LoRaWAN/gateway observations with fix quality, DOP values, satellite count, raw payload hashes, and optional nonce challenges
- **Confidence scoring** — a deterministic 0–100 heuristic over corroborating signals (never a claim of absolute truth)
- **Motion trails** — ordered movement samples with Haversine distances, speed, and impossible-jump detection
- **Proof integration** — create unsigned `attestation` proofs, WOTS-sign them with [`@totemsdk/proof`](https://www.npmjs.com/package/@totemsdk/proof), and verify signed location proofs end to end
- **Proofgraph integration** — helpers that feed location claims and proofs into [`@totemsdk/proofgraph`](https://www.npmjs.com/package/@totemsdk/proofgraph)

## What this package does NOT prove

This package produces verifiable claims, not absolute truth. It does not guarantee a location is true, legally conclusive, or impossible to spoof. A claim is only as strong as its corroboration — evaluate `confidenceScore` and the signals behind it, and never rely on location proofs alone for safety-critical decisions.

Out of scope (intentionally):

- GPS hardware drivers, NMEA serial transport, phone OS location APIs → future `@totemsdk/edge-gnss`
- Geofence and geometry relationship logic → future `@totemsdk/spatial-proof`
- Raster/image proof → future `@totemsdk/raster-proof`
- Map rendering, satellite/raster processing, database storage, network calls, legal claims engines

## Installation

```bash
npm install @totemsdk/location-proof
```

## Package scope

The package supports:

- GNSS / GPS / RTK location claims
- Altitude, heading, speed, accuracy radius, fix quality
- HDOP / VDOP / PDOP where available, satellite count
- Raw payload hash and NMEA payload hash where available
- Timestamp validation and nonce challenge–response
- Operator / device / asset subject IDs and device class metadata
- Movement trail claims and impossible-jump detection
- Weak-network plausibility signals and Wi-Fi / BLE / cell / LoRaWAN / gateway corroboration
- Confidence scoring
- Conversion into `EvidenceRef`, unsigned proof creation, WOTS signing, and signed-proof verification
- Optional helpers for adding location proof references to a proof graph

## API table

### IDs and hashing

| Export | Description |
|--------|-------------|
| `canonicalJson(value)` | Deterministic canonical JSON — recursively sorted keys |
| `toHex(bytes)` | Uint8Array → lowercase hex (no `0x`) |
| `computeLocationClaimId(input)` | Stable claim ID `totem:location:<sha3-256-hex>` |
| `hashLocationClaim(claim)` | SHA3-256 hex of a claim's stable fields |
| `computeMovementTrailId(input)` | Stable trail ID `totem:movement:<sha3-256-hex>` |
| `hashMovementTrail(trail)` | SHA3-256 hex of a trail's stable fields |

### Claims and validation

| Export | Description |
|--------|-------------|
| `createLocationClaim(input)` | Build a claim with a content-derived `claimId` |
| `validateGeoPoint(point)` | Range-check a `GeoPoint` |
| `validateLocationClaim(claim)` | Structural validation of a claim |
| `validateMovementTrail(trail)` | Structural validation of a trail |
| `isChallengeExpired(challenge, now)` | Check a nonce challenge's expiry |

### Confidence scoring

| Export | Description |
|--------|-------------|
| `scoreLocationClaim(claim, options?)` | Deterministic 0–100 confidence score + signals |

### Motion

| Export | Description |
|--------|-------------|
| `distanceMeters(a, b)` | Haversine great-circle distance in meters |
| `computeSpeedMps(a, b)` | Average speed between two samples in m/s |
| `detectImpossibleJumps(samples, options?)` | Flag segments faster than the threshold (default 100 m/s) |
| `createMovementTrail(params)` | Build a trail from samples, deriving start/end/speed/jump flags |

### Proof integration

| Export | Description |
|--------|-------------|
| `locationClaimToEvidenceRef(claim)` | Claim → `EvidenceRef` |
| `movementTrailToEvidenceRef(trail)` | Trail → `EvidenceRef` |
| `createUnsignedLocationProof(params)` | Build an unsigned `attestation` proof |
| `signLocationProof(unsigned, seed, keyIndex)` | WOTS-sign the proof |
| `verifyLocationProof(signed, options?)` | Full end-to-end verification |

### Proofgraph integration

| Export | Description |
|--------|-------------|
| `locationClaimToProofGraphNode(claim)` | Claim → `custom` `ProofGraphNode` |
| `locationProofToGraphEdges(signed)` | Signed proof → `about` / `references` / `supports` edges |
| `addLocationClaimToGraph(graph, claim)` | Immutably add a claim node |
| `addLocationProofToGraph(graph, signed)` | Immutably index a signed proof via `addProof` |

## Type reference

### `LocationSourceType`

```typescript
type LocationSourceType =
  | 'gnss' | 'gps' | 'rtk' | 'cell' | 'wifi' | 'ble'
  | 'lorawan' | 'gateway' | 'network' | 'manual' | 'derived' | 'other';
```

### `LocationClaim`

```typescript
interface LocationClaim {
  claimId: string;                 // totem:location:<sha3-256-hex>
  subjectId: string;               // operator / device / asset being located
  deviceId: string;
  deviceClass?: DeviceClass;
  operatorId?: string;
  observedAt: number;              // ms since epoch
  receivedAt?: number;             // mutable — excluded from claimId
  location: GeoPoint;              // lat, lon, altitudeM?, accuracyM?
  source: LocationSource;
  challenge?: LocationChallenge;   // nonce challenge–response
  corroboration?: LocationCorroboration;
  confidenceScore?: number;        // mutable — excluded from claimId
  uncertainty?: string[];
  metadata?: Record<string, unknown>; // mutable — excluded from claimId
}
```

### `LocationValidationResult`

```typescript
interface LocationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

### `LocationConfidenceResult`

```typescript
interface LocationConfidenceResult {
  score: number;              // 0–100, deterministic
  level: 'none' | 'weak' | 'moderate' | 'strong' | 'high';
  positiveSignals: string[];
  negativeSignals: string[];
}
```

## Usage example — claim → score → proof → sign → verify

```typescript
import {
  createLocationClaim,
  scoreLocationClaim,
  createUnsignedLocationProof,
  signLocationProof,
  verifyLocationProof,
} from '@totemsdk/location-proof';

const claim = createLocationClaim({
  subjectId: 'asset:tractor-042',
  deviceId: 'gps-module-77',
  deviceClass: 'tractor',
  operatorId: 'farm-01',
  observedAt: 1_700_000_000_000,
  location: { lat: 51.5074, lon: -0.1278, altitudeM: 12, accuracyM: 1.5 },
  source: {
    type: 'rtk',
    fixType: 'fixed',
    satellitesUsed: 16,
    hdop: 0.7,
    rawPayloadHash: 'a1b2c3…',
  },
  challenge: {
    nonce: 'server-issued-nonce-1',
    issuedAt: 1_700_000_000_000,
    expiresAt: 1_700_000_060_000,
    verifierId: 'fleet-backend',
  },
  corroboration: { lorawanGateways: ['gw-lon-01'] },
});

const { score, level, positiveSignals, negativeSignals } = scoreLocationClaim(claim);

const unsigned = createUnsignedLocationProof({ claim, issuedAt: claim.observedAt });
const signed = signLocationProof(unsigned, seedBytes, 7); // reserve the WOTS key index first!

const result = verifyLocationProof(signed);
console.log(result.valid, result.claimId);
```

## Movement trail example

```typescript
import { createMovementTrail, detectImpossibleJumps } from '@totemsdk/location-proof';

const trail = createMovementTrail({
  subjectId: 'asset:drone-003',
  deviceId: 'drone-003',
  samples: [
    { observedAt: 1_700_000_000_000, location: { lat: 51.5, lon: -0.1 }, speedMps: 2 },
    { observedAt: 1_700_000_001_000, location: { lat: 51.5001, lon: -0.1 }, speedMps: 2 },
    { observedAt: 1_700_000_002_000, location: { lat: 51.6, lon: -0.1 }, speedMps: 500 },
  ],
});

console.log(trail.impossibleJumpDetected);  // true — the last segment is ~11 km in 1s
console.log(trail.maxComputedSpeedMps);     // ~11,000+
```

## Proofgraph example

```typescript
import { createProofGraph, addProof } from '@totemsdk/proofgraph';
import {
  locationClaimToProofGraphNode,
  addLocationClaimToGraph,
  addLocationProofToGraph,
} from '@totemsdk/location-proof';

let graph = createProofGraph();
graph = addLocationClaimToGraph(graph, claim);          // custom:<claimId> node
graph = addLocationProofToGraph(graph, signed);          // full proof indexing

const node = locationClaimToProofGraphNode(claim);       // standalone node
const edges = locationProofToGraphEdges(signed);         // about / references / supports
```

## Security notes

- **WOTS one-time keys.** Each WOTS key index can be used exactly once. Never sign two different proofs with the same key index. Reserve indices through [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) before signing.
- **Claims are not absolute truth.** Spoofing, jamming, and stale data degrade `confidenceScore` — treat high scores as well-corroborated claims, not guarantees.
- **Nonce challenges** tie a claim to a verifier-issued challenge and can expire; verification rejects expired challenges.
- **Proof verification** recomputes the claim ID, evidence hash, and WOTS signature; anchored records are optional and not required.

## Related packages

- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — SHA3-256, WOTS signing, script derivation
- [`@totemsdk/proof`](https://www.npmjs.com/package/@totemsdk/proof) — proof envelopes, signing, verification
- [`@totemsdk/proofgraph`](https://www.npmjs.com/package/@totemsdk/proofgraph) — content-addressed proof relationship graph
- [`@totemsdk/identity`](https://www.npmjs.com/package/@totemsdk/identity) — device/agent identities
- [`@totemsdk/manifest`](https://www.npmjs.com/package/@totemsdk/manifest) — signed entity declarations
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — one-time key safety
- [`@totemsdk/edge`](https://www.npmjs.com/package/@totemsdk/edge) — unified edge runtime

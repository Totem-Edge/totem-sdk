# @totemsdk/provider-bond

Provider trust layer for Totem Edge — prove, record, score and filter infrastructure providers.

## What provider-bond is

`@totemsdk/provider-bond` is a **small, production-shaped v0.1 provider trust package**. It answers:

- Who is this provider?
- What service do they operate?
- Is their manifest signed?
- Is their manifest bound to an identity?
- What bond do they claim?
- Is there a proof attached?
- What probes/incidents exist?
- What score does the provider have?
- Should a client use this provider under a policy?

## What provider-bond is NOT

- A liquidity pool or LP accounting package
- An Omnia channel/factory/splice execution engine
- A KISSVM covenant enforcement layer
- A live Minima node verifier
- A wallet or key manager
- A transport/networking layer

## Provider-bond vs liquidity-bond

| | provider-bond | liquidity-bond (future) |
|---|---|---|
| **Scope** | Provider trust, identity, reputation | LP deposits, shares, rewards, withdrawals |
| **Bonds** | Declared MINIMA hard collateral | Productive liquidity positions |
| **Scoring** | Identity + bond + reliability + incidents | LP performance, fee generation |
| **Policy** | Provider selection and filtering | Liquidity allocation and routing |

`liquidityBondRefs` are string references to a future `@totemsdk/liquidity-bond` package. They do not count as collateral in v0.1.

## MINIMA-first provider trust model

- `MINIMA` is the default hard-collateral and bond asset
- `TOTEM` cannot satisfy MINIMA hard-collateral policy
- `TOTEM` may satisfy service-level or reputation policies only if explicitly accepted
- Other tokens cannot satisfy MINIMA hard-collateral policy unless explicitly accepted
- Liquidity references do not count as bond collateral in v0.1

## Manifest compatibility

Provider-bond wraps `@totemsdk/manifest` `EdgeServiceManifest` + `SignedManifest<T>`. Provider-bond-specific fields (bondId, bondStack, bondProofs, score, incidentSummary) go in a `ProviderBondExtension` metadata block.

## Identity binding

Provider-bond uses `@totemsdk/identity` to cryptographically bind provider manifests to identity documents. The verification flow is layered:

1. Verify the base `SignedManifest` via `@totemsdk/manifest`
2. Verify the manifest signer is authorised by the claimed identity via `@totemsdk/identity`
3. Verify the provider-bond extension hash matches
4. Verify all claimed operational addresses (bond owner, recovery, probe signer, incident signer, score signer) are authorised by the identity

## Bond proof attachment

Bond proofs are attached as `BondProofRef` records. MVP supports:

- `manual` — structurally valid declarations
- `declared` — structurally valid declarations
- `visible-balance` — requires a verifier
- `totem-proof` — uses `@totemsdk/proof`
- `future-live-chain` — returns `REQUIRES_LIVE_VERIFIER` unless verifier supplied

## Probe and incident records

Probes track provider health: heartbeat, endpoint, latency, service-capability, bond-proof-freshness, manual-observation.

Incidents track provider issues: downtime, high-latency, failed-probe, invalid-response, invalid-bond-proof, manual-dispute. Incidents can be acknowledged, resolved, or rejected.

## Provider scoring

Scores are computed deterministically from four components:

- **Identity** (25%) — is an identity address declared?
- **Bond** (30%) — is there an active MINIMA hard-collateral bond with proof?
- **Reliability** (30%) — probe success rate and latency
- **Incidents** (15%) — open, critical, and high-severity incidents

Recommendations: `recommended` (80+), `acceptable` (60+), `risky` (40+), `avoid` (20+), `unbonded`, `offline`.

## Policy filtering

Policies filter providers by: service type, minimum score, identity requirement, active bond requirement, MINIMA hard collateral requirement, minimum bond amount, accepted assets/purposes, maximum incident severity, and maximum heartbeat age.

## Pear/Bare compatibility

The package is runtime-neutral. It avoids `node:crypto`, `fs`, `path`, `net`, `http`, `https`, `child_process`, DOM APIs, hidden `Date.now()`, hidden randomness, and side effects at module import time. It uses `Uint8Array`, injected `now`/`height`, pure functions, and deterministic serialization.

## Examples

### Create provider manifest

```ts
import { createProviderBondManifest } from '@totemsdk/provider-bond';

const manifest = createProviderBondManifest({
  edgeService: {
    type: 'edge-service',
    serviceId: 'my-lookup-node',
    name: 'My Lookup Node',
    version: '1.0.0',
    operatorAddress: 'MxRoot...',
    serviceType: 'lookup-provider',
    description: 'Personal lookup node',
    capabilities: ['lookup'],
    tags: ['production'],
  },
  providerBond: {
    providerId: 'prov-001',
    bondOwnerAddress: 'MxRoot...',
    bondStack: [{
      bondId: 'bond-001',
      asset: 'MINIMA',
      amount: 100000n,
      purpose: 'hard-collateral',
      lockType: 'manual-attestation',
      status: 'active',
    }],
  },
});
```

### Verify provider manifest

```ts
import { verifyProviderBondManifest } from '@totemsdk/provider-bond';

const result = verifyProviderBondManifest({ manifest, now: Date.now() });
if (!result.ok) {
  console.error(result.code, result.reason);
}
```

### Attach MINIMA bond proof

```ts
import { attachBondProof } from '@totemsdk/provider-bond';

let state = createEmptyProviderBondRegistryState();
state = registerProvider(state, manifest);
state = attachBondProof(state, 'prov-001', {
  proofId: 'proof-001',
  bondId: 'bond-001',
  providerId: 'prov-001',
  proofType: 'manual',
  asset: 'MINIMA',
  amount: 100000n,
});
```

### Record heartbeat

```ts
import { recordHeartbeat, recordProviderProbe } from '@totemsdk/provider-bond';

const probe = recordHeartbeat('prov-001');
state = recordProviderProbe(state, 'prov-001', probe);
```

### Record incident

```ts
import { recordIncident, recordProviderIncident } from '@totemsdk/provider-bond';

const incident = recordIncident({
  providerId: 'prov-001',
  type: 'downtime',
  severity: 'high',
});
state = recordProviderIncident(state, 'prov-001', incident);
```

### Compute score

```ts
import { computeProviderScore, updateProviderScore } from '@totemsdk/provider-bond';

const score = computeProviderScore({
  provider: manifest,
  bondProofs: state.bondProofs['prov-001'],
  probes: state.probes['prov-001'],
  incidents: state.incidents['prov-001'],
});
state = updateProviderScore(state, 'prov-001', score);
console.log(score.recommendation); // 'recommended'
```

### Filter providers by policy

```ts
import { filterProvidersByPolicy } from '@totemsdk/provider-bond';

const matches = filterProvidersByPolicy(state, {
  requireMinimaHardCollateral: true,
  minScore: 60,
  maxIncidentSeverity: 'medium',
});
const passing = matches.filter(m => m.matched);
```

### Serialize registry state

```ts
import { serializeProviderBondState, parseProviderBondState } from '@totemsdk/provider-bond';

const json = serializeProviderBondState(state);
const restored = parseProviderBondState(json);
```

## Security limitations

- MVP does not verify live Minima chain state
- Manual and declared proofs are structurally validated only
- No automatic slashing or penalty execution
- No custody of funds or private key management
- Identity binding requires an identity graph to be supplied

## Roadmap

- `@totemsdk/liquidity-bond` — LP deposits, shares, rewards, withdrawals
- KISSVM bond covenant enforcement
- MAST branch descriptors for bond scripts
- Live chain-provider integration for bond verification
- Omnia channel/factory liquidity integration
- Transport layer for provider announcements and queries
- TOTEM service-level bond support
- DAO governance integration

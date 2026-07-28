# KISSVM Guide: MAST, Policy Infrastructure & Templates

This guide covers the MAST compilation, policy tree, proof chain, layered policy, PREVSTATE workflow, and template generators — everything in `src/mast/` and `src/templates/`.

## MAST Compiler

Build Minima-compatible MMR Merkle trees from KISSVM scripts.

```typescript
import { compileMastTree, verifyScriptMembership } from '@totemsdk/kissvm';

const scripts = [
  'RETURN SIGNEDBY(0xABC)',
  'ASSERT @BLOCK GT 1000 RETURN TRUE',
];
const mast = compileMastTree(scripts);
// { rootAddress: 'Mx...', rootHex: '0x...', scripts: [{ script, proofHex, address }] }

const result = verifyScriptMembership('RETURN SIGNEDBY(0xABC)', proofHex, mast.rootHex);
// { valid: true }
```

The compiler uses byte-exact MMR primitives matching Minima's Java implementation (MMRSet.getMMRRoot, Address.java). Peak bagging uses iterative adjacent-pairing.

## Policy Tree

Hierarchical governance structures where each node authorizes scripts and may delegate to children.

```typescript
import { buildPolicyTree, findPolicyNode, getPolicyPath } from '@totemsdk/kissvm';

const tree = buildPolicyTree([
  { id: 'root', name: 'National', script: 'RETURN TRUE' },
  { id: 'regional', name: 'Regional', script: 'ASSERT SIGNEDBY(STATE(0)) RETURN TRUE', parentId: 'root' },
]);
// { root: PolicyNode, nodeMap: Map, depth: 2, nodeCount: 2 }
```

## Proof Chain

Multi-level recursive MAST verification — each link proves script authorization via MMR proof.

```typescript
import { buildProofChain, verifyProofChain } from '@totemsdk/kissvm';

const chain = buildProofChain([
  { scriptHash, policyRoot, proof, script, label: 'Level 1' },
  { scriptHash, policyRoot, proof, script, label: 'Level 2' },
]);

const result = verifyProofChain(chain, expectedLeafHash);
// { valid: true, chain }
```

Also produces Minima PROOF expressions for on-chain verification.

## PREVSTATE Workflows

State transition workflows using Minima's PREVSTATE opcode.

```typescript
import { buildPrevStateWorkflow, counterWorkflow, vestingWorkflow, timelockWorkflow } from '@totemsdk/kissvm';

const counter = counterWorkflow(0, 100); // Counter at port 0, max 100
const vesting = vestingWorkflow(1, 2, 3, beneficiaryPkd);
const timelock = timelockWorkflow(4, ownerPkd);
```

## Layered Policy

Compose a 7-layer authority chain (Asset → Manufacturer → Product → Regulatory → Owner → Site → Operator) via nested MAST delegation.

```typescript
import { buildLayeredPolicy, buildLayerSubset, STANDARD_LAYERS } from '@totemsdk/kissvm';
import { manufacturerLayer, regulatoryLayer, ownerLayer, siteLayer, operatorLayer } from '@totemsdk/kissvm';

const { tree, proofChain, mastScript } = buildLayeredPolicy({
  assetId: 'robot-arm-001',
  assetName: 'Robot Arm',
  layers: [
    manufacturerLayer(mfgPkd, 'Robot Corp', { modelId: 'RA-100' }),
    regulatoryLayer(regPkd, 'EU', 'Machinery Directive', { expiryBlock: 500000 }),
    ownerLayer(ownerPkd, 'Factory GmbH'),
    siteLayer(sitePkd, 'Plant A', { safetyZone: 'Zone-5' }),
    operatorLayer(opPkd, 'Technician'),
  ],
});
```

## Policy Anchor Coin

An on-chain UTXO whose locking script commits to policy roots with explicit branches for normal action, root rotation, epoch advancement, recovery, and emergency.

```typescript
import { buildPolicyAnchorScript, buildPolicyAnchorState, buildRootRotationScript } from '@totemsdk/kissvm';

const script = buildPolicyAnchorScript({
  subjectId: 'device-001',
  subjectType: 'vehicle',
  institutionalRoot: '0x...',
  initialEpoch: 1,
  ports: { regulatorRoot: 10, ownerRoot: 11, /* ... */ },
});
```

## Templates (EXPERIMENTAL)

Ready-to-use KISSVM script generators for common workflows. All templates share a warning: **not audited — do not use in production without independent security review**.

### Access patterns by sector

| Template | Use cases |
|----------|-----------|
| `commercial/` | MaaS, pay-per-use, warranty, escrow, leasing, insurance, V2G |
| `compliance/` | Multi-stage verification pipeline (schema → issuer → revocation → attribute) |
| `data-privacy/` | Consent, GDPR, data portability, ZK-proof integration, escrow |
| `device-lifecycle/` | Commissioning, transfer, key rotation, decommissioning, remote support |
| `energy/` | REC trading, microgrid, P2P energy, demand response, net metering |
| `firmware-update/` | Authorized firmware updates with rollback protection |
| `healthcare/` | Medical device regulation, patient consent, clinical trials |
| `layers/` | Standard 7-layer policy chain (asset, manufacturer, product, regulatory, owner, site, operator, emergency) |
| `legal/` | Notarization, timestamp, smart contract execution, power of attorney, multi-jurisdiction |
| `payment-channel/` | Channel state transitions with authorization |
| `recovery/` | Threshold recovery, epoch rotation, delegated credentials, succession |
| `rwa-lifecycle/` | Tokenization, fractionalization, audit, distribution, share transfer, redemption |
| `sensor-proof/` | Authenticate sensor readings from authorized devices |
| `state-machine/` | Device state transitions (on/off, HVAC, production line, robot arm) |
| `supply-chain/` | Provenance, cold chain, bill of lading, customs clearance |
| `treasury/` | Multi-sig treasury, budget allocation, timelocked reserves, streaming payments |
| `voting/` | Weighted, liquid democracy, quadratic voting, election verification |

### Example: firmware update

```typescript
import { buildFirmwareUpdateScript } from '@totemsdk/kissvm';

const script = buildFirmwareUpdateScript({
  versionPort: 0,
  hashPort: 1,
  manufacturerPort: 2,
  manufacturerPkd: '0xABC...',
  ownerPkd: '0xDEF...',
  policyRoot: '0x...',
  updateProof: '0x...',
});
```

### Composing with the VM

Templates produce KISSVM script strings. Evaluate them with `evaluateScript`:

```typescript
import { evaluateScript, buildWitness } from '@totemsdk/kissvm';

const script = buildSensorProofScript(config);
const witness = buildWitness([{ pubkeyHex: devicePkd, signature }]);
const ctx = { block: 1000, /* ... */ };
const result = evaluateScript(script, witness, ctx);
```

## Architecture

```
src/
├── index.ts           ← package entry (re-exports everything)
├── eval.ts, parser.ts, vm.ts, ...  ← KISSVM evaluator
│
├── mast/              ← MAST infrastructure
│   ├── types.ts
│   ├── mast-compiler.ts
│   ├── policy-tree.ts
│   ├── proof-chain.ts
│   ├── layered-policy.ts
│   ├── policy-anchor.ts
│   └── prevstate.ts
│
└── templates/         ← Script generators (EXPERIMENTAL)
    ├── commercial.ts
    ├── compliance.ts
    ├── data-privacy.ts
    ├── device-lifecycle.ts
    ├── energy.ts
    ├── firmware-update.ts
    ├── healthcare.ts
    ├── layers.ts
    ├── legal.ts
    ├── payment-channel.ts
    ├── recovery.ts
    ├── rwa-lifecycle.ts
    ├── sensor-proof.ts
    ├── state-machine.ts
    ├── supply-chain.ts
    ├── treasury.ts
    └── voting.ts
```

## Migration from @totemsdk/recursive-mast

These modules were previously in `@totemsdk/recursive-mast` and moved to `@totemsdk/kissvm` in v0.4. All imports still work through re-exports — no code changes needed.

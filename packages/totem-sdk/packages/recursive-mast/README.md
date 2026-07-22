# @totemsdk/recursive-mast

Policy coordination library for composable, multi-party, cryptographically provable governance on Minima KISSVM.

**Status: Alpha.** The architecture, storage, discovery, signing coordination, and availability auditing are implemented. Templates are experimental and not audited. This package coordinates policy; `@totemsdk/omnia` owns channel state, dispute, and settlement semantics.

> **v0.4+ migration:** The MAST compiler, policy tree, proof chain, layered policy, policy anchor, PREVSTATE workflows, and script templates have moved to [`@totemsdk/kissvm`](https://www.npmjs.com/package/@totemsdk/kissvm) (see [`GUIDE.md`](https://github.com/totem-sdk/totem-sdk/blob/main/packages/totem-sdk/packages/kissvm/src/GUIDE.md)). They are re-exported here for backward compatibility — no code changes needed. New projects should import directly from `@totemsdk/kissvm`.

## Architecture

Recursive MAST separates **data integrity** (on-chain commitments) from **data availability** (off-chain storage). Minima stores the commitment; policy repositories store the corpus.

```
Minima transaction / anchor coin
└── policy root + version + manifest commitment

Lookup network
└── tells participants where policy material can be retrieved

Policy repositories
└── store scripts, subtrees, proofs, manifests and recovery packages

Execution transaction
└── includes only the selected scripts and proofs
```

### What lives on Minima

- The current policy root
- The policy epoch/version
- A hash of the policy manifest
- State identifying the subject (vehicle, device, site)
- Rules governing root replacement
- The selected scripts and proofs when a branch is exercised

### What lives off-chain

- Policy manifest (actions, roles, endpoints)
- Root tree metadata
- Script leaves and MMR proofs
- Nested subtree references
- Action schemas and role definitions
- Signing instructions and identity references
- Recovery procedures
- Previous policy versions
- Audit and simulation records

### Federated storage model

Each authority publishes and maintains the material behind its own root:

```
OEM repository          → firmware-release subtree
Regulator repository    → jurisdiction-approval subtree
Fleet-owner repository → owner authorization subtree
Workshop repository     → licensed-workshop subtree
Professional body      → technician-credential subtree
```

When a firmware update is requested, the coordinator retrieves one branch package from each relevant authority. The entire global policy corpus is never assembled into the transaction.

### Corrected stack

```
recursive-mast     → defines and coordinates policy
       ↓
kissvm             → parses, verifies and simulates policy execution
       ↓
tx-builder         → constructs the exact Minima transaction
       ↓
connect / txpow    → submits and confirms it
```

## Install

```bash
npm install @totemsdk/recursive-mast
```

## Subpath exports

| Path | Purpose |
|------|---------|
| `@totemsdk/recursive-mast` | Core policy coordination |
| `@totemsdk/recursive-mast/kissvm` | KISSVM integration (script validation, witness materialization, simulation) |
| `@totemsdk/recursive-mast/transaction` | Transaction planning (anchor, action, rotation) |
| `@totemsdk/recursive-mast/templates/*` | Experimental KISSVM script templates (re-exported from `@totemsdk/kissvm/templates/*`) |

## Core modules

### MAST Compiler

> **v0.4+:** Now in `@totemsdk/kissvm`. Re-exported here for backward compat.

Canonical Minima-compatible MMR compiler. Produces byte-exact ScriptProofs, MMR roots, and script addresses using the core package's `mmrLeafExact`, `createMMRDataParentNode`, `parseMMRProofFromHex`, `calculateProofRoot`, and `serializeMMRProof`. Handles arbitrary leaf counts (not just powers of 2).

```ts
import { compileMastTree, verifyScriptMembership } from '@totemsdk/kissvm';
// Legacy: import { compileMastTree, verifyScriptMembership } from '@totemsdk/recursive-mast';

const compiled = compileMastTree([
  'RETURN TRUE',
  'ASSERT SIGNEDBY(0xABCD) RETURN TRUE',
  'ASSERT @BLOCK GTE 1000 RETURN TRUE',
]);

// compiled.rootHex — the MMR root
// compiled.rootAddress — the Mx address
// compiled.scripts[i].script — exact script text
// compiled.scripts[i].proofHex — serialized MMR proof
// compiled.scripts[i].address — script's Mx address

const result = verifyScriptMembership(
  compiled.scripts[0].script,
  compiled.scripts[0].proofHex,
  compiled.rootHex,
);
// { valid: true }
```

| Export | Description |
|--------|-------------|
| `compileMastTree(scripts)` | Compile scripts into a canonical MAST tree with MMR proofs |
| `compilePolicyGraph(policy)` | Compile a logical policy graph into compiled MAST nodes |
| `verifyScriptMembership(script, proofHex, expectedRoot)` | Verify a script's MMR proof against a root |
| `computeCanonicalScriptHash(script)` | Compute the canonical MMR leaf hash of a script |
| `computeCanonicalScriptAddress(script)` | Compute the Mx address of a script |

**Types:** `MinimaScriptProof`, `CompiledMast`, `CompiledPolicyNode`, `PolicyGraph`, `PolicyGraphNode`, `PolicyDelegationEdge`, `CompiledRecursivePolicy`

### Policy tree

> **v0.4+:** Now in `@totemsdk/kissvm`. Re-exported here for backward compat.

Builds hierarchical governance structures. Each node is a policy root that authorizes scripts and may delegate to child policy roots.

```ts
import { buildPolicyTree, findPolicyNode, getPolicyPath, getPolicyLeaves } from '@totemsdk/kissvm';
// Legacy: import { buildPolicyTree, findPolicyNode, getPolicyPath, getPolicyLeaves } from '@totemsdk/recursive-mast';

const tree = buildPolicyTree([
  { id: 'national', name: 'National Authority', script: 'RETURN TRUE' },
  { id: 'regional', name: 'Regional Office', script: 'ASSERT SIGNEDBY(STATE(0)) RETURN TRUE', parentId: 'national' },
  { id: 'local', name: 'Local Branch', script: 'ASSERT SIGNEDBY(PREVSTATE(0)) RETURN TRUE', parentId: 'regional' },
]);

const node = findPolicyNode(tree, 'regional');
const path = getPolicyPath(tree, 'local');   // [national, regional, local]
const leaves = getPolicyLeaves(tree);         // [local]
```

| Export | Description |
|--------|-------------|
| `buildPolicyTree(nodes)` | Build a policy tree from a flat list of nodes |
| `findPolicyNode(tree, id)` | Find a policy node by ID |
| `getPolicyPath(tree, targetId)` | Get the path from root to a specific node |
| `getPolicyLeaves(tree)` | Get all leaf nodes |

### Proof chain

> **v0.4+:** Now in `@totemsdk/kissvm`. Re-exported here for backward compat.

Constructs and verifies multi-level nested MAST proof chains.

```ts
import { buildProofChain, verifyProofChain, toNestedMastScript } from '@totemsdk/kissvm';
// Legacy: import { buildProofChain, verifyProofChain, toNestedMastScript } from '@totemsdk/recursive-mast';

const chain = buildProofChain([
  { scriptHash: '0x...', policyRoot: '0x...', proof: '0x...', script: '...', label: 'National' },
  { scriptHash: '0x...', policyRoot: '0x...', proof: '0x...', script: '...', label: 'Regional' },
]);

const result = verifyProofChain(chain);
// { valid: true, chain }

const script = toNestedMastScript(chain);
// KISSVM script with nested MAST expressions
```

| Export | Description |
|--------|-------------|
| `buildProofChain(links)` | Build a proof chain from an ordered list of proof links |
| `verifyProofChain(chain, expectedLeafScriptHash?)` | Verify a complete proof chain using canonical MMR verification |
| `toMinimaProofExpression(link)` | Generate canonical 5-argument PROOF expression |
| `toNestedMastScript(chain)` | Generate full nested MAST KISSVM script |

### PREVSTATE workflows

> **v0.4+:** Now in `@totemsdk/kissvm`. Re-exported here for backward compat.

Constructs state transition workflows.

```ts
import { counterWorkflow, vestingWorkflow, timelockWorkflow } from '@totemsdk/kissvm';
// Legacy: import { counterWorkflow, vestingWorkflow, timelockWorkflow } from '@totemsdk/recursive-mast';

const counter = counterWorkflow(0, 1000);
const vesting = vestingWorkflow(0, 1, 2, '0xABCD...');
const timelock = timelockWorkflow(0, '0xABCD...');
```

| Export | Description |
|--------|-------------|
| `buildStateTransition(port, name, currentValue, previousValue, transition)` | Build a single state transition |
| `buildPrevStateWorkflow(id, name, transitions, additionalScript?)` | Build a complete PREVSTATE workflow |
| `counterWorkflow(port, maxValue?)` | Counter that increments on each transaction |
| `vestingWorkflow(startPort, totalPort, claimedPort, beneficiaryPk)` | Vesting schedule with block-based cliff |
| `roundBasedWorkflow(roundPort, pk1, pk2)` | Round-based game or voting system |
| `timelockWorkflow(lockPort, ownerPk)` | Time-locked withdrawal |

### Delegation chain (`delegation.ts`)

Constructs and verifies authority delegation chains.

```ts
import { buildDelegationLink, buildDelegationChain, verifyDelegationChain } from '@totemsdk/recursive-mast';

const chain = buildDelegationChain([
  buildDelegationLink(adminPkd, supervisorPkd, adminRoot, adminProof, { scopes: ['admin'] }, 0),
  buildDelegationLink(supervisorPkd, operatorPkd, supervisorRoot, supervisorProof, { scopes: ['read', 'write'] }, 1),
]);

const result = verifyDelegationChain(chain);
```

| Export | Description |
|--------|-------------|
| `buildDelegationLink(delegator, delegate, policyRoot, proof, constraints?, sequence?)` | Build a single delegation link |
| `buildDelegationScript(delegator, delegate, constraints?)` | Build the KISSVM delegation script |
| `buildDelegationChain(links)` | Build a complete delegation chain |
| `verifyDelegationChain(chain)` | Verify chain continuity and script hash integrity |
| `toDelegationChainScript(chain)` | Generate full nested MAST script |

### Cross-domain trust (`cross-domain.ts`)

Enables one policy space to accept proofs from another.

```ts
import { buildCrossDomainBridge, buildBidirectionalBridge, buildTrustNetwork } from '@totemsdk/recursive-mast';

const bridge = buildCrossDomainBridge(
  'jurisdiction-a', 'jurisdiction-b',
  localRoot, foreignRoot, acceptanceProof,
  { maxDepth: 3, requiredAttributes: ['name', 'jurisdiction'] },
);

const [aToB, bToA] = buildBidirectionalBridge('domainA', 'domainB', rootA, rootB, proofAB, proofBA);
const network = buildTrustNetwork([bridge1, bridge2, bridge3]);
```

| Export | Description |
|--------|-------------|
| `buildCrossDomainBridge(sourceDomain, targetDomain, sourcePolicyRoot, targetPolicyRoot, acceptanceProof, constraints?)` | Build a cross-domain trust bridge |
| `buildAcceptanceScript(targetDomain, targetPolicyRoot, constraints?)` | Build the KISSVM acceptance script |
| `buildBidirectionalBridge(...)` | Build mutual recognition between two domains |
| `buildTrustNetwork(bridges)` | Build a trust network and check connectivity |

### Migration path (`migration.ts`)

Builds upgradeable policy systems with transition windows.

```ts
import { buildMigrationStep, buildMigrationPath, getActivePolicyRoot } from '@totemsdk/recursive-mast';

const path = buildMigrationPath([
  buildMigrationStep(oldRoot, newRoot, activationBlock, deprecationBlock, proof),
]);

const currentRoot = getActivePolicyRoot(path, currentBlock);
```

| Export | Description |
|--------|-------------|
| `buildMigrationStep(fromPolicyRoot, toPolicyRoot, activationBlock, deprecationBlock, proof)` | Build a single migration step |
| `buildMigrationScript(...)` | Build the KISSVM migration script with transition window |
| `buildMigrationPath(steps)` | Build a complete migration path |
| `isMigrationActive(step, currentBlock)` | Check if a migration step is in its transition window |
| `isMigrationComplete(step, currentBlock)` | Check if old policy is fully deprecated |
| `getActivePolicyRoot(path, currentBlock)` | Get the active policy root at a given block height |
| `toMigrationPathScript(path)` | Generate full nested MAST script |

### Layered policy

> **v0.4+:** Now in `@totemsdk/kissvm`. Re-exported here for backward compat.

Composes the standard 7-layer policy chain from reusable layer templates.

```
Asset root → Manufacturer → Product/model → Regulatory → Owner/fleet → Site → Operator → Action
```

```ts
import { buildLayeredPolicy, buildLayerSubset, STANDARD_LAYERS } from '@totemsdk/kissvm';
// Legacy: import { buildLayeredPolicy, buildLayerSubset, STANDARD_LAYERS } from '@totemsdk/recursive-mast';

const { tree, proofChain, mastScript } = buildLayeredPolicy({
  assetId: 'robot-arm-001',
  assetName: 'Robot Arm',
  layers: [
    { id: 'manufacturer', name: 'Robot Corp', script: mfgScript, authorityPkd: mfgPk },
    { id: 'regulatory', name: 'EU Machinery Directive', script: regScript, authorityPkd: regPk },
    { id: 'owner', name: 'Factory GmbH', script: ownerScript, authorityPkd: ownerPk },
    { id: 'operator', name: 'Technician', script: opScript, authorityPkd: opPk },
  ],
});

const { tree: subsetTree } = buildLayerSubset(config, ['manufacturer', 'owner', 'operator']);
```

| Export | Description |
|--------|-------------|
| `buildLayeredPolicy(config)` | Build a layered policy tree, proof chain, and MAST script |
| `buildLayeredMastScript(config)` | Build the nested MAST KISSVM script |
| `buildLayerSubset(config, include)` | Build a subset of layers |
| `STANDARD_LAYERS` | `ASSET`, `MANUFACTURER`, `PRODUCT`, `REGULATORY`, `OWNER`, `SITE`, `OPERATOR` |

### Policy Anchor Coin

> **v0.4+:** Now in `@totemsdk/kissvm`. Re-exported here for backward compat.

A stable on-chain UTXO with explicit branches for normal action, root rotation, epoch advancement, recovery, and emergency. Every branch enforces the complete successor anchor.

```ts
import { buildPolicyAnchorScript, buildPolicyAnchorState, buildRootRotationScript, buildEpochAdvancementScript } from '@totemsdk/kissvm';
// Legacy: import { buildPolicyAnchorScript, buildPolicyAnchorState, buildRootRotationScript, buildEpochAdvancementScript } from '@totemsdk/recursive-mast';

const config: PolicyAnchorConfig = {
  subjectId: 'VIN-123',
  subjectType: 'vehicle',
  institutionalRoot: '0x...',
  initialEpoch: 1,
  ports: {
    regulatorRoot: 10, ownerRoot: 11, serviceProviderRoot: 12,
    firmwareApprovalRoot: 13, epoch: 14, manifestHash: 15,
    recoveryRoot: 16, emergencyRoot: 17, actionRoot: 18,
  },
  recoveryRoot: '0x...',
  emergencyRoot: '0x...',
};

const script = buildPolicyAnchorScript(config);
const state = buildPolicyAnchorState(config, {
  regulatorRoot: '0x...', ownerRoot: '0x...',
  serviceProviderRoot: '0x...', firmwareApprovalRoot: '0x...',
  manifestHash: '0x...',
});

const rotationScript = buildRootRotationScript(10, newRegulatorRoot, authorizerPkd, 'Annual regulator update');
const epochScript = buildEpochAdvancementScript(config, 2, authorizerPkd);
```

| Export | Description |
|--------|-------------|
| `buildPolicyAnchorScript(config)` | Build the KISSVM locking script with 5 explicit branches |
| `buildPolicyAnchorState(config, initialRoots)` | Generate initial state values |
| `buildRootRotationScript(port, newRoot, authorizerPkd, reason)` | Build script for rotating a specific role root |
| `buildEpochAdvancementScript(config, newEpoch, authorizerPkd)` | Build script for epoch advancement |

### Policy Manifest (`policy-manifest.ts`)

Signed metadata describing a recursive MAST policy. The manifest is the discoverable counterpart to an on-chain policy root.

```ts
import { computePolicyPackageHash, signPolicyManifest, splitPolicyManifest } from '@totemsdk/recursive-mast';

const manifest: RecursiveMastPolicyManifest = {
  policyId: 'vehicle-policy-v1',
  policyRoot: '0xA72...',
  anchorAddress: '0x...',
  version: 1, epoch: 18,
  status: 'active',
  subject: { type: 'vehicle', id: 'VIN-123' },
  actions: [{
    action: 'firmware.install',
    description: 'Install a firmware update',
    inputs: { version: 'string', hash: 'string' },
    requiredRoles: ['oem-release-authority', 'vehicle-owner'],
    executionRoot: '0x...',
    requestEndpoint: 'hyperswarm://firmware-signing',
    expirySeconds: 300,
  }],
  roles: [{
    role: 'oem-release-authority',
    description: 'OEM firmware release authority',
    currentRoot: '0x...',
    federated: true, persistent: true,
  }],
  endpoints: [
    { id: 'signing', transport: 'hyperswarm', address: 'firmware-signing', purpose: 'signing' },
    { id: 'discovery', transport: 'https', address: 'https://policies.oem.example/', purpose: 'discovery' },
  ],
  policyPackageHash: '0x...',
  validFrom: 1000000,
};

const signed = await signPolicyManifest(manifest, signFn, authorityPkd);
const { public_, restricted } = splitPolicyManifest(signed, ['0x...']);
```

| Export | Description |
|--------|-------------|
| `computePolicyPackageHash(scripts, proofs, metadata)` | SHA3-256 of all scripts + proofs + metadata |
| `signPolicyManifest(manifest, signFn, authorityPkd)` | Sign a policy manifest |
| `splitPolicyManifest(manifest, branchHashes)` | Split into public and restricted components |

### Policy Signing (`policy-signing.ts`)

Signing request/response envelopes and witness assembly. The coordinator is not trusted — every signer independently verifies the transaction before signing.

```ts
import { createSigningRequest, createSigningResponse, collectSigningResponses, buildRecursiveWitnessPlan, verifySigningRequest } from '@totemsdk/recursive-mast';

const request = await createSigningRequest({
  policyId: 'vehicle-policy-v1',
  policyVersion: 1, policyEpoch: 18,
  action: 'firmware.install',
  subjectId: 'VIN-123',
  requestedRole: 'oem-release-authority',
  transactionDigest: '0x...',
  transactionTemplate: txBytes,
  selectedPath: { roots: ['0x...'], action: 'firmware.install', executionRoot: '0x...' },
  disclosedScripts: [{ scriptHash: '0x...', script: '...', mmrProof: '0x...' }],
  evidence: [],
  expectedInputs: [{ coinId: '0x...', address: '0x...', amount: '100' }],
  expectedOutputs: [{ address: '0x...', amount: '100', state: { 0: 'VIN-123' } }],
  replyEndpoint: 'hyperswarm://firmware-signing',
  requesterIdentity: identityClaim,
  expirySeconds: 300,
}, requesterSignFn);

// Signer verifies before signing
const verification = verifySigningRequest(request, {
  currentEpoch: 18,
  trustRequester: true,
  now: Date.now(),
  transactionDigestVerifier: (template, digest) => {
    // Recompute digest from template and compare
    return computeDigest(template) === digest;
  },
  anchorCoin: { coinId: '0x...', policyRoot: '0x...', epoch: 18, manifestHash: '0x...' },
  policyManifest: { policyRoot: '0x...', version: 1, epoch: 18, actions: [...] },
  branchVerifier: (scriptHash, policyRoot) => verifyScriptMembership(script, proof, policyRoot).valid,
  replayStore: myReplayStore,
});
// { valid: true/false, checks: {...}, errors: [...] }

const response = createSigningResponse({
  requestId: request.requestId,
  status: 'approved',
  signerIdentityId: 'oem-identity-1',
  actingAddress: '0x...',
  role: 'oem-release-authority',
  signature: '0x...',
  identityProof: identityClaim,
});
// response.responseId — unique per-response ID

const result = collectSigningResponses(
  ['oem-release-authority', 'vehicle-owner'],
  [response],
  { requestId: request.requestId },
);
// { complete: false, signatures: {...}, approved: [...], pending: ['vehicle-owner'], errors: [] }

const witnessPlan = buildRecursiveWitnessPlan(selectedPath, disclosedScripts, collectedSignatures);
// Use materializeRecursiveWitness() from @totemsdk/recursive-mast/kissvm to produce canonical ScriptWitness
```

| Export | Description |
|--------|-------------|
| `createSigningRequest(config, requesterSignFn)` | Create a canonical signing request. Requester signature covers template hash, script hashes, evidence hashes, and reply endpoint. |
| `createSigningResponse(config)` | Create a signing response with unique per-response ID |
| `collectSigningResponses(requiredRoles, responses, options?)` | Collect responses with dedup by responseKey, cross-request validation, one-signer-multiple-roles prevention |
| `buildRecursiveWitnessPlan(selectedPath, disclosedScripts, collectedSignatures)` | Build a witness plan (mastBranches + signatures) |
| `verifySigningRequest(request, options)` | Verify a signing request with detailed report |

**Key types:** `PolicySigningRequest`, `PolicySigningResponse` (includes `responseId`), `PolicyPathDescriptor`, `ScriptDisclosure`, `SignedEvidence`, `SignedIdentityClaim`, `ExpectedInput`, `ExpectedOutput`, `SigningRoundResult`, `SigningRequestVerificationOptions`, `SigningRequestVerificationReport`

### Signing Session (`signing-session.ts`)

State machine for multi-party policy transaction coordination. Progresses through: `draft → resolving → awaiting-evidence → awaiting-signatures → ready → submitted → confirmed`.

```ts
import { createSigningSession, acceptResponse, recordEvidence, submitSession, confirmSession, sessionSummary } from '@totemsdk/recursive-mast';

const session = createSigningSession({
  policyId: 'vehicle-policy-v1',
  policyVersion: 1, policyEpoch: 18,
  action: 'firmware.install',
  transactionDigest: '0x...',
  requiredRoles: ['oem-release-authority', 'vehicle-owner'],
  optionalRoles: ['fleet-operator'],
  requiredEvidence: [
    { evidenceId: 'work-order', type: 'maintenance-record' },
    { evidenceId: 'firmware-hash', type: 'binary-hash' },
  ],
  expirySeconds: 600,
});

const updated = acceptResponse(session, oemResponse);
const withEvidence = recordEvidence(updated, workOrderEvidence);
const summary = sessionSummary(withEvidence);
// { status: 'awaiting-signatures', signedCount: 1, requiredCount: 2, evidenceCollected: 1, evidenceRequired: 2, pendingRoles: ['vehicle-owner'], remainingEvidence: ['firmware-hash'] }

// A session with missing required evidence will never become 'ready'
const ready = advanceSession(withEvidence);
const submitted = submitSession(ready);
const confirmed = confirmSession(submitted, {
  txpowId: '0x...',
  inclusionProof: '0x...',
  confirmedBlock: 1000000,
});
// confirmSession validates: status must be 'submitted', txpowId must be non-empty, block must be non-negative
```

| Export | Description |
|--------|-------------|
| `createSigningSession(config)` | Create a new signing session |
| `advanceSession(session)` | Transition to the next appropriate status |
| `acceptResponse(session, response)` | Accept a signing response and advance |
| `recordEvidence(session, evidence)` | Record evidence collection and advance |
| `submitSession(session)` | Mark as submitted (must be `ready`) |
| `confirmSession(session, confirmation)` | Mark as confirmed — requires txpowId, inclusionProof, confirmedBlock |
| `cancelSession(session, reason?)` | Cancel the session |
| `sessionSummary(session)` | Get readiness summary |

### Policy Discovery (`discovery.ts`)

Announce, query, resolve, and watch policy manifests through the Totem lookup network.

```ts
import { announcePolicy, queryPolicies, resolvePolicyForSubject, watchPolicy } from '@totemsdk/recursive-mast';

await announcePolicy(lookupClient, {
  manifest, manifestBytes,
  capabilities: ['firmware.install', 'maintenance.restart'],
  expiresAt: Date.now() + 86400000,
});

const results = await queryPolicies(lookupClient, {
  subjectId: 'VIN-123',
  capability: 'firmware.install',
  activeOnly: true, limit: 10,
});

const resolved = await resolvePolicyForSubject(lookupClient, {
  subjectId: 'VIN-123',
  action: 'firmware.install',
});

const unsubscribe = watchPolicy(lookupClient, {
  policyId: 'vehicle-policy-v1',
  afterEpoch: 17,
  onUpdate: (update) => console.log('Policy updated:', update),
});
```

| Export | Description |
|--------|-------------|
| `announcePolicy(client, config)` | Announce a policy manifest to the lookup network |
| `queryPolicies(client, config)` | Query the lookup network for policies |
| `resolvePolicyForSubject(client, config)` | Resolve the current policy for a subject and action |
| `watchPolicy(client, config)` | Watch a policy for updates. Returns unsubscribe function. |

### Branch Capsule (`branch-capsule.ts`)

Self-contained branch package for recursive MAST. A counterparty should not need to download the complete policy tree merely to exercise one leaf.

```ts
import { createBranchPackage, validateBranchEnvelope, verifyBranchMembership, serializeBranchPackage, deserializeBranchPackage } from '@totemsdk/recursive-mast';

const branch = await createBranchPackage({
  policyId: 'vehicle-policy-v1',
  policyRoot: '0xA72...',
  policyVersion: 1, policyEpoch: 18,
  script: 'ASSERT SIGNEDBY(0x...) RETURN TRUE',
  proof: merkleProofBytes,
  action: 'firmware.install',
  role: 'oem-release-authority',
  childRoots: ['0x...'],
  evidenceRequirements: ['work-order', 'firmware-hash'],
  validFrom: Math.floor(Date.now() / 1000),
  publisherIdentityId: 'oem-identity-1',
  signFn,
});

// Envelope validation (script hash, proof presence, publisher signature, validity window)
const envelope = validateBranchEnvelope(branch);

// Full cryptographic verification (envelope + MMR proof against policy root)
const verification = verifyBranchMembership(branch);
// { valid, envelopeSignatureValid, scriptHashValid, membershipProofValid, policyRootValid, publisherAuthorized, policyCurrent, validityWindowValid, errors }

const bytes = serializeBranchPackage(branch);
const restored = deserializeBranchPackage(bytes);
```

| Export | Description |
|--------|-------------|
| `serializeBranchPackage(branch)` | Serialize to Uint8Array |
| `deserializeBranchPackage(data)` | Deserialize from Uint8Array |
| `validateBranchEnvelope(branch)` | Validate envelope (script hash, proof presence, publisher signature, validity window) |
| `verifyBranchMembership(branch)` | Full cryptographic verification including MMR proof against policy root |
| `createBranchPackage(config, signFn)` | Create and sign a branch package |
| `branchSummary(branch)` | Extract summary metadata |

**Note:** `verifyBranchPackage()` is deprecated. Use `validateBranchEnvelope()` for envelope checks or `verifyBranchMembership()` for full cryptographic verification.

### Content Keys (`content-keys.ts`)

Content-addressed key scheme for policy storage. Two-layer addressing: stable lookup keys and immutable content keys.

```
policy:<policyId>:manifest:<version>   — stable lookup key
manifest:<manifestDigest>              — immutable content key
script:<scriptHash>
proof:<policyRoot>:<scriptHash>
bundle:<bundleHash>
```

```ts
import { policyManifestKey, manifestDigestKey, scriptKey, proofKey, bundleKey, computeManifestDigest, computeScriptHash } from '@totemsdk/recursive-mast';

const lookupKey = policyManifestKey('vehicle-policy-v1', 1);
// { key: 'policy:vehicle-policy-v1:manifest:1' }

const digest = computeManifestDigest(manifestBytes);
const contentKey = manifestDigestKey(digest);
// { key: 'manifest:0x...' }

const scriptHash = computeScriptHash('ASSERT SIGNEDBY(0x...) RETURN TRUE');
```

| Export | Description |
|--------|-------------|
| `policyManifestKey(policyId, version)` | Stable lookup key |
| `manifestDigestKey(digest)` | Immutable content key |
| `scriptKey(scriptHash)` | Script content key |
| `proofKey(policyRoot, scriptHash)` | Proof content key |
| `bundleKey(bundleHash)` | Bundle content key |
| `parseContentKey(key)` | Parse a content key string |
| `computeManifestDigest(manifestBytes)` | SHA3-256 of manifest bytes |
| `computeBundleHash(manifest, branches)` | SHA3-256 of manifest + branches |
| `computeScriptHash(script)` | SHA3-256 of script string |

### Policy Store (`policy-store.ts`)

Storage interface for policy material. Implementations can use memory, local filesystem, Hypercore, HTTP, or any custom enterprise adapter.

```ts
import type { RecursiveMastPolicyStore } from '@totemsdk/recursive-mast';
```

| Method | Description |
|--------|-------------|
| `putManifest(manifest)` | Store a policy manifest |
| `getManifest(policyId, version?)` | Retrieve a manifest |
| `putBranch(branch)` | Store a branch package |
| `getBranch(policyRoot, scriptHash)` | Retrieve a branch package |
| `listBranches?(policyRoot, filter?)` | List branch summaries |
| `putBundle(manifest, branches)` | Store a complete bundle |
| `getBundle(bundleHash)` | Retrieve a bundle |
| `mirrorPolicy?(policyId, destination)` | Mirror all policy material to another store |
| `hasManifest?(policyId, version?)` | Check if a manifest exists |
| `hasBranch?(policyRoot, scriptHash)` | Check if a branch exists |
| `listManifests?(policyId)` | List all versions of a policy |

### Memory Store (`store-memory.ts`)

In-memory implementation with optional JSON filesystem persistence.

```ts
import { MemoryPolicyStore } from '@totemsdk/recursive-mast';

const store = new MemoryPolicyStore({ persistPath: './policy-data' });
await store.putManifest(manifest);
const retrieved = await store.getManifest('vehicle-policy-v1', 1);
await store.putBranch(branch);
const branches = await store.listBranches('0xA72...', { action: 'firmware.install', activeOnly: true });
```

### HTTP Store (`store-http.ts`)

Read-only HTTP implementation. Fetches policy material from remote endpoints.

```
GET /policy/:policyId/manifest/:version
GET /policy/:policyId/manifest/latest
GET /proof/:policyRoot/:scriptHash
GET /proof/:policyRoot/branches?action=...&role=...&activeOnly=true
GET /bundle/:bundleHash
```

```ts
import { HttpPolicyStore } from '@totemsdk/recursive-mast';

const store = new HttpPolicyStore({
  baseUrl: 'https://policies.oem.example',
  timeoutMs: 5000,
});

const manifest = await store.getManifest('vehicle-policy-v1');
const branch = await store.getBranch('0xA72...', '0x...');
```

### Availability (`availability.ts`)

Data-availability diagnostics. A valid MAST root is useless if nobody can retrieve the selected script and its proof.

```ts
import { auditPolicyAvailability } from '@totemsdk/recursive-mast';

const report = await auditPolicyAvailability({
  policyId: 'vehicle-policy-v1',
  replicas: [
    { replicaId: 'oem-1', custodianIdentityId: 'oem-identity', store: oemStore },
    { replicaId: 'regulator-1', custodianIdentityId: 'regulator-identity', store: regulatorStore },
    { replicaId: 'vehicle-1', custodianIdentityId: 'vehicle-identity', store: vehicleStore },
  ],
  availabilityPolicy: {
    minimumReplicas: 3,
    requiredCustodians: ['oem', 'regulator', 'fleet-owner'],
    requireLocalCriticalBranches: true,
    archivePreviousVersions: true,
  },
  criticalActions: ['firmware.install', 'theft.recovery'],
  recoveryAction: 'institutional.recovery',
});
// { policyId, manifestReplicas, branchCoverage, missingBranches, unmirroredCriticalPaths, recoveryPathAvailable, meetsMinimumReplicas, warnings }
```

| Export | Description |
|--------|-------------|
| `auditPolicyAvailability(config)` | Audit policy availability across multiple replicas |
| `PolicyStoreReplica` | `{ replicaId, custodianIdentityId, store, signedAvailabilityReceipt? }` |
| `AvailabilityPolicy` | `{ minimumReplicas, requiredCustodians, requireLocalCriticalBranches, replicationCheckInterval?, archivePreviousVersions }` |
| `PolicyAvailabilityReport` | Full diagnostic report |

### Encrypted Branch (`encrypted-branch.ts`)

Private policy branches. A branch package can be encrypted while its script hash remains committed on-chain. The transaction eventually reveals any script it executes, but the branch does not have to be publicly available beforehand.

```ts
import { createEncryptedBranch, decryptBranch, isEncryptedBranch, encryptedBranchPublicMetadata } from '@totemsdk/recursive-mast';

const encrypted = await createEncryptedBranch(branch, encryptFn, 'key-fingerprint-abc', ['0x...', '0x...']);
const publicMeta = encryptedBranchPublicMetadata(encrypted);
const { branch: decrypted } = await decryptBranch(encrypted, decryptFn, 'key-fingerprint-abc');
```

| Export | Description |
|--------|-------------|
| `createEncryptedBranch(branch, encryptFn, keyFingerprint, recipientPkds)` | Encrypt a branch package |
| `decryptBranch(encrypted, decryptFn, keyFingerprint)` | Decrypt a branch package |
| `isEncryptedBranch(obj)` | Type guard |
| `encryptedBranchPublicMetadata(encrypted)` | Extract public metadata |

### Canonical Encoding (`canonical-encoding.ts`)

Deterministic binary encoding for cross-implementation verifiability. Replaces ad-hoc `JSON.stringify()`.

```
schema_version(2 bytes) || domain(4 bytes ASCII) || sorted_json_utf8
```

Domains: `MANF` (manifest), `BRIN` (branch inventory), `AVRC` (availability receipt), `SREQ` (signing request), `SRES` (signing response), `EVID` (evidence), `BUND` (bundle).

```ts
import { canonicalSerialize, canonicalHash, canonicalSign, canonicalVerify } from '@totemsdk/recursive-mast';

const hash = canonicalHash('MANF', manifestPayload);
const sig = await canonicalSign('AVRC', receiptPayload, signFn);
const valid = await canonicalVerify('AVRC', receiptPayload, sigBytes, verifyFn);
```

| Export | Description |
|--------|-------------|
| `canonicalSerialize(domain, payload, version?)` | Serialize with schema version + domain prefix + sorted JSON |
| `canonicalHash(domain, payload, version?)` | SHA3-256 of canonical serialization |
| `canonicalSign(domain, payload, signFn, version?)` | Sign the canonical serialization |
| `canonicalVerify(domain, payload, signature, verifyFn, version?)` | Verify a canonical signature |

### Branch Inventory (`branch-inventory.ts`)

Manifest-committed inventory of all policy branches. Enables availability audits to detect branches missing from all stores.

```ts
import { computeBranchInventoryHash, validateInventoryCoverage, getCriticalBranches } from '@totemsdk/recursive-mast';

const inventory: BranchInventory = {
  policyId: 'vehicle-policy-v1',
  version: 1, epoch: 18,
  policyRoot: '0xA72...',
  branches: [
    { scriptHash: '0x...', action: 'firmware.install', role: 'oem-release-authority', policyRoot: '0x...', critical: true, recoveryPath: false },
    { scriptHash: '0x...', action: 'theft.recovery', role: 'owner', policyRoot: '0x...', critical: true, recoveryPath: true },
  ],
  createdAt: Date.now(),
};

const hash = computeBranchInventoryHash(inventory);
const coverage = validateInventoryCoverage(inventory, availableHashes);
// { coverage: 0.95, total: 20, available: 19, missing: [...], missingCritical: [...], missingRecovery: [...] }
```

| Export | Description |
|--------|-------------|
| `computeBranchInventoryHash(inventory)` | Canonical hash of the branch inventory |
| `getCriticalBranches(inventory)` | Filter critical branches |
| `getRecoveryBranches(inventory)` | Filter recovery branches |
| `getBranchesByAction(inventory, action)` | Filter by action |
| `getBranchesByRole(inventory, role)` | Filter by role |
| `validateInventoryCoverage(inventory, availableHashes)` | Compute coverage and identify missing branches |

### Availability Receipts (`availability-receipts.ts`)

Cryptographically signed attestations that a custodian holds specific policy material.

```ts
import { createAvailabilityReceipt, signAvailabilityReceipt, verifyAvailabilityReceipt } from '@totemsdk/recursive-mast';

const receipt = createAvailabilityReceipt({
  custodianIdentityId: 'oem-identity',
  policyId: 'vehicle-policy-v1',
  policyVersion: 1, policyEpoch: 18,
  policyRoot: '0xA72...',
  manifestDigest: '0x...',
  branchHashes: ['0x...', '0x...'],
  inventoryDigest: '0x...',
  validitySeconds: 86400,
});

const signed = await signAvailabilityReceipt(receipt, signFn, custodianPkd);
const verification = await verifyAvailabilityReceipt(signed, verifyFn);
// { valid: true/false, reason?: '...' }
```

| Export | Description |
|--------|-------------|
| `createAvailabilityReceipt(config)` | Create an unsigned availability receipt |
| `signAvailabilityReceipt(receipt, signFn, custodianPkd)` | Sign a receipt with canonical encoding |
| `verifyAvailabilityReceipt(receipt, verifyFn)` | Verify receipt signature and expiry |
| `receiptCoversBranch(receipt, scriptHash)` | Check if receipt covers a specific branch |
| `receiptCoversInventory(receipt, inventory)` | Check if receipt covers an inventory |

### Encryption Envelope (`encryption-envelope.ts`)

Binary encryption envelope specification. Replaces ad-hoc encryptFn/decryptFn callbacks.

```
version(1) || algorithm(1) || keyFingerprint(32) || nonce(12) || ciphertext(*)
```

Supported algorithms: `0x01` = AES-256-GCM, `0x02` = ChaCha20-Poly1305.

```ts
import { createEncryptionEnvelope, serializeEncryptionEnvelope, deserializeEncryptionEnvelope, createKeyWrappingEnvelope, ENCRYPTION_ALGORITHMS } from '@totemsdk/recursive-mast';

const envelope = createEncryptionEnvelope(
  ENCRYPTION_ALGORITHMS.AES_256_GCM,
  keyBytes, nonce, ciphertext,
);

const bytes = serializeEncryptionEnvelope(envelope);
const parsed = deserializeEncryptionEnvelope(bytes);

const wrapped = createKeyWrappingEnvelope(
  ENCRYPTION_ALGORITHMS.AES_256_GCM,
  recipientPkd, wrappedKeyBytes, keyFingerprint,
);
```

| Export | Description |
|--------|-------------|
| `ENCRYPTION_ALGORITHMS` | `{ AES_256_GCM: 0x01, CHACHA20_POLY1305: 0x02 }` |
| `serializeEncryptionEnvelope(envelope)` | Serialize to binary |
| `deserializeEncryptionEnvelope(data)` | Deserialize from binary |
| `computeKeyFingerprint(keyBytes)` | SHA3-256 of key bytes |
| `createEncryptionEnvelope(algorithm, keyBytes, nonce, ciphertext)` | Create an envelope |
| `createKeyWrappingEnvelope(algorithm, recipientPkd, wrappedKey, keyFingerprint)` | Create a key wrapping envelope |
| `serializeKeyWrappingEnvelope(envelope)` | Serialize key wrapping envelope |
| `deserializeKeyWrappingEnvelope(data)` | Deserialize key wrapping envelope |

### Branded Types (`branded-types.ts`)

Compile-time type safety for security-critical time and block values.

```ts
import { asBlockHeight, asBlockDuration, asUnixTimeMs, asUnixTimeSec, nowMs, nowSec } from '@totemsdk/recursive-mast';
import type { BlockHeight, BlockDuration, UnixTimeMs, UnixTimeSec } from '@totemsdk/recursive-mast';

const height: BlockHeight = asBlockHeight(1000000);
const duration: BlockDuration = asBlockDuration(144);
const now: UnixTimeMs = nowMs();
```

| Export | Description |
|--------|-------------|
| `asBlockHeight(n)` | Brand a number as BlockHeight |
| `asBlockDuration(n)` | Brand a number as BlockDuration |
| `asUnixTimeMs(n)` | Brand a number as UnixTimeMs |
| `asUnixTimeSec(n)` | Brand a number as UnixTimeSec |
| `unixTimeMsToSec(ms)` | Convert ms to sec |
| `unixTimeSecToMs(sec)` | Convert sec to ms |
| `nowMs()` | Current time as UnixTimeMs |
| `nowSec()` | Current time as UnixTimeSec |

### Policy Signer (`policy-signer.ts`)

WOTS-aware signing interface with lease integration. Manifests, branch packages, signing requests and responses all consume one-time WOTS keys.

```ts
import type { PolicySigner, PolicySignature, SigningDomain } from '@totemsdk/recursive-mast';

const signer: PolicySigner = {
  address: '0x...',
  signDomainSeparated: async (domain, payload) => {
    // domain: 'policy-manifest' | 'branch-package' | 'signing-request' | 'signing-response' | 'evidence' | 'availability-receipt'
    const lease = await wotsLease.reserveKeyUse({ treeId, purpose: domain });
    const sig = await signFn(payload, lease.indices.l3);
    await wotsLease.commitReservation(lease.reservationId, txId);
    return { signature: sig, publicKey: lease.publicKey, keyIndex: lease.indices.l3, leaseReceipt: lease.reservationId, signedAt: nowMs() };
  },
  getPublicKey: async () => publicKeyHex,
  reserveKey: async () => { /* ... */ },
  commitKey: async (receipt) => { /* ... */ },
  burnKey: async (receipt, reason) => { /* ... */ },
};
```

| Export | Description |
|--------|-------------|
| `PolicySigner` | Interface with `signDomainSeparated`, `getPublicKey`, `reserveKey?`, `commitKey?`, `burnKey?` |
| `PolicySignature` | `{ signature, publicKey, keyIndex, leaseReceipt, signedAt }` |
| `SigningDomain` | `'policy-manifest' \| 'branch-package' \| 'signing-request' \| 'signing-response' \| 'evidence' \| 'availability-receipt'` |

## KISSVM integration (`@totemsdk/recursive-mast/kissvm`)

> **v0.4+:** The MAST compiler, policy tree, proof chain, layered policy, policy anchor, PREVSTATE workflows, and templates now live in `@totemsdk/kissvm`. recursive-mast retains the higher-level policy coordination (delegation, discovery, signing, storage, etc.). See [`@totemsdk/kissvm` GUIDE.md](https://github.com/totem-sdk/totem-sdk/blob/main/packages/totem-sdk/packages/kissvm/src/GUIDE.md).

Delegates to `@totemsdk/kissvm` for all VM-level operations. recursive-mast owns policy coordination; kissvm owns execution.

```ts
import {
  validatePolicyScript, validatePolicyScripts,
  materializeRecursiveWitness,
  simulatePolicyTransaction,
  analyzeResourceUsage,
} from '@totemsdk/recursive-mast/kissvm';

// Validate scripts before publication
const validation = validatePolicyScript('ASSERT SIGNEDBY(0xABCD) RETURN TRUE');
// { valid: true, script, nodeCount: 3 }

// Materialize a witness plan into a canonical ScriptWitness
const { witness, mastBranches } = materializeRecursiveWitness(witnessPlan);

// Simulate the transaction before requesting signatures
const simulation = await simulatePolicyTransaction(
  anchorScript, coinData, txContext, witnessPlan,
);
// { passed: true/false, error?, trace, instructionsUsed }

// Check resource limits at compile time
const analysis = analyzeResourceUsage(scripts);
// { withinLimits, estimatedInstructions, estimatedStackDepth, limits, warnings }
```

| Export | Description |
|--------|-------------|
| `validatePolicyScript(script)` | Parse a script through kissvm to catch malformed KISSVM |
| `validatePolicyScripts(scripts)` | Validate multiple scripts |
| `validateRecursivePath(scripts)` | Validate a recursive path |
| `materializeRecursiveWitness(plan)` | Convert a witness plan to canonical `ScriptWitness` via `buildWitness()` |
| `simulatePolicyTransaction(anchorScript, coinData, txContext, witnessPlan)` | Run the full policy path through `simulateSpend()` |
| `simulateRecursiveSpend(...)` | Alias for `simulatePolicyTransaction` |
| `analyzeResourceUsage(scripts, limits?)` | Check 1024 instruction / 64 stack depth limits |
| `checkResourceLimits(scripts, limits?)` | Alias for `analyzeResourceUsage` |

## Transaction integration (`@totemsdk/recursive-mast/transaction`)

Policy-aware transaction planning. `@totemsdk/tx-builder` is an optional peer dependency.

```ts
import {
  createPolicyTransactionPlan, toEnhancedBuildParams,
  createAnchorTransactionPlan,
  createActionTransactionPlan,
  createRootRotationTransactionPlan,
} from '@totemsdk/recursive-mast/transaction';

// Create the Policy Anchor Coin transaction
const anchorPlan = createAnchorTransactionPlan({
  anchorConfig,
  initialRoots: { regulatorRoot: '0x...', ownerRoot: '0x...', manifestHash: '0x...' },
  fundingCoinId: '0x...', fundingAddress: '0x...',
  fundingAmount: '100', anchorAmount: '1',
  fundingScriptDescriptor,
});

// Execute a policy action
const actionPlan = createActionTransactionPlan({
  anchorCoinId: '0x...', anchorAddress: '0x...', anchorAmount: '1',
  anchorScriptDescriptor,
  action: 'firmware.install', subjectId: 'VIN-123',
  disclosedScripts, witnessPlan,
  outputs: [{ address: '0x...', amount: '0' }],
  stateChanges: { 14: '19' },
});

// Rotate a policy root
const rotationPlan = createRootRotationTransactionPlan({
  anchorCoinId: '0x...', anchorAddress: '0x...', anchorAmount: '1',
  anchorScriptDescriptor, anchorConfig,
  rotationType: 'root', port: 10, newRoot: '0x...',
  authorizerPkd: '0x...', reason: 'Annual regulator update',
});

// Convert to tx-builder-compatible params
const buildParams = toEnhancedBuildParams(actionPlan);
// Compatible with @totemsdk/tx-builder's EnhancedBuildParams
```

| Export | Description |
|--------|-------------|
| `createPolicyTransactionPlan(config)` | Create a policy transaction plan |
| `toEnhancedBuildParams(plan)` | Convert to tx-builder-compatible build params |
| `createAnchorTransactionPlan(config)` | Create the Policy Anchor Coin transaction |
| `createActionTransactionPlan(config)` | Create a policy action execution transaction |
| `createRootRotationTransactionPlan(config)` | Create a root rotation or epoch advancement transaction |

## Templates

Ready-to-use KISSVM script templates. **All templates are EXPERIMENTAL — NOT AUDITED. Do not use in production without independent security review against a Minima node.**

> **v0.4+:** Most templates moved to `@totemsdk/kissvm` (import from `@totemsdk/kissvm` directly or `@totemsdk/kissvm/templates/<name>`). `access-control` and `identity-verification` remain here as they depend on delegation/cross-domain infrastructure.

| Package | Templates |
|---------|-----------|
| `@totemsdk/kissvm/templates/*` | sensor-proof, state-machine, compliance, firmware-update, payment-channel, recovery, device-lifecycle, commercial, layers, treasury, rwa-lifecycle, supply-chain, energy, healthcare, voting, data-privacy, legal |
| `@totemsdk/recursive-mast/templates/*` | access-control, identity-verification |

## End-to-end example: Vehicle firmware update

```ts
import {
  compileMastTree, verifyScriptMembership,
  buildPolicyAnchorScript, buildPolicyAnchorState,
} from '@totemsdk/kissvm'; // MAST primitives
import {
  signPolicyManifest,
  createSigningSession, acceptResponse, recordEvidence,
  advanceSession, submitSession, confirmSession, sessionSummary,
  announcePolicy, resolvePolicyForSubject,
  createBranchPackage, verifyBranchMembership,
  MemoryPolicyStore, auditPolicyAvailability,
  canonicalHash,
} from '@totemsdk/recursive-mast'; // Policy coordination
import { validatePolicyScript, simulatePolicyTransaction, materializeRecursiveWitness } from '@totemsdk/recursive-mast/kissvm';
import { createAnchorTransactionPlan, createActionTransactionPlan } from '@totemsdk/recursive-mast/transaction';

// 1. Compile the policy scripts into a canonical MAST tree
const compiled = compileMastTree([
  'ASSERT SIGNEDBY(0xOEM_PKD) RETURN TRUE',
  'ASSERT SIGNEDBY(0xOWNER_PKD) RETURN TRUE',
  'ASSERT @BLOCK GTE 1000000 RETURN TRUE',
]);

// 2. Verify all proofs roundtrip
for (const sp of compiled.scripts) {
  const result = verifyScriptMembership(sp.script, sp.proofHex, compiled.rootHex);
  if (!result.valid) throw new Error(`Proof verification failed: ${result.reason}`);
}

// 3. Validate scripts through KISSVM parser
for (const sp of compiled.scripts) {
  const validation = validatePolicyScript(sp.script);
  if (!validation.valid) throw new Error(`Script validation failed: ${validation.error}`);
}

// 4. Create the Policy Anchor Coin
const anchorConfig = {
  subjectId: 'VIN-123', subjectType: 'vehicle' as const,
  institutionalRoot: compiled.rootHex, initialEpoch: 1,
  ports: {
    regulatorRoot: 10, ownerRoot: 11, serviceProviderRoot: 12,
    firmwareApprovalRoot: 13, epoch: 14, manifestHash: 15,
    recoveryRoot: 16, emergencyRoot: 17, actionRoot: 18,
  },
  recoveryRoot: recoveryTreeRoot,
};
const anchorScript = buildPolicyAnchorScript(anchorConfig);
const anchorState = buildPolicyAnchorState(anchorConfig, {
  regulatorRoot: '0x...', ownerRoot: '0x...',
  firmwareApprovalRoot: compiled.rootHex,
  manifestHash: '0x...',
});

// 5. Sign and publish the policy manifest
const manifest = {
  policyId: 'vehicle-policy-v1', policyRoot: compiled.rootHex,
  anchorAddress: '0x...', version: 1, epoch: 1,
  status: 'active' as const,
  subject: { type: 'vehicle' as const, id: 'VIN-123' },
  actions: [{
    action: 'firmware.install', description: 'Install a firmware update',
    inputs: { version: 'string', hash: 'string' },
    requiredRoles: ['oem-release-authority', 'vehicle-owner'],
    executionRoot: compiled.rootHex,
    requestEndpoint: 'hyperswarm://firmware-signing',
    expirySeconds: 300,
  }],
  roles: [
    { role: 'oem-release-authority', description: 'OEM firmware release authority', currentRoot: oemRoot, federated: true, persistent: true },
    { role: 'vehicle-owner', description: 'Vehicle owner', currentRoot: ownerRoot, federated: false, persistent: true },
  ],
  endpoints: [
    { id: 'signing', transport: 'hyperswarm', address: 'firmware-signing', purpose: 'signing' },
    { id: 'discovery', transport: 'https', address: 'https://policies.oem.example/', purpose: 'discovery' },
  ],
  policyPackageHash: '0x...', validFrom: 1000000,
};
const signedManifest = await signPolicyManifest(manifest, oemSignFn, oemPkd);

// 6. Store in policy repositories
const oemStore = new MemoryPolicyStore();
const vehicleStore = new MemoryPolicyStore({ persistPath: './vehicle-policy' });
await oemStore.putManifest(signedManifest);
await vehicleStore.putManifest(signedManifest);

// 7. Create and store branch packages
const firmwareBranch = await createBranchPackage({
  policyId: 'vehicle-policy-v1', policyRoot: compiled.rootHex,
  policyVersion: 1, policyEpoch: 1,
  script: compiled.scripts[0].script,
  proof: hexToBytes(compiled.scripts[0].proofHex),
  action: 'firmware.install', role: 'oem-release-authority',
  childRoots: [ownerRoot],
  evidenceRequirements: ['work-order', 'firmware-hash'],
  validFrom: Math.floor(Date.now() / 1000),
  publisherIdentityId: 'oem-identity-1',
  signFn: oemSignFn,
});
const verification = verifyBranchMembership(firmwareBranch);
if (!verification.valid) throw new Error(`Branch verification failed: ${verification.errors.join(', ')}`);

await oemStore.putBranch(firmwareBranch);
await vehicleStore.putBranch(firmwareBranch);

// 8. Announce to lookup network
await announcePolicy(lookupClient, {
  manifest: signedManifest,
  manifestBytes: new TextEncoder().encode(JSON.stringify(signedManifest)),
  capabilities: ['firmware.install', 'maintenance.restart'],
  expiresAt: Date.now() + 86400000,
});

// 9. Create signing session
const session = createSigningSession({
  policyId: 'vehicle-policy-v1', policyVersion: 1, policyEpoch: 1,
  action: 'firmware.install', transactionDigest: txDigest,
  requiredRoles: ['oem-release-authority', 'vehicle-owner'],
  requiredEvidence: [
    { evidenceId: 'work-order', type: 'maintenance-record' },
    { evidenceId: 'firmware-hash', type: 'binary-hash' },
  ],
  expirySeconds: 600,
});

// 10. Collect signatures and evidence
const withOemSig = acceptResponse(session, oemSigningResponse);
const withEvidence = recordEvidence(withOemSig, workOrderEvidence);
const withFirmwareEvidence = recordEvidence(withEvidence, firmwareHashEvidence);
const withOwnerSig = acceptResponse(withFirmwareEvidence, ownerSigningResponse);

const summary = sessionSummary(withOwnerSig);
// { status: 'ready', signedCount: 2, requiredCount: 2, evidenceCollected: 2, evidenceRequired: 2, pendingRoles: [], remainingEvidence: [] }

// 11. Simulate before submitting
const simulation = await simulatePolicyTransaction(
  anchorScript,
  { amount: 1, tokenId: '0x00', coinId: anchorCoinId, address: anchorAddress },
  { block: 1000000, inputIndex: 0, inputs: [], outputs: [], state: anchorState, prevState: {} },
  witnessPlan,
);
if (!simulation.passed) throw new Error(`Simulation failed: ${simulation.error}`);

// 12. Submit and confirm
const submitted = submitSession(withOwnerSig);
const confirmed = confirmSession(submitted, {
  txpowId: '0x...',
  inclusionProof: '0x...',
  confirmedBlock: 1000001,
});

// 13. Audit availability
const report = await auditPolicyAvailability({
  policyId: 'vehicle-policy-v1',
  replicas: [
    { replicaId: 'oem-1', custodianIdentityId: 'oem-identity', store: oemStore },
    { replicaId: 'vehicle-1', custodianIdentityId: 'vehicle-identity', store: vehicleStore },
  ],
  availabilityPolicy: {
    minimumReplicas: 2,
    requiredCustodians: ['oem', 'vehicle'],
    requireLocalCriticalBranches: true,
    archivePreviousVersions: true,
  },
  criticalActions: ['firmware.install', 'theft.recovery'],
  recoveryAction: 'institutional.recovery',
});
```

## Design principles

1. **Data integrity on-chain, data availability off-chain.** Minima stores commitments; policy repositories store the corpus.
2. **Federated storage.** Each authority maintains its own subtree material. No single repository holds everything.
3. **Self-contained branch capsules.** Counterparties download only the branches they need, not the entire tree.
4. **Content-addressed keys with two-layer addressing.** Stable lookup keys resolve to immutable content keys.
5. **The coordinator is not trusted.** Every signer independently verifies the transaction before signing.
6. **Private branches are first-class.** Encrypted branch packages with public hashes and restricted payloads.
7. **Availability is monitorable.** `auditPolicyAvailability()` with committed branch inventories turns operational risk into a measurable metric.
8. **Recovery is multi-layered.** Threshold, time-delayed, epoch-based, and succession paths for institutional identities.
9. **Canonical encoding throughout.** Domain-separated, schema-versioned deterministic serialization replaces ad-hoc JSON.
10. **WOTS-aware signing.** `PolicySigner` interface integrates with `@totemsdk/wots-lease` to prevent key-index reuse.

## Dependencies

| Package | Version | Required |
|---------|---------|----------|
| `@totemsdk/core` | `^1.2.4` | Yes |
| `@totemsdk/kissvm` | `^0.2.1` | Yes |
| `@totemsdk/tx-builder` | `^0.1.8` | Optional (peer) |

## License

MIT

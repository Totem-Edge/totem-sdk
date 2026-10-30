/**
 * Availability gate conformance (RFC-007 Phase 5).
 *
 * Proves the recursive-MAST availability integration and its cycle guard:
 *   - a content action whose branch is unavailable in every replica is
 *     fail-closed (denied);
 *   - the recovery path is INDEPENDENT of the content gate: recovery proceeds
 *     even when every content branch is missing, and even when the manifest is
 *     below the minimum replica count;
 *   - under-replicated recovery material is surfaced, never silently
 *     failed-open and never turned into a denial;
 *   - a missing recovery branch does not affect content authorization.
 */

import { MemoryPolicyStore } from '../store-memory.js';
import type { RecursiveMastPolicyManifest } from '../policy-manifest.js';
import type { MastBranchPackage } from '../branch-capsule.js';
import { evaluateAvailabilityGate } from '../availability-gate.js';
import type { AvailabilityPolicy, PolicyStoreReplica } from '../availability.js';

const POLICY_ID = 'policy-1';
const POLICY_ROOT = '0xdeadbeef';
const CONTENT = 'firmware.install';
const RECOVERY = 'institutional.recovery';

const AVAILABILITY_POLICY: AvailabilityPolicy = {
  minimumReplicas: 1,
  requiredCustodians: [],
  requireLocalCriticalBranches: true,
  archivePreviousVersions: false,
};

function makeManifest(): RecursiveMastPolicyManifest {
  return {
    policyId: POLICY_ID,
    policyRoot: POLICY_ROOT,
    anchorAddress: 'MxANCHOR',
    version: 1,
    epoch: 1,
    status: 'active',
    subject: { type: 'device', id: 'dev-1' },
    actions: [],
    roles: [],
    endpoints: [],
    policyPackageHash: '0xpkg',
    validFrom: 0,
  };
}

function makeBranch(action: string): MastBranchPackage {
  return {
    policyId: POLICY_ID,
    policyRoot: POLICY_ROOT,
    policyVersion: 1,
    policyEpoch: 1,
    script: 'RETURN TRUE',
    scriptHash: `0x${action}`,
    proof: new Uint8Array(),
    action,
    validFrom: 0,
    publisherIdentityId: 'pub-1',
    publisherSignature: 'sig',
  };
}

async function makeReplica(id: string, actions: string[]): Promise<PolicyStoreReplica> {
  const store = new MemoryPolicyStore();
  await store.putManifest(makeManifest());
  for (const action of actions) {
    await store.putBranch(makeBranch(action));
  }
  return { replicaId: id, custodianIdentityId: `cust-${id}`, store };
}

describe('evaluateAvailabilityGate — content gate (fail-closed)', () => {
  it('allows a content action whose branch is available', async () => {
    const replicas = [await makeReplica('r1', [CONTENT, RECOVERY])];
    const decision = await evaluateAvailabilityGate({
      policyId: POLICY_ID,
      replicas,
      availabilityPolicy: AVAILABILITY_POLICY,
      action: CONTENT,
      kind: 'content',
    });
    expect(decision.allowed).toBe(true);
    expect(decision.kind).toBe('content');
  });

  it('denies a content action whose branch is unavailable in every replica', async () => {
    const replicas = [await makeReplica('r1', [RECOVERY])];
    const decision = await evaluateAvailabilityGate({
      policyId: POLICY_ID,
      replicas,
      availabilityPolicy: AVAILABILITY_POLICY,
      action: CONTENT,
      kind: 'content',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('not available');
  });
});

describe('evaluateAvailabilityGate — recovery cycle guard', () => {
  it('recovery-path test: recovery proceeds independently of the content gate', async () => {
    // Content branch missing entirely, recovery branch present.
    const replicas = [await makeReplica('r1', [RECOVERY])];

    const content = await evaluateAvailabilityGate({
      policyId: POLICY_ID,
      replicas,
      availabilityPolicy: AVAILABILITY_POLICY,
      action: CONTENT,
      kind: 'content',
    });
    const recovery = await evaluateAvailabilityGate({
      policyId: POLICY_ID,
      replicas,
      availabilityPolicy: AVAILABILITY_POLICY,
      action: RECOVERY,
      kind: 'recovery',
    });

    // Content authorization is gated; recovery is not — the cycle is broken.
    expect(content.allowed).toBe(false);
    expect(recovery.allowed).toBe(true);
    expect(recovery.recoveryUnderReplicated).toBe(false);
  });

  it('recovery is never blocked, even when the recovery branch is missing (surfaced, not failed-open)', async () => {
    const replicas = [await makeReplica('r1', [])];
    const decision = await evaluateAvailabilityGate({
      policyId: POLICY_ID,
      replicas,
      availabilityPolicy: AVAILABILITY_POLICY,
      action: RECOVERY,
      kind: 'recovery',
    });
    expect(decision.allowed).toBe(true);
    expect(decision.recoveryUnderReplicated).toBe(true);
    expect(decision.reason).toContain('under-replicated');
  });

  it('recovery ignores the content minimum-replica requirement', async () => {
    const replicas = [await makeReplica('r1', [RECOVERY])];
    const strict: AvailabilityPolicy = { ...AVAILABILITY_POLICY, minimumReplicas: 3 };

    const content = await evaluateAvailabilityGate({
      policyId: POLICY_ID,
      replicas,
      availabilityPolicy: strict,
      action: CONTENT,
      kind: 'content',
    });
    const recovery = await evaluateAvailabilityGate({
      policyId: POLICY_ID,
      replicas,
      availabilityPolicy: strict,
      action: RECOVERY,
      kind: 'recovery',
    });

    expect(content.allowed).toBe(false);
    expect(recovery.allowed).toBe(true);
  });

  it('a missing recovery branch does not affect content authorization', async () => {
    const replicas = [await makeReplica('r1', [CONTENT])];
    const decision = await evaluateAvailabilityGate({
      policyId: POLICY_ID,
      replicas,
      availabilityPolicy: AVAILABILITY_POLICY,
      action: CONTENT,
      kind: 'content',
    });
    expect(decision.allowed).toBe(true);
    expect(decision.recoveryUnderReplicated).toBe(false);
  });
});

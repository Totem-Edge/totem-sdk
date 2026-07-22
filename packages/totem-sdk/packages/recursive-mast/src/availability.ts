/**
 * Policy availability auditing — data-availability diagnostics for
 * recursive MAST policy repositories.
 *
 * A valid MAST root is useless if nobody can retrieve the selected
 * script and its proof. The chain can confirm "this script belongs to
 * this root" but cannot reconstruct the script from the root.
 *
 * This module provides:
 *   - AvailabilityPolicy — replication requirements
 *   - auditPolicyAvailability() — diagnostic report
 *   - PolicyAvailabilityReport — replica counts, branch coverage, gaps
 */

import type { RecursiveMastPolicyStore } from './policy-store.js';
import type { RecursiveMastPolicyManifest } from './policy-manifest.js';

export interface PolicyStoreReplica {
  replicaId: string;
  custodianIdentityId: string;
  store: RecursiveMastPolicyStore;
  signedAvailabilityReceipt?: string;
}

export interface AvailabilityPolicy {
  minimumReplicas: number;
  requiredCustodians: string[];
  requireLocalCriticalBranches: boolean;
  replicationCheckInterval?: number;
  archivePreviousVersions: boolean;
}

export interface PolicyAvailabilityReport {
  policyId: string;
  checkedAt: number;

  manifestReplicas: number;
  manifestVersionsAvailable: number[];
  manifestVersionsMissing: number[];

  branchCoverage: number;
  totalBranches: number;
  availableBranches: number;
  missingBranches: string[];

  unmirroredCriticalPaths: string[];
  recoveryPathAvailable: boolean;

  meetsMinimumReplicas: boolean;
  warnings: string[];
}

export interface AuditConfig {
  policyId: string;
  replicas: PolicyStoreReplica[];
  availabilityPolicy: AvailabilityPolicy;
  criticalActions: string[];
  recoveryAction?: string;
}

export async function auditPolicyAvailability(config: AuditConfig): Promise<PolicyAvailabilityReport> {
  const { policyId, replicas, availabilityPolicy, criticalActions, recoveryAction } = config;
  const stores = replicas.map(r => r.store);
  const now = Math.floor(Date.now() / 1000);
  const warnings: string[] = [];

  let manifestReplicas = 0;
  const allVersions = new Set<number>();
  const versionReplicas = new Map<number, number>();

  for (const store of stores) {
    if (store.listManifests) {
      const versions = await store.listManifests(policyId);
      if (versions.length > 0) manifestReplicas++;
      for (const v of versions) {
        allVersions.add(v);
        versionReplicas.set(v, (versionReplicas.get(v) ?? 0) + 1);
      }
    } else {
      const m = await store.getManifest(policyId);
      if (m) {
        manifestReplicas++;
        allVersions.add(m.version);
        versionReplicas.set(m.version, (versionReplicas.get(m.version) ?? 0) + 1);
      }
    }
  }

  const manifestVersionsAvailable = [...allVersions].sort((a, b) => a - b);
  const maxVersion = manifestVersionsAvailable.length > 0
    ? manifestVersionsAvailable[manifestVersionsAvailable.length - 1]
    : 0;
  const manifestVersionsMissing: number[] = [];
  if (availabilityPolicy.archivePreviousVersions && maxVersion > 0) {
    for (let v = 1; v < maxVersion; v++) {
      if (!allVersions.has(v)) manifestVersionsMissing.push(v);
    }
  }

  if (manifestReplicas < availabilityPolicy.minimumReplicas) {
    warnings.push(
      `Manifest replicas (${manifestReplicas}) below minimum (${availabilityPolicy.minimumReplicas})`,
    );
  }

  const latestManifest = await getLatestManifest(stores, policyId);
  const policyRoot = latestManifest?.policyRoot;

  let totalBranches = 0;
  let availableBranches = 0;
  const missingBranches: string[] = [];
  const unmirroredCriticalPaths: string[] = [];

  if (policyRoot && latestManifest) {
    const allBranchHashes = new Set<string>();
    const branchReplicas = new Map<string, number>();

    for (const store of stores) {
      if (store.listBranches) {
        const summaries = await store.listBranches(policyRoot, { activeOnly: true, now });
        for (const s of summaries) {
          allBranchHashes.add(s.scriptHash);
          branchReplicas.set(s.scriptHash, (branchReplicas.get(s.scriptHash) ?? 0) + 1);
        }
      }
    }

    totalBranches = allBranchHashes.size;

    for (const hash of allBranchHashes) {
      const replicas_ = branchReplicas.get(hash) ?? 0;
      if (replicas_ > 0) {
        availableBranches++;
      } else {
        missingBranches.push(hash);
      }
    }

    for (const action of criticalActions) {
      let found = false;
      for (const store of stores) {
        if (store.listBranches) {
          const summaries = await store.listBranches(policyRoot, { action, activeOnly: true, now });
          if (summaries.length > 0) {
            found = true;
            break;
          }
        }
      }
      if (!found) {
        unmirroredCriticalPaths.push(action);
      }
    }
  }

  let recoveryPathAvailable = false;
  if (recoveryAction && policyRoot) {
    for (const store of stores) {
      if (store.listBranches) {
        const summaries = await store.listBranches(policyRoot, {
          action: recoveryAction,
          activeOnly: true,
          now,
        });
        if (summaries.length > 0) {
          recoveryPathAvailable = true;
          break;
        }
      }
    }
  }

  if (!recoveryPathAvailable && recoveryAction) {
    warnings.push(`Recovery path "${recoveryAction}" not available in any store`);
  }

  if (unmirroredCriticalPaths.length > 0) {
    warnings.push(
      `Critical paths not mirrored: ${unmirroredCriticalPaths.join(', ')}`,
    );
  }

  if (availabilityPolicy.requireLocalCriticalBranches && unmirroredCriticalPaths.length > 0) {
    warnings.push('Local critical branches required but some are missing');
  }

  const branchCoverage = totalBranches > 0 ? availableBranches / totalBranches : 1;

  return {
    policyId,
    checkedAt: now,
    manifestReplicas,
    manifestVersionsAvailable,
    manifestVersionsMissing,
    branchCoverage,
    totalBranches,
    availableBranches,
    missingBranches,
    unmirroredCriticalPaths,
    recoveryPathAvailable,
    meetsMinimumReplicas: manifestReplicas >= availabilityPolicy.minimumReplicas,
    warnings,
  };
}

async function getLatestManifest(
  stores: RecursiveMastPolicyStore[],
  policyId: string,
): Promise<RecursiveMastPolicyManifest | null> {
  let latest: RecursiveMastPolicyManifest | null = null;
  for (const store of stores) {
    const m = await store.getManifest(policyId);
    if (m && (!latest || m.version > latest.version)) {
      latest = m;
    }
  }
  return latest;
}

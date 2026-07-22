/**
 * In-memory policy store implementation of RecursiveMastPolicyStore.
 *
 * Suitable for testing, embedded devices, and single-process deployments.
 * Optionally persists to a local filesystem directory as JSON files.
 */

import type { RecursiveMastPolicyManifest } from './policy-manifest.js';
import type { MastBranchPackage, BranchFilter, MastBranchSummary } from './branch-capsule.js';
import type { RecursiveMastPolicyStore, MirrorResult } from './policy-store.js';
import { policyManifestKey, proofKey, bundleKey, computeBundleHash } from './content-keys.js';
import { branchSummary } from './branch-capsule.js';

export interface MemoryStoreOptions {
  persistPath?: string;
}

export class MemoryPolicyStore implements RecursiveMastPolicyStore {
  private manifests = new Map<string, RecursiveMastPolicyManifest>();
  private branches = new Map<string, MastBranchPackage>();
  private bundles = new Map<string, { manifest: RecursiveMastPolicyManifest; branches: MastBranchPackage[] }>();
  private options: MemoryStoreOptions;

  constructor(options: MemoryStoreOptions = {}) {
    this.options = options;
  }

  async putManifest(manifest: RecursiveMastPolicyManifest): Promise<string> {
    const key = policyManifestKey(manifest.policyId, manifest.version).key;
    this.manifests.set(key, manifest);
    await this.maybePersist();
    return key;
  }

  async getManifest(policyId: string, version?: number): Promise<RecursiveMastPolicyManifest | null> {
    if (version !== undefined) {
      return this.manifests.get(policyManifestKey(policyId, version).key) ?? null;
    }
    let latest: RecursiveMastPolicyManifest | null = null;
    for (const [key, m] of this.manifests) {
      if (key.startsWith(`policy:${policyId}:manifest:`)) {
        if (!latest || m.version > latest.version) {
          latest = m;
        }
      }
    }
    return latest;
  }

  async putBranch(branch: MastBranchPackage): Promise<string> {
    const key = proofKey(branch.policyRoot, branch.scriptHash).key;
    this.branches.set(key, branch);
    await this.maybePersist();
    return key;
  }

  async getBranch(policyRoot: string, scriptHash: string): Promise<MastBranchPackage | null> {
    return this.branches.get(proofKey(policyRoot, scriptHash).key) ?? null;
  }

  async listBranches(policyRoot: string, filter?: BranchFilter): Promise<MastBranchSummary[]> {
    const results: MastBranchSummary[] = [];
    const now = filter?.now ?? Math.floor(Date.now() / 1000);

    for (const [key, branch] of this.branches) {
      if (!key.startsWith(`proof:${policyRoot}:`)) continue;

      if (filter?.action && branch.action !== filter.action) continue;
      if (filter?.role && branch.role !== filter.role) continue;
      if (filter?.minVersion && branch.policyVersion < filter.minVersion) continue;
      if (filter?.minEpoch && branch.policyEpoch < filter.minEpoch) continue;

      if (filter?.activeOnly) {
        if (branch.validFrom > now) continue;
        if (branch.expiresAt && branch.expiresAt < now) continue;
      }

      results.push(branchSummary(branch));
    }

    return results;
  }

  async putBundle(
    manifest: RecursiveMastPolicyManifest,
    branches: MastBranchPackage[],
  ): Promise<string> {
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
    const branchBytes = branches.map(b => new TextEncoder().encode(JSON.stringify(b)));
    const hash = computeBundleHash(manifestBytes, branchBytes);
    const key = bundleKey(hash).key;
    this.bundles.set(key, { manifest, branches });
    await this.maybePersist();
    return key;
  }

  async getBundle(bundleHash: string): Promise<{
    manifest: RecursiveMastPolicyManifest;
    branches: MastBranchPackage[];
  } | null> {
    return this.bundles.get(bundleKey(bundleHash).key) ?? null;
  }

  async mirrorPolicy(
    policyId: string,
    destination: RecursiveMastPolicyStore,
  ): Promise<MirrorResult> {
    const result: MirrorResult = {
      source: 'memory',
      destination: 'destination',
      manifestsCopied: 0,
      branchesCopied: 0,
      bundlesCopied: 0,
      errors: [],
    };

    for (const [key, manifest] of this.manifests) {
      if (key.startsWith(`policy:${policyId}:manifest:`)) {
        try {
          await destination.putManifest(manifest);
          result.manifestsCopied++;
        } catch (e) {
          result.errors.push(`manifest ${key}: ${String(e)}`);
        }
      }
    }

    for (const [key, branch] of this.branches) {
      if (branch.policyId === policyId) {
        try {
          await destination.putBranch(branch);
          result.branchesCopied++;
        } catch (e) {
          result.errors.push(`branch ${key}: ${String(e)}`);
        }
      }
    }

    for (const [key, bundle] of this.bundles) {
      if (bundle.manifest.policyId === policyId) {
        try {
          await destination.putBundle(bundle.manifest, bundle.branches);
          result.bundlesCopied++;
        } catch (e) {
          result.errors.push(`bundle ${key}: ${String(e)}`);
        }
      }
    }

    return result;
  }

  async hasManifest(policyId: string, version?: number): Promise<boolean> {
    if (version !== undefined) {
      return this.manifests.has(policyManifestKey(policyId, version).key);
    }
    for (const key of this.manifests.keys()) {
      if (key.startsWith(`policy:${policyId}:manifest:`)) return true;
    }
    return false;
  }

  async hasBranch(policyRoot: string, scriptHash: string): Promise<boolean> {
    return this.branches.has(proofKey(policyRoot, scriptHash).key);
  }

  async listManifests(policyId: string): Promise<number[]> {
    const versions: number[] = [];
    for (const [key, m] of this.manifests) {
      if (key.startsWith(`policy:${policyId}:manifest:`)) {
        versions.push(m.version);
      }
    }
    return versions.sort((a, b) => a - b);
  }

  async deleteManifest(policyId: string, version: number): Promise<void> {
    this.manifests.delete(policyManifestKey(policyId, version).key);
    await this.maybePersist();
  }

  async deleteBranch(policyRoot: string, scriptHash: string): Promise<void> {
    this.branches.delete(proofKey(policyRoot, scriptHash).key);
    await this.maybePersist();
  }

  private async maybePersist(): Promise<void> {
    if (!this.options.persistPath) return;
    const fs = await import('fs/promises');
    const path = await import('path');
    const dir = this.options.persistPath;
    await fs.mkdir(dir, { recursive: true });

    const manifestsObj: Record<string, unknown> = {};
    for (const [k, v] of this.manifests) manifestsObj[k] = v;
    await fs.writeFile(path.join(dir, 'manifests.json'), JSON.stringify(manifestsObj));

    const branchesObj: Record<string, unknown> = {};
    for (const [k, v] of this.branches) {
      branchesObj[k] = { ...v, proof: Array.from(v.proof) };
    }
    await fs.writeFile(path.join(dir, 'branches.json'), JSON.stringify(branchesObj));

    const bundlesObj: Record<string, unknown> = {};
    for (const [k, v] of this.bundles) {
      bundlesObj[k] = {
        manifest: v.manifest,
        branches: v.branches.map(b => ({ ...b, proof: Array.from(b.proof) })),
      };
    }
    await fs.writeFile(path.join(dir, 'bundles.json'), JSON.stringify(bundlesObj));
  }
}

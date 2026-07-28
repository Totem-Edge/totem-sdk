/**
 * RecursiveMastPolicyStore — storage interface for policy material.
 *
 * The core package defines an interface rather than forcing one storage
 * provider. Implementations can use memory, local filesystem, Hypercore,
 * HTTP, or any custom enterprise adapter.
 *
 * Content-addressed keys (see content-keys.ts):
 *   policy:<policyId>:manifest:<version>
 *   script:<scriptHash>
 *   proof:<policyRoot>:<scriptHash>
 *   bundle:<bundleHash>
 */

import type { RecursiveMastPolicyManifest } from './policy-manifest.js';
import type { MastBranchPackage, BranchFilter, MastBranchSummary } from './branch-capsule.js';

export interface MirrorResult {
  source: string;
  destination: string;
  manifestsCopied: number;
  branchesCopied: number;
  bundlesCopied: number;
  errors: string[];
}

export interface RecursiveMastPolicyStore {
  putManifest(manifest: RecursiveMastPolicyManifest): Promise<string>;

  getManifest(
    policyId: string,
    version?: number,
  ): Promise<RecursiveMastPolicyManifest | null>;

  putBranch(branch: MastBranchPackage): Promise<string>;

  getBranch(
    policyRoot: string,
    scriptHash: string,
  ): Promise<MastBranchPackage | null>;

  listBranches?(
    policyRoot: string,
    filter?: BranchFilter,
  ): Promise<MastBranchSummary[]>;

  putBundle(
    manifest: RecursiveMastPolicyManifest,
    branches: MastBranchPackage[],
  ): Promise<string>;

  getBundle(bundleHash: string): Promise<{
    manifest: RecursiveMastPolicyManifest;
    branches: MastBranchPackage[];
  } | null>;

  mirrorPolicy?(
    policyId: string,
    destination: RecursiveMastPolicyStore,
  ): Promise<MirrorResult>;

  hasManifest?(policyId: string, version?: number): Promise<boolean>;

  hasBranch?(policyRoot: string, scriptHash: string): Promise<boolean>;

  listManifests?(policyId: string): Promise<number[]>;

  deleteManifest?(policyId: string, version: number): Promise<void>;

  deleteBranch?(policyRoot: string, scriptHash: string): Promise<void>;
}

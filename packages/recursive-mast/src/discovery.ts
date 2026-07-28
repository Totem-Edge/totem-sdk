/**
 * Policy Discovery — announce, query, resolve, and watch policy manifests
 * through the Totem lookup network.
 *
 * Uses @totemsdk/lookup-client for transport. The discovery module is
 * transport-agnostic — the caller provides the lookup client.
 *
 * Discovery messages:
 *   POLICY_ANNOUNCE  — publish a policy manifest to the network
 *   POLICY_QUERY     — search for policies by subject, capability, or authority
 *   POLICY_RESULT    — query results
 *   POLICY_WATCH     — subscribe to policy updates (epoch changes, rotations)
 *   POLICY_UPDATE    — notification of a policy change
 */

import type { RecursiveMastPolicyManifest } from './policy-manifest.js';

// ─── Lookup client interface (minimal, transport-agnostic) ─────────────────

export interface PolicyLookupClient {
  /** Announce a policy manifest to the network. */
  announcePolicy(manifest: Uint8Array, metadata: {
    policyId: string;
    subjectId: string;
    policyRoot: string;
    policyVersion: number;
    policyEpoch: number;
    authorityIdentityId: string;
    capabilities: string[];
    expiresAt: number;
  }): Promise<void>;

  /** Query the network for policies. */
  queryPolicies(params: {
    policyId?: string;
    subjectId?: string;
    policyRoot?: string;
    authorityIdentityId?: string;
    capability?: string;
    minVersion?: number;
    minEpoch?: number;
    activeOnly?: boolean;
    limit?: number;
  }): Promise<PolicyQueryResult[]>;

  /** Watch for policy updates. */
  watchPolicy(policyId: string, afterEpoch: number, onUpdate: (update: PolicyUpdateNotification) => void): () => void;
}

export interface PolicyQueryResult {
  policyId: string;
  policyRoot: string;
  policyVersion: number;
  policyEpoch: number;
  manifest: Uint8Array;
  nodeId: string;
  expiresAt: number;
}

export interface PolicyUpdateNotification {
  policyId: string;
  previousRoot?: string;
  currentRoot: string;
  policyVersion: number;
  policyEpoch: number;
  manifest: Uint8Array;
}

// ─── Announce ──────────────────────────────────────────────────────────────

export interface AnnouncePolicyConfig {
  manifest: RecursiveMastPolicyManifest;
  manifestBytes: Uint8Array;
  capabilities: string[];
  expiresAt: number;
}

/**
 * Announce a policy manifest to the lookup network.
 */
export async function announcePolicy(
  client: PolicyLookupClient,
  config: AnnouncePolicyConfig,
): Promise<void> {
  await client.announcePolicy(config.manifestBytes, {
    policyId: config.manifest.policyId,
    subjectId: config.manifest.subject.id,
    policyRoot: config.manifest.policyRoot,
    policyVersion: config.manifest.version,
    policyEpoch: config.manifest.epoch,
    authorityIdentityId: config.manifest.authorityPkd ?? '',
    capabilities: config.capabilities,
    expiresAt: config.expiresAt,
  });
}

// ─── Query ─────────────────────────────────────────────────────────────────

export interface QueryPolicyConfig {
  /** Find a specific policy by ID. */
  policyId?: string;
  /** Find policies for a specific subject (vehicle, machine, device). */
  subjectId?: string;
  /** Find policies by root hash. */
  policyRoot?: string;
  /** Find policies by authority identity. */
  authorityIdentityId?: string;
  /** Find policies supporting a specific capability. */
  capability?: string;
  /** Minimum policy version. */
  minVersion?: number;
  /** Minimum policy epoch. */
  minEpoch?: number;
  /** Only return active (non-expired, non-revoked) policies. */
  activeOnly?: boolean;
  /** Maximum number of results. */
  limit?: number;
}

/**
 * Query the lookup network for policies.
 */
export async function queryPolicies(
  client: PolicyLookupClient,
  config: QueryPolicyConfig,
): Promise<PolicyQueryResult[]> {
  return client.queryPolicies({
    policyId: config.policyId,
    subjectId: config.subjectId,
    policyRoot: config.policyRoot,
    authorityIdentityId: config.authorityIdentityId,
    capability: config.capability,
    minVersion: config.minVersion,
    minEpoch: config.minEpoch,
    activeOnly: config.activeOnly,
    limit: config.limit,
  });
}

// ─── Resolve ───────────────────────────────────────────────────────────────

export interface ResolvePolicyConfig {
  /** The subject to resolve a policy for. */
  subjectId: string;
  /** The action to resolve a policy for. */
  action: string;
  /** Minimum acceptable policy version. */
  minVersion?: number;
  /** Minimum acceptable policy epoch. */
  minEpoch?: number;
}

export interface ResolvedPolicy {
  manifest: RecursiveMastPolicyManifest;
  queryResult: PolicyQueryResult;
  /** Whether the resolved policy is current (epoch matches latest). */
  current: boolean;
}

/**
 * Resolve the current policy for a subject and action.
 *
 * Queries the lookup network, filters by capability matching the action,
 * and returns the highest-epoch active policy.
 */
export async function resolvePolicyForSubject(
  client: PolicyLookupClient,
  config: ResolvePolicyConfig,
): Promise<ResolvedPolicy | null> {
  const results = await client.queryPolicies({
    subjectId: config.subjectId,
    capability: config.action,
    minVersion: config.minVersion,
    minEpoch: config.minEpoch,
    activeOnly: true,
    limit: 10,
  });

  if (results.length === 0) return null;

  // Return the highest-epoch result
  const best = results.reduce((a, b) => (a.policyEpoch > b.policyEpoch ? a : b));

  // Parse the manifest from the result
  const manifestBytes = best.manifest;
  let manifest: RecursiveMastPolicyManifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as RecursiveMastPolicyManifest;
  } catch {
    return null;
  }

  return {
    manifest,
    queryResult: best,
    current: true, // Caller should verify against anchor coin
  };
}

// ─── Watch ─────────────────────────────────────────────────────────────────

export interface WatchPolicyConfig {
  /** The policy to watch. */
  policyId: string;
  /** Only notify for epochs after this value. */
  afterEpoch?: number;
  /** Called when the policy is updated. */
  onUpdate: (update: PolicyUpdateNotification) => void;
}

/**
 * Watch a policy for updates (epoch changes, rotations, revocations).
 * Returns an unsubscribe function.
 */
export function watchPolicy(
  client: PolicyLookupClient,
  config: WatchPolicyConfig,
): () => void {
  return client.watchPolicy(config.policyId, config.afterEpoch ?? 0, config.onUpdate);
}
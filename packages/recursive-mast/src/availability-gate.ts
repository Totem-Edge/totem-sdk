/**
 * @module @totemsdk/recursive-mast/availability-gate
 *
 * Availability **enforcement** for recursive MAST policy repositories
 * (RFC-007 Phase 5), built on the diagnostic `auditPolicyAvailability`.
 *
 * The gate refuses to authorize a *content* action whose script material
 * cannot be retrieved from any replica — a policy branch that nobody can fetch
 * cannot be verified, so the operation is fail-closed.
 *
 * The **cycle guard** (RFC-007 §5): recursive MAST policy material is itself
 * content-addressed, so gating *recovery* on the availability of the content
 * it exists to restore is a deadlock. Recovery therefore has an explicit,
 * separate availability policy and is NEVER gated by content availability:
 * a recovery action proceeds even when every content branch is missing, and
 * its own under-replication is reported (`recoveryUnderReplicated`) rather
 * than turned into a denial. Recovery is never silently failed-open — callers
 * that require recovery material independently assert it before proceeding —
 * and content authorization is never weakened.
 */

import type {
  AvailabilityPolicy,
  PolicyAvailabilityReport,
  PolicyStoreReplica,
} from './availability.js';
import { auditPolicyAvailability } from './availability.js';

export type AvailabilityGateKind = 'content' | 'recovery';

/** Explicit availability policy for the recovery path, separate from content authorization. */
export interface RecoveryAvailabilityPolicy {
  /**
   * Minimum replicas that must hold the recovery branch. Reported for
   * operators; **never** used to deny a recovery operation (that would
   * reintroduce the cycle the gate exists to break).
   */
  readonly minimumRecoveryReplicas?: number;
}

export interface AvailabilityGateConfig {
  readonly policyId: string;
  readonly replicas: PolicyStoreReplica[];
  readonly availabilityPolicy: AvailabilityPolicy;
  /** The action being authorized (a content action, or the recovery action). */
  readonly action: string;
  /** Default `'content'`; `'recovery'` is exempt from the content availability gate. */
  readonly kind?: AvailabilityGateKind;
  readonly recoveryPolicy?: RecoveryAvailabilityPolicy;
  /** Injectable clock (seconds). */
  readonly now?: number;
}

export interface AvailabilityGateDecision {
  /** Whether the operation may proceed. Always `true` for a recovery action. */
  readonly allowed: boolean;
  readonly reason: string;
  readonly action: string;
  readonly kind: AvailabilityGateKind;
  readonly report: PolicyAvailabilityReport;
  /**
   * Advisory: the recovery path is held by fewer than the declared minimum
   * replicas. Reported for recovery (and content) evaluations; never a denial.
   */
  readonly recoveryUnderReplicated: boolean;
}

async function latestPolicyRoot(
  replicas: PolicyStoreReplica[],
  policyId: string,
): Promise<string | undefined> {
  let root: string | undefined;
  let version = -Infinity;
  for (const replica of replicas) {
    const manifest = await replica.store.getManifest(policyId);
    if (manifest && manifest.version > version) {
      version = manifest.version;
      root = manifest.policyRoot;
    }
  }
  return root;
}

async function countRecoveryReplicas(
  replicas: PolicyStoreReplica[],
  policyRoot: string | undefined,
  action: string,
  nowSeconds: number,
): Promise<number> {
  if (!policyRoot) return 0;
  let count = 0;
  for (const replica of replicas) {
    if (!replica.store.listBranches) continue;
    const summaries = await replica.store.listBranches(policyRoot, {
      action,
      activeOnly: true,
      now: nowSeconds,
    });
    if (summaries.length > 0) count++;
  }
  return count;
}

/**
 * Evaluate whether an operation may proceed under policy availability.
 *
 * - `kind: 'content'` is fail-closed: denied when the action's branch is
 *   missing from every replica, or the manifest is below the minimum replica
 *   count.
 * - `kind: 'recovery'` is never gated by content availability and always
 *   proceeds; the recovery material's own availability is reported separately.
 */
export async function evaluateAvailabilityGate(
  config: AvailabilityGateConfig,
): Promise<AvailabilityGateDecision> {
  const kind = config.kind ?? 'content';
  const nowSeconds = config.now ?? Math.floor(Date.now() / 1000);
  const isRecovery = kind === 'recovery';

  const report = await auditPolicyAvailability({
    policyId: config.policyId,
    replicas: config.replicas,
    availabilityPolicy: config.availabilityPolicy,
    criticalActions: isRecovery ? [] : [config.action],
    recoveryAction: isRecovery ? config.action : undefined,
  });

  if (isRecovery) {
    // Recovery material is tracked under its own explicit availability policy.
    const policyRoot = await latestPolicyRoot(config.replicas, config.policyId);
    const recoveryReplicas = await countRecoveryReplicas(
      config.replicas,
      policyRoot,
      config.action,
      nowSeconds,
    );
    const minRecovery = config.recoveryPolicy?.minimumRecoveryReplicas ?? 1;
    const recoveryUnderReplicated = recoveryReplicas < minRecovery;

    // Cycle guard: recovery is NEVER gated by content availability. Even a
    // missing recovery branch does not block the recovery operation — that is
    // precisely the state recovery exists to repair. The under-replication is
    // surfaced, not silently failed-open.
    return {
      allowed: true,
      reason: recoveryUnderReplicated
        ? 'recovery exempt from content gate; recovery material under-replicated (manual intervention advised)'
        : 'recovery exempt from content gate',
      action: config.action,
      kind,
      report,
      recoveryUnderReplicated,
    };
  }

  const actionUnavailable = report.unmirroredCriticalPaths.includes(config.action);
  const replicasOk = report.meetsMinimumReplicas;
  const allowed = !actionUnavailable && replicasOk;
  const reason = allowed
    ? 'content availability satisfied'
    : actionUnavailable
      ? `content branch for "${config.action}" is not available in any policy store`
      : `manifest replicas (${report.manifestReplicas}) below minimum (${config.availabilityPolicy.minimumReplicas})`;

  return {
    allowed,
    reason,
    action: config.action,
    kind,
    report,
    recoveryUnderReplicated: false,
  };
}

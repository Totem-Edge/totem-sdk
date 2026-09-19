/**
 * @module @totemsdk/intelligence/content-access
 *
 * Content-level retrieval gating (RFC-007 §5, Phase 3a).
 *
 * "Intelligence content access is not the `intelligence:rag` capability":
 * permitting the `rag` domain is not sufficient authorization to read every
 * document in a workspace. This module enforces workspace-scoped entitlements
 * BELOW the dispatch gate and ABOVE the provider call — the provider never
 * receives retrieval parameters for content the principal may not read.
 *
 * Enforcement mechanism: **isolated workspaces** + **verified filtering**.
 * Each principal is entitled to a set of `workspaceId`s; `ragSearch` (and every
 * workspace-scoped write/lifecycle op) is either rewritten to one of those
 * workspaces or denied before the provider is invoked. Revocation is a policy
 * change only — it never fires `ragDeleteEmbeddings`/`ragDeleteWorkspace`/
 * `ragReindex` or any destructive cleanup (revocation ≠ deletion, §3.5), and
 * revoking one principal never touches other principals' embeddings or a shared
 * workspace.
 *
 * Freshness/offline policy: the enforcement surface declares how stale the
 * observed entitlement snapshot may be before denial (fail-closed).
 */

import type { IntelligenceErrorCode } from './errors.js';
import { IntelligenceError } from './errors.js';
import type {
  IntelligenceContext,
  IntelligenceOperation,
  IntelligenceOutcome,
  IntelligenceProvider,
} from './types.js';

/** Workspace-scoped RAG operations the content gate governs. */
export const RAG_WORKSPACE_OPS = [
  'ragSearch',
  'ragIngest',
  'ragSaveEmbeddings',
  'ragDeleteEmbeddings',
  'ragReindex',
  'ragListWorkspaces',
  'ragCloseWorkspace',
  'ragDeleteWorkspace',
] as const;

export type RagWorkspaceOp = (typeof RAG_WORKSPACE_OPS)[number];

/** Ops that require a workspaceId in `params` (no sensible default). */
const WORKSPACE_ID_REQUIRED: ReadonlySet<string> = new Set([
  'ragDeleteWorkspace',
  'ragCloseWorkspace',
]);

/** Delete-family ops — revoked entitlements must never trigger these. */
export const RAG_DESTRUCTIVE_OPS = [
  'ragDeleteEmbeddings',
  'ragDeleteWorkspace',
  'ragCloseWorkspace',
  'ragReindex',
] as const;

/**
 * A principal's entitlement to content. Content is addressed by workspace:
 * a principal may search/ingest/lifecycle exactly the workspaces listed, and
 * nothing else.
 */
export interface ContentWorkspaceEntitlement {
  /** Principal identifier (account, agent id, purchase key). */
  principal: string;
  /** Workspace ids the principal may read and write. */
  workspaceIds: readonly string[];
}

export interface ContentAccessPolicy {
  /**
   * Latest authoritative entitlement snapshot. Change this to revoke —
   * retrieval is gated once the change is observed; no cleanup follows.
   */
  entitlements: readonly ContentWorkspaceEntitlement[];
  /** Wall-clock time `entitlements` was observed (defaults to `now` at use). */
  observedAt?: number;
  /**
   * Freshness/offline policy: how stale the snapshot may be before denial.
   * When `freshnessMs` is set and `now - observedAt > freshnessMs`, protected
   * ops are denied (fail-closed while offline/stale).
   */
  freshnessMs?: number;
  /** Injectable clock (defaults to `Date.now`). */
  now?: () => number;
  /** Diagnostic hook invoked on every denial. */
  onDeny?: (principal: string | undefined, op: string, reason: string) => void;
}

export interface ContentAccessDecision {
  allowed: boolean;
  reason?: string;
  /** The effective `workspaceId` (rewritten when the op left it unset). */
  workspaceId?: string;
  /** Ops to forward to the provider with workspace scoping applied. */
  params?: Record<string, unknown>;
}

/** Code for content-access denials. */
export const CONTENT_DENY_CODE: IntelligenceErrorCode = 'POLICY_REJECTED';

function principalOf(context: IntelligenceContext | undefined): string | undefined {
  const principal = context?.principal;
  return typeof principal === 'string' && principal.length > 0 ? principal : undefined;
}

function workspaceIdOf(params: Record<string, unknown>): string | undefined {
  const ws = params.workspaceId;
  return typeof ws === 'string' && ws.length > 0 ? ws : undefined;
}

function isWorkspaceOp(op: string): boolean {
  return (RAG_WORKSPACE_OPS as readonly string[]).includes(op);
}

function isGatedOp(domain: string, op: string): boolean {
  return domain === 'rag' && isWorkspaceOp(op);
}

/**
 * Decide whether a RAG operation may proceed for the calling principal.
 *
 * Purely a policy function — no provider interaction. Returns the effective
 * params (with `workspaceId` rewritten when the caller left it unset and has
 * exactly one entitled workspace, so the provider never sees an un-scoped
 * retrieval) or a denial.
 */
export function evaluateContentAccess(
  policy: ContentAccessPolicy,
  domain: string,
  op: string,
  params: Record<string, unknown>,
  context: IntelligenceContext | undefined,
): ContentAccessDecision {
  if (!isGatedOp(domain, op)) return { allowed: true, params };

  const now = nowOf(policy);
  const observedAt = policy.observedAt ?? now;
  const principal = principalOf(context);
  if (principal === undefined) {
    return deny(policy, principal, op, `content access requires a principal in op.context.principal`);
  }

  if (policy.freshnessMs !== undefined && policy.freshnessMs >= 0 && now - observedAt > policy.freshnessMs) {
    return deny(
      policy,
      principal,
      op,
      `entitlement snapshot is ${now - observedAt}ms stale (freshness ${policy.freshnessMs}ms) — failing closed while stale/offline`,
    );
  }

  const entitlement = policy.entitlements.find((e) => e.principal === principal);
  const entitled = entitlement?.workspaceIds ?? [];
  if (!entitlement || entitled.length === 0) {
    return deny(policy, principal, op, `principal '${principal}' has no content entitlement`);
  }

  const ws = workspaceIdOf(params);
  if (ws !== undefined && !entitled.includes(ws)) {
    return deny(policy, principal, op, `workspace '${ws}' is not entitled to principal '${principal}'`);
  }

  const required = WORKSPACE_ID_REQUIRED.has(op);
  if (ws === undefined) {
    if (required) {
      return deny(policy, principal, op, `workspace-scoped op '${op}' requires an entitled workspaceId`);
    }
    if (entitled.length !== 1) {
      return deny(
        policy,
        principal,
        op,
        `op '${op}' must select exactly one of the entitled workspaces: ${entitled.join(', ')}`,
      );
    }
    // Isolated-workspace enforcement: force the single entitled workspace so
    // the provider never receives retrieval params for un-entitled content.
    return { allowed: true, workspaceId: entitled[0], params: { ...params, workspaceId: entitled[0] } };
  }

  return { allowed: true, workspaceId: ws, params };
}

function deny(
  policy: ContentAccessPolicy,
  principal: string | undefined,
  op: string,
  reason: string,
): ContentAccessDecision {
  policy.onDeny?.(principal, op, reason);
  return { allowed: false, reason };
}

function nowOf(policy: ContentAccessPolicy): number {
  return policy.now?.() ?? Date.now();
}

/**
 * Wrap a provider with workspace-scoped content gating (RFC-007 §5).
 *
 * The returned provider keeps the host provider's id/capabilities/cancel/close
 * and forwards only gated RAG operations. Denials are returned as
 * `POLICY_REJECTED` results — never by touching provider storage.
 *
 * @example
 *   const gated = createContentAccessGatedProvider(
 *     { entitlements: [{ principal: 'P1', workspaceIds: ['ws-Fleet'] }], freshnessMs: 60_000 },
 *     createQvacIntelligenceProvider({ sdk }),
 *   );
 */
export function createContentAccessGatedProvider(
  policy: ContentAccessPolicy,
  provider: IntelligenceProvider,
): IntelligenceProvider {
  return {
    id: provider.id,
    displayName: provider.displayName,
    version: provider.version,
    capabilities: provider.capabilities,
    isReady: provider.isReady,

    async invoke<T = unknown>(op: IntelligenceOperation<T>): Promise<IntelligenceOutcome<T>> {
      const params = op.params ?? {};
      if (!isGatedOp(op.domain, op.op)) {
        return provider.invoke(op);
      }
      const decision = evaluateContentAccess(policy, op.domain, op.op, params, op.context);
      if (!decision.allowed) {
        const requestId = op.requestId ?? '(none)';
        return {
          ok: false,
          requestId,
          code: CONTENT_DENY_CODE,
          message: decision.reason ?? 'content access denied',
          retryable: false,
        } as const;
      }
      const outcome = await provider.invoke({
        ...op,
        params: decision.params ?? params,
      } as IntelligenceOperation<T>);
      if (outcome.ok && op.op === 'ragSearch') {
        return {
          ...outcome,
          data: filterSearchResults(outcome.data, decision.workspaceId),
        };
      }
      return outcome;
    },

    async *invokeStream(op) {
      if (op.domain === 'rag') {
        // Streaming surfaces are not workspace-scoped content ops.
        throw new IntelligenceError(
          'NOT_IMPLEMENTED',
          `Streaming operation '${op.op}' is not available through the content-access gate.`,
        );
      }
      yield* provider.invokeStream(op);
    },

    cancel(requestId: string) {
      return provider.cancel(requestId);
    },

    close() {
      return provider.close();
    },
  };
}

/**
 * Defense-in-depth result filtering: drop search hits whose result payload
 * explicitly claims a workspace outside the entitled set. Primary enforcement
 * is the workspace-scoped request; this guards against a provider that
 * returns cross-workspace records.
 */
function filterSearchResults<T>(data: T, entitledWorkspaceId: string | undefined): T {
  if (!Array.isArray(data)) return data;
  if (entitledWorkspaceId === undefined) return data;
  const kept = (data as unknown[]).filter((result) => {
    const doc = (result as { doc?: unknown } | null)?.doc;
    if (doc === null || typeof doc !== 'object') return true;
    const o = doc as Record<string, unknown>;
    const meta = typeof o.metadata === 'object' && o.metadata !== null
      ? (o.metadata as Record<string, unknown>)
      : undefined;
    const claimed = typeof o.workspaceId === 'string'
      ? o.workspaceId
      : typeof meta?.workspaceId === 'string'
        ? meta.workspaceId
        : undefined;
    return claimed === undefined || claimed === entitledWorkspaceId;
  });
  return kept as T;
}
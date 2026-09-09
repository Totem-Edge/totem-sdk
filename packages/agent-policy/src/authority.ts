import type { AgentProposal, PolicyEvalResult, PolicyMiddleware } from './types.js';
import type { AuthorityDecision } from '@totemsdk/authority';

/**
 * Action intent extracted from an AgentProposal for authority evaluation.
 */
export interface AuthorityActionIntent {
  action: string;
  principal: string;
  agent: string;
  target?: string;
  constraints?: Record<string, unknown>;
  nonce?: string;
}

/**
 * Full authority evaluation result — the complete `AuthorityDecision` plus the
 * usage delta it implies. Never reduced to a boolean.
 */
export interface AuthorityDecisionResult {
  decision: AuthorityDecision;
  usageDelta: { count: number; amount?: string };
}

/**
 * Authority evaluation interface — the caller injects their authority engine
 * (e.g. `@totemsdk/authority`'s `evaluateAuthority`).
 */
export interface AuthorityEvaluator {
  evaluate(params: {
    action: AuthorityActionIntent;
    now: number;
  }): Promise<AuthorityDecisionResult>;
}

export interface AuthorityPolicyOptions {
  /**
   * When true, a proposal without an authenticated `proposal.principal` is
   * rejected outright. When false, the extractor falls back to `agentId`.
   */
  strictPrincipal?: boolean;
  /** Injectable clock (defaults to Date.now). */
  now?: () => number;
}

/**
 * AuthorityPolicy — bridges PolicyMiddleware evaluation with mandate-based
 * authority verification.
 *
 * Corrected bridge:
 *  - uses the authenticated `proposal.principal` (never `agentId` as principal);
 *  - preserves the real action namespace (no synthesized `payment:*`);
 *  - returns the full `AuthorityDecision` + usage delta, not a boolean;
 *  - binds the decision to the proposal id as the intent nonce.
 *
 * Insert this layer into a ComposablePolicy pipeline to ensure every proposal
 * is backed by a valid mandate before it is approved.
 */
export class AuthorityPolicy implements PolicyMiddleware {
  private readonly evaluator: AuthorityEvaluator;
  private readonly extractAction: (proposal: AgentProposal) => AuthorityActionIntent;
  private readonly strictPrincipal: boolean;
  private readonly now: () => number;

  constructor(
    evaluator: AuthorityEvaluator,
    extractAction?: (proposal: AgentProposal) => AuthorityActionIntent,
    options?: AuthorityPolicyOptions,
  ) {
    this.evaluator = evaluator;
    this.extractAction = extractAction ?? defaultActionExtractor;
    this.strictPrincipal = options?.strictPrincipal ?? true;
    this.now = options?.now ?? (() => Date.now());
  }

  async evaluate(proposal: AgentProposal, now = this.now()): Promise<PolicyEvalResult> {
    if (this.strictPrincipal && !proposal.principal) {
      return {
        outcome: 'rejected',
        reason: 'AuthorityPolicy requires an authenticated proposal.principal',
      };
    }

    const action = this.extractAction(proposal);
    const { decision, usageDelta } = await this.evaluator.evaluate({ action, now });

    if (decision.allowed) {
      return {
        outcome: 'approved',
        reason: decision.reason ?? 'Authority approved',
        authorityDecision: decision,
        usageDelta,
      };
    }
    return {
      outcome: 'rejected',
      reason: decision.reason ?? 'Authority denied — no valid mandate',
      authorityDecision: decision,
      usageDelta,
    };
  }
}

/**
 * Map an intent type to its real action namespace. The intent type IS the
 * action — no `payment:*` synthesis.
 */
export function intentAction(type: string): string {
  return type;
}

/**
 * Default mapping: AgentProposal → AuthorityActionIntent.
 *
 * The action is the intent type itself. The principal is the authenticated
 * `proposal.principal` (falling back to `agentId` only when strict mode is
 * off). The target is the recipient. Intent fields and metadata are exposed
 * as constraints so dotted paths (`payload.*`) resolve via
 * `@totemsdk/authority`'s `resolveActionField`.
 */
export function defaultActionExtractor(proposal: AgentProposal): AuthorityActionIntent {
  const principal = proposal.principal ?? proposal.agentId;
  return {
    action: intentAction(proposal.intent.type),
    principal,
    agent: proposal.agentId,
    target: proposal.intent.recipient,
    constraints: {
      amount: proposal.intent.amount,
      tokenId: proposal.intent.tokenId,
      risk: proposal.intent.risk,
      ...(proposal.intent.metadata ?? {}),
    } as Record<string, unknown>,
    nonce: proposal.id,
  };
}

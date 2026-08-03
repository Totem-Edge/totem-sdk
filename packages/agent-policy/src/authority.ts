import type { AgentProposal, PolicyEvalResult, PolicyMiddleware } from './types.js';

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
 * Minimal authority evaluation interface — the caller injects their
 * authority engine (e.g. `@totemsdk/authority`'s `evaluateAuthority`).
 *
 * This keeps `@totemsdk/agent-policy` free of a hard dependency on
 * `@totemsdk/authority`.
 */
export interface AuthorityEvaluator {
  evaluate(params: {
    action: AuthorityActionIntent;
    now: number;
  }): Promise<{ allowed: boolean; reason?: string }>;
}

/**
 * AuthorityPolicy — bridges PolicyMiddleware evaluation with mandate-based
 * authority verification.
 *
 * Insert this layer into a ComposablePolicy pipeline to ensure every
 * proposal is backed by a valid mandate before it is approved.
 *
 * The caller provides an `AuthorityEvaluator` that encapsulates the
 * full mandate verification (crypto, scope, constraints, usage limits).
 *
 * @example
 * ```ts
 * import { evaluateAuthority } from '@totemsdk/authority';
 *
 * const authorityCheck = new AuthorityPolicy({
 *   async evaluate({ action, now }) {
 *     const { decision } = evaluateAuthority({ ... });
 *     return { allowed: decision.allowed, reason: decision.reason };
 *   },
 * });
 *
 * const policy = new ComposablePolicy([
 *   new RateLimitPolicy(10, 60_000),
 *   authorityCheck,
 * ]);
 * ```
 */
export class AuthorityPolicy implements PolicyMiddleware {
  private readonly evaluator: AuthorityEvaluator;

  /**
   * @param extractAction  Optional function to map AgentProposal → ActionIntent.
   *                       Default extracts action from intent type + agentId.
   */
  private readonly extractAction: (proposal: AgentProposal) => AuthorityActionIntent;

  constructor(
    evaluator: AuthorityEvaluator,
    extractAction?: (proposal: AgentProposal) => AuthorityActionIntent,
  ) {
    this.evaluator = evaluator;
    this.extractAction = extractAction ?? defaultActionExtractor;
  }

  async evaluate(proposal: AgentProposal, now = Date.now()): Promise<PolicyEvalResult> {
    const action = this.extractAction(proposal);
    const result = await this.evaluator.evaluate({
      action,
      now,
    });

    if (result.allowed) {
      return { outcome: 'approved', reason: result.reason ?? 'Authority approved' };
    }
    return {
      outcome: 'rejected',
      reason: result.reason ?? 'Authority denied — no valid mandate',
    };
  }
}

/**
 * Default mapping: AgentProposal → AuthorityActionIntent.
 *
 * The action string is derived from the PaymentIntent type.
 * The agent is the proposal's agentId. The target is the recipient.
 */
function defaultActionExtractor(proposal: AgentProposal): AuthorityActionIntent {
  return {
    action: `payment:${proposal.intent.type}`,
    principal: proposal.agentId,
    agent: proposal.agentId,
    target: proposal.intent.recipient,
    constraints: {
      amount: proposal.intent.amount,
      tokenId: proposal.intent.tokenId,
      risk: proposal.intent.risk,
    } as Record<string, unknown>,
    nonce: proposal.id,
  };
}

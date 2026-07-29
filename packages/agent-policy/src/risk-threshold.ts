import type { AgentProposal, PolicyEvalResult, PolicyMiddleware } from './types.js';

/**
 * RiskThresholdPolicy — auto-approves proposals whose self-assessed
 * risk is at or below the configured threshold.
 *
 * Risk levels (lowest → highest): `low`, `medium`, `high`.
 * - threshold `low`    → only low-risk proposals are approved
 * - threshold `medium` → low- and medium-risk approved
 * - threshold `high`   → all proposals approved (pass-through)
 *
 * Proposals without a risk field are treated as `high` (maximum
 * caution), so an absent risk never sneaks past the policy.
 *
 * @example
 * ```ts
 * // Only auto-approve low-risk proposals; medium/high → requires_human
 * const risk = new RiskThresholdPolicy('low');
 * ```
 */
const RISK_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2 };

export class RiskThresholdPolicy implements PolicyMiddleware {
  private readonly maxRisk: number;

  constructor(maxRisk: 'low' | 'medium' | 'high') {
    const rank = RISK_ORDER[maxRisk];
    if (rank === undefined) {
      throw new Error(`maxRisk must be 'low', 'medium', or 'high'`);
    }
    this.maxRisk = rank;
  }

  async evaluate(proposal: AgentProposal): Promise<PolicyEvalResult> {
    const risk = proposal.intent.risk ?? 'high';
    const rank = RISK_ORDER[risk];
    if (rank === undefined) {
      return {
        outcome: 'rejected',
        reason: `Unknown risk level: ${risk}`,
      };
    }
    if (rank <= this.maxRisk) {
      return { outcome: 'approved', reason: `Risk '${risk}' within threshold` };
    }
    return {
      outcome: 'requires_human',
      reason: `Risk '${risk}' exceeds threshold — requires human approval`,
    };
  }
}

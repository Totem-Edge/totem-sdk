import type { AgentProposal, PolicyEvalResult, PolicyMiddleware } from './types.js';

/**
 * RecipientAllowlistPolicy — only allows proposals whose recipient
 * address appears in a predefined allowlist. Proposals without a
 * recipient pass through (lookups, receipts).
 *
 * Addresses are compared as case-sensitive strings. Include all
 * valid address formats (Mx-prefixed, 0x-prefixed, raw hex) that
 * your agents may use.
 *
 * @example
 * ```ts
 * const allowlist = new RecipientAllowlistPolicy([
 *   'MxABC...',   // supplier A
 *   'MxDEF...',   // supplier B
 * ]);
 * ```
 */
export class RecipientAllowlistPolicy implements PolicyMiddleware {
  private readonly allowlist: Set<string>;

  constructor(allowedAddresses: string[]) {
    this.allowlist = new Set(allowedAddresses);
  }

  async evaluate(proposal: AgentProposal): Promise<PolicyEvalResult> {
    const recipient = proposal.intent.recipient;
    if (recipient === undefined || recipient === null) {
      return { outcome: 'approved', reason: 'No recipient to check' };
    }
    if (this.allowlist.has(recipient)) {
      return { outcome: 'approved', reason: 'Recipient is allowlisted' };
    }
    return {
      outcome: 'rejected',
      reason: `Recipient ${recipient} is not in the allowlist`,
    };
  }
}

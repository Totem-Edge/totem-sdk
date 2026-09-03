/**
 * purchase-authority.ts — AuthorityPort adapter over @totemsdk/agent-policy.
 *
 * Maps a machine-commerce TradeAgreement + PurchaseIntent to an AgentProposal
 * and evaluates it through a ComposablePolicy (or any AgentPolicy).
 *
 * Architectural boundary preserved:
 *   TradeProposal  = machine ↔ machine bargaining (peer-to-peer)
 *   AgentProposal  = agent → trusted local authority (wallet/policy)
 *
 * The machine negotiation strategy never receives a private key. This adapter
 * is the trusted boundary that decides whether the local authority approves
 * the economic commitment.
 */

import type { AgentPolicy, AgentProposal, PolicyMiddleware } from '@totemsdk/agent-policy';
import type { EdgeOperationResult } from '@totemsdk/edge';
import type { PurchaseIntent, TradeAgreement } from '@totemsdk/edge';

type PolicyLike = AgentPolicy | PolicyMiddleware;

function isMiddleware(p: PolicyLike): p is PolicyMiddleware {
  return 'evaluate' in p && typeof (p as PolicyMiddleware).evaluate === 'function';
}

export interface PurchaseAuthorityAdapterConfig {
  /** The local policy (ComposablePolicy, AgentPolicy, or PolicyMiddleware). */
  policy: PolicyLike;
  /** Agent identifier used in the AgentProposal (e.g. 'edge-purchase-agent'). */
  agentId?: string;
  /** Optional risk level for the proposal. */
  risk?: 'low' | 'medium' | 'high';
}

/**
 * Create an AuthorityPort adapter over an agent-policy.
 *
 * approve() builds an AgentProposal from the agreement + intent and evaluates
 * it through the policy. Returns `{ allowed, reason }`.
 */
export function createPurchaseAuthorityAdapter(
  config: PurchaseAuthorityAdapterConfig,
): {
  approve(params: {
    agreement: TradeAgreement;
    intent: PurchaseIntent;
  }): Promise<EdgeOperationResult<{ allowed: boolean; reason?: string }>>;
} {
  const { policy } = config;
  const agentId = config.agentId ?? 'edge-purchase-agent';
  const risk = config.risk ?? 'medium';

  return {
    async approve(params) {
      try {
        const { agreement, intent } = params;

        const proposal: AgentProposal = {
          id: `edge-purchase:${agreement.agreementId}`,
          agentId,
          intent: {
            type: 'payment',
            amount: agreement.terms.price,
            tokenId: agreement.terms.tokenId,
            recipient: agreement.seller,
            reason: `purchase ${intent.resource} from ${agreement.seller}`,
            risk,
            metadata: {
              agreementId: agreement.agreementId,
              negotiationId: agreement.negotiationId,
              resource: intent.resource,
            },
          },
          explanation: `Machine purchase of ${intent.resource} for ${agreement.terms.price} ${agreement.terms.tokenId ?? '0x00'} from ${agreement.seller}`,
          confidence: 1,
          createdAt: Date.now(),
        };

        if (isMiddleware(policy)) {
          const result = await policy.evaluate(proposal);
          return {
            ok: true,
            data: {
              allowed: result.outcome === 'approved',
              reason: result.reason,
            },
          };
        }

        const allowed = await policy.canAutoApprove(proposal);
        return {
          ok: true,
          data: {
            allowed,
            reason: allowed ? undefined : 'Purchase requires user approval per configured policy',
          },
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

import type { AgentPolicy, AgentProposal, PolicyMiddleware } from '@totemsdk/agent-policy';
import type { EdgePolicyPort, EdgeOperationResult } from '@totemsdk/edge';

type PolicyLike = AgentPolicy | PolicyMiddleware;

function isMiddleware(p: PolicyLike): p is PolicyMiddleware {
  return 'evaluate' in p && typeof (p as PolicyMiddleware).evaluate === 'function';
}

/**
 * Wraps an AgentPolicy or PolicyMiddleware as an EdgePolicyPort.
 *
 * When the EdgePolicyPort receives a full `proposal` object, it delegates
 * directly to the policy without lossy reconstruction. When only flat
 * `action`/`subject` params are provided, it builds a minimal AgentProposal
 * (legacy path).
 */
export function createPolicyPortAdapter(policy: PolicyLike): EdgePolicyPort {
  return {
    async check(params: {
      action: string;
      subject: string;
      context?: Record<string, unknown>;
      proposal?: {
        id: string;
        agentId: string;
        intent: {
          type: string;
          amount?: string;
          tokenId?: string;
          recipient?: string;
          reason?: string;
          risk?: string;
        };
        explanation: string;
        confidence: number;
        createdAt: number;
      };
    }): Promise<EdgeOperationResult<{ allowed: boolean; reason?: string }>> {
      try {
        // Prefer full proposal when available
        if (params.proposal) {
          const proposal: AgentProposal = {
            id: params.proposal.id,
            agentId: params.proposal.agentId,
            intent: {
              type: params.proposal.intent.type as AgentProposal['intent']['type'],
              amount: params.proposal.intent.amount,
              tokenId: params.proposal.intent.tokenId,
              recipient: params.proposal.intent.recipient,
              reason: params.proposal.intent.reason,
              risk: params.proposal.intent.risk as AgentProposal['intent']['risk'],
            },
            explanation: params.proposal.explanation,
            confidence: params.proposal.confidence,
            createdAt: params.proposal.createdAt,
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
              reason: allowed ? undefined : 'Action requires user approval per configured policy',
            },
          };
        }

        // Legacy path: build minimal proposal from flat params
        const intentType: AgentProposal['intent']['type'] =
          params.action.startsWith('pay') ? 'payment' : 'receipt';

        const proposal: AgentProposal = {
          id: `edge-policy-${params.action}-${params.subject}-${Date.now()}`,
          agentId: 'edge-policy-adapter',
          intent: {
            type: intentType,
            recipient: params.subject,
            reason: params.action,
            risk: (params.context?.['risk'] as AgentProposal['intent']['risk']) ?? 'low',
            metadata: params.context,
          },
          explanation: `Policy check for action "${params.action}" by subject "${params.subject}"`,
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
            reason: allowed ? undefined : 'Action requires user approval per configured policy',
          },
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

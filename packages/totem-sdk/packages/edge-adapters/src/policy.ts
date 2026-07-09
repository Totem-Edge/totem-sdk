import type { AgentPolicy, AgentProposal } from '@totemsdk/agent-policy';
import type { EdgePolicyPort, EdgeOperationResult } from '@totemsdk/edge';

/**
 * Wraps an AgentPolicy as an EdgePolicyPort.
 *
 * Builds a minimal AgentProposal from the EdgePolicyPort check() params and
 * delegates to policy.canAutoApprove(). The intent type is inferred from the
 * action string (actions starting with 'pay' map to 'payment'; everything
 * else maps to 'receipt' as a catch-all).
 */
export function createPolicyPortAdapter(policy: AgentPolicy): EdgePolicyPort {
  return {
    async check(params: {
      action: string;
      subject: string;
      context?: Record<string, unknown>;
    }): Promise<EdgeOperationResult<{ allowed: boolean; reason?: string }>> {
      try {
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

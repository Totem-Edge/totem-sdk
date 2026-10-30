import { createPolicyPortAdapter } from '../policy';
import type { AgentPolicy } from '@totemsdk/agent-policy';

function makePolicy(canAutoApprove: boolean): AgentPolicy {
  return {
    canAutoApprove: jest.fn().mockResolvedValue(canAutoApprove),
    requiresUserApproval: jest.fn().mockResolvedValue(!canAutoApprove),
  };
}

describe('createPolicyPortAdapter — check', () => {
  it('returns allowed:true when policy approves', async () => {
    const port = createPolicyPortAdapter(makePolicy(true));
    const result = await port.check({ action: 'pay:invoice', subject: 'MxABC' });
    expect(result.ok).toBe(true);
    expect(result.data?.allowed).toBe(true);
    expect(result.data?.reason).toBeUndefined();
  });

  it('returns allowed:false with reason when policy denies', async () => {
    const port = createPolicyPortAdapter(makePolicy(false));
    const result = await port.check({ action: 'settlement', subject: 'MxABC' });
    expect(result.ok).toBe(true);
    expect(result.data?.allowed).toBe(false);
    expect(result.data?.reason).toBeTruthy();
  });

  it('maps pay-prefixed actions to payment intent type', async () => {
    const policy = makePolicy(true);
    const port = createPolicyPortAdapter(policy);
    await port.check({ action: 'pay:sensor-reading', subject: 'MxABC' });
    const proposal = (policy.canAutoApprove as jest.Mock).mock.calls[0][0];
    expect(proposal.intent.type).toBe('payment');
  });

  it('maps non-pay actions to receipt intent type', async () => {
    const policy = makePolicy(true);
    const port = createPolicyPortAdapter(policy);
    await port.check({ action: 'sensor:publish', subject: 'MxABC' });
    const proposal = (policy.canAutoApprove as jest.Mock).mock.calls[0][0];
    expect(proposal.intent.type).toBe('receipt');
  });

  it('forwards context into proposal metadata', async () => {
    const policy = makePolicy(true);
    const port = createPolicyPortAdapter(policy);
    await port.check({ action: 'pay', subject: 'MxABC', context: { invoiceRef: 'INV-001' } });
    const proposal = (policy.canAutoApprove as jest.Mock).mock.calls[0][0];
    expect(proposal.intent.metadata).toMatchObject({ invoiceRef: 'INV-001' });
  });

  it('returns ok:false when policy throws', async () => {
    const policy: AgentPolicy = {
      canAutoApprove: jest.fn().mockRejectedValue(new Error('policy engine offline')),
      requiresUserApproval: jest.fn(),
    };
    const port = createPolicyPortAdapter(policy);
    const result = await port.check({ action: 'pay', subject: 'MxABC' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('policy engine offline');
  });
});

import type {
  AgentPolicy,
  AgentProposal,
  AgentReceipt,
  AgentIdentity,
  PaymentIntent,
} from '../index.js';

// ---------------------------------------------------------------------------
// Trivial policy implementation used across tests
// ---------------------------------------------------------------------------

class RiskBasedPolicy implements AgentPolicy {
  async canAutoApprove(proposal: AgentProposal): Promise<boolean> {
    return proposal.intent.risk === 'low';
  }

  async requiresUserApproval(proposal: AgentProposal): Promise<boolean> {
    return proposal.intent.risk !== 'low';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProposal(risk: PaymentIntent['risk']): AgentProposal {
  return {
    id: 'proposal-1',
    agentId: 'test-agent',
    intent: {
      type: 'payment',
      amount: '1.0',
      tokenId: '0x00',
      recipient: '0xabc',
      reason: 'test payment',
      risk,
    },
    explanation: 'Automated test payment',
    confidence: 0.9,
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RiskBasedPolicy', () => {
  const policy = new RiskBasedPolicy();

  it('auto-approves low-risk proposals', async () => {
    const proposal = makeProposal('low');
    expect(await policy.canAutoApprove(proposal)).toBe(true);
    expect(await policy.requiresUserApproval(proposal)).toBe(false);
  });

  it('requires user approval for medium-risk proposals', async () => {
    const proposal = makeProposal('medium');
    expect(await policy.canAutoApprove(proposal)).toBe(false);
    expect(await policy.requiresUserApproval(proposal)).toBe(true);
  });

  it('requires user approval for high-risk proposals', async () => {
    const proposal = makeProposal('high');
    expect(await policy.canAutoApprove(proposal)).toBe(false);
    expect(await policy.requiresUserApproval(proposal)).toBe(true);
  });

  it('requires user approval when risk is undefined', async () => {
    const proposal = makeProposal(undefined);
    expect(await policy.canAutoApprove(proposal)).toBe(false);
    expect(await policy.requiresUserApproval(proposal)).toBe(true);
  });
});

describe('AgentProposal shape', () => {
  it('accepts all PaymentIntent types', () => {
    const types: PaymentIntent['type'][] = [
      'payment',
      'channel_update',
      'settlement',
      'lookup',
      'receipt',
    ];
    for (const type of types) {
      const proposal = makeProposal('low');
      proposal.intent.type = type;
      expect(proposal.intent.type).toBe(type);
    }
  });

  it('allows optional intent fields to be absent', () => {
    const intent: PaymentIntent = { type: 'lookup' };
    expect(intent.amount).toBeUndefined();
    expect(intent.tokenId).toBeUndefined();
    expect(intent.recipient).toBeUndefined();
  });
});

describe('AgentReceipt shape', () => {
  it('approved receipt has txpowId', () => {
    const receipt: AgentReceipt = {
      proposalId: 'proposal-1',
      status: 'approved',
      txpowId: '0xdeadbeef',
      settledAt: Date.now(),
    };
    expect(receipt.status).toBe('approved');
    expect(receipt.txpowId).toBe('0xdeadbeef');
  });

  it('rejected receipt has rejectionReason', () => {
    const receipt: AgentReceipt = {
      proposalId: 'proposal-1',
      status: 'rejected',
      rejectionReason: 'Amount exceeds daily limit',
      settledAt: Date.now(),
    };
    expect(receipt.status).toBe('rejected');
    expect(receipt.rejectionReason).toBeTruthy();
  });

  it('pending_user receipt has no txpowId', () => {
    const receipt: AgentReceipt = {
      proposalId: 'proposal-1',
      status: 'pending_user',
    };
    expect(receipt.status).toBe('pending_user');
    expect(receipt.txpowId).toBeUndefined();
  });
});

describe('AgentIdentity shape', () => {
  it('identity carries capabilities but no keys', () => {
    const identity: AgentIdentity = {
      agentId: 'invoice-agent-1',
      address: '0xMxG5some1addresshere',
      capabilities: ['invoice-parse', 'fx-quote'],
    };
    expect(identity.capabilities).toHaveLength(2);
    // No signing key fields
    const raw = identity as unknown as Record<string, unknown>;
    expect(raw['privateKey']).toBeUndefined();
    expect(raw['signingKey']).toBeUndefined();
    expect(raw['treeKey']).toBeUndefined();
  });
});

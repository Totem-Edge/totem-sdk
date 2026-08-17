import {
  connect,
  verify,
  getAccounts,
  sendTransaction,
  getCoins,
  broadcastHex,
  grantTxPermission,
  revokeTxPermission,
  signData,
  setActiveProvider,
  clearActiveProvider,
  isTotemInstalled,
  getProvider,
  onEvent,
  getCapabilities,
  signTransaction,
  omniaPay,
  agentProposePayment,
  agentCreateReceipt,
  setAgentPolicy,
  clearAgentPolicy,
  TotemNotInstalledError,
  TotemConnectionError,
} from '../index.js';
import type { TotemProvider } from '../types.js';

class MockProvider {
  isTotem = true as const;
  readonly calls: Array<{ method: string; params?: Record<string, unknown> }> = [];
  readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  handler?: (req: { method: string; params?: Record<string, unknown> }) => unknown;

  async request(req: { method: string; params?: Record<string, unknown> }): Promise<unknown> {
    this.calls.push(req);
    if (this.handler) return this.handler(req);
    return { success: true };
  }

  on(event: string, cb: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  removeListener(event: string, cb: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(cb);
  }
}

function makeProvider(): MockProvider {
  return new MockProvider();
}

function install(provider: MockProvider): void {
  setActiveProvider(provider as unknown as TotemProvider);
}

const ORIGIN = 'https://dapp.example';

beforeEach(() => {
  clearActiveProvider();
  clearAgentPolicy();
});

describe('@totemsdk/connect', () => {
  describe('provider lifecycle', () => {
    it('reports not installed when no provider is active', () => {
      expect(isTotemInstalled()).toBe(false);
    });

    it('throws TotemNotInstalledError when calling getProvider without any wallet', () => {
      expect(() => getProvider()).toThrow(TotemNotInstalledError);
      expect(() => getProvider()).toThrow('No Totem-compatible wallet detected');
    });

    it('reports installed after setActiveProvider', () => {
      const provider = makeProvider();
      install(provider);
      expect(isTotemInstalled()).toBe(true);
      expect(getProvider()).toBe(provider as unknown as TotemProvider);
    });

    it('returns to not-installed after clearActiveProvider', () => {
      install(makeProvider());
      clearActiveProvider();
      expect(isTotemInstalled()).toBe(false);
    });
  });

  describe('rpc proxies', () => {
    it('connect() forwards TOTEM_CONNECT with the origin', async () => {
      const provider = makeProvider();
      install(provider);
      const res = await connect(ORIGIN);
      expect(res).toEqual({ success: true });
      expect(provider.calls[0].method).toBe('TOTEM_CONNECT');
      expect(provider.calls[0].params).toEqual({ origin: ORIGIN });
    });

    it('connect() wraps provider rejection in TotemConnectionError', async () => {
      const provider = makeProvider();
      install(provider);
      provider.handler = async () => {
        throw new Error('wallet rejected');
      };
      await expect(connect(ORIGIN)).rejects.toBeInstanceOf(TotemConnectionError);
      await expect(connect(ORIGIN)).rejects.toThrow('wallet rejected');
    });

    it('verify() forwards the challenge', async () => {
      const provider = makeProvider();
      install(provider);
      await verify(ORIGIN, { statement: 'Sign in', nonce: 'abc' });
      expect(provider.calls[0].method).toBe('TOTEM_VERIFY');
      expect(provider.calls[0].params).toEqual({
        origin: ORIGIN,
        challenge: { statement: 'Sign in', nonce: 'abc' },
      });
    });

    it('getAccounts() forwards TOTEM_GET_ACCOUNTS', async () => {
      const provider = makeProvider();
      install(provider);
      await getAccounts(ORIGIN);
      expect(provider.calls[0].method).toBe('TOTEM_GET_ACCOUNTS');
      expect(provider.calls[0].params).toEqual({ origin: ORIGIN });
    });

    it('sendTransaction() forwards outputs and intent', async () => {
      const provider = makeProvider();
      install(provider);
      await sendTransaction(ORIGIN, {
        version: 1,
        intent: 'send',
        outputs: [{ address: 'Mx...', amount: '10', tokenId: 'T1' }],
      });
      expect(provider.calls[0].method).toBe('TOTEM_SEND_TRANSACTION');
      expect(provider.calls[0].params).toEqual({
        origin: ORIGIN,
        request: {
          version: 1,
          intent: 'send',
          outputs: [{ address: 'Mx...', amount: '10', tokenId: 'T1' }],
        },
      });
    });

    it('getCoins() merges optional params', async () => {
      const provider = makeProvider();
      install(provider);
      await getCoins(ORIGIN, { tokenId: 'T1', minAmount: '5' });
      expect(provider.calls[0].params).toEqual({
        origin: ORIGIN,
        tokenId: 'T1',
        minAmount: '5',
      });
    });

    it('broadcastHex() forwards signed hex', async () => {
      const provider = makeProvider();
      install(provider);
      await broadcastHex(ORIGIN, { signedHex: '0x1234' });
      expect(provider.calls[0].method).toBe('TOTEM_BROADCAST_HEX');
      expect(provider.calls[0].params).toEqual({ origin: ORIGIN, signedHex: '0x1234' });
    });

    it('signData() forwards input addresses and format', async () => {
      const provider = makeProvider();
      install(provider);
      await signData(ORIGIN, {
        unsignedHex: '0x00',
        inputAddresses: ['Mx...'],
        returnFormat: 'json',
      });
      expect(provider.calls[0].params).toEqual({
        origin: ORIGIN,
        unsignedHex: '0x00',
        inputAddresses: ['Mx...'],
        returnFormat: 'json',
      });
    });

    it('signTransaction() forwards transaction request', async () => {
      const provider = makeProvider();
      install(provider);
      await signTransaction(ORIGIN, { unsignedHex: '0xaa', inputAddresses: ['Mx...'] });
      expect(provider.calls[0].method).toBe('totem_signTransaction');
      expect(provider.calls[0].params).toEqual({
        origin: ORIGIN,
        unsignedHex: '0xaa',
        inputAddresses: ['Mx...'],
      });
    });

    it('omniaPay() forwards channel payment', async () => {
      const provider = makeProvider();
      install(provider);
      await omniaPay(ORIGIN, { channelId: 'ch-1', amount: '10', memo: 'buy coffee' });
      expect(provider.calls[0].method).toBe('totem_omniaPay');
      expect(provider.calls[0].params).toEqual({
        origin: ORIGIN,
        channelId: 'ch-1',
        amount: '10',
        memo: 'buy coffee',
      });
    });

    it('getCapabilities() forwards totem_getCapabilities', async () => {
      const provider = makeProvider();
      install(provider);
      await getCapabilities();
      expect(provider.calls[0].method).toBe('totem_getCapabilities');
    });
  });

  describe('permission helpers', () => {
    it('grantTxPermission() forwards config', async () => {
      const provider = makeProvider();
      install(provider);
      await grantTxPermission(ORIGIN, { expiresInDays: 7 });
      expect(provider.calls[0].method).toBe('TOTEM_GRANT_TX_PERMISSION');
      expect(provider.calls[0].params).toEqual({
        origin: ORIGIN,
        config: { expiresInDays: 7 },
      });
    });

    it('revokeTxPermission() forwards origin', async () => {
      const provider = makeProvider();
      install(provider);
      await revokeTxPermission(ORIGIN);
      expect(provider.calls[0].method).toBe('TOTEM_REVOKE_TX_PERMISSION');
      expect(provider.calls[0].params).toEqual({ origin: ORIGIN });
    });
  });

  describe('onEvent', () => {
    it('subscribes and returns an unsubscribe function', () => {
      const provider = makeProvider();
      install(provider);
      const handler = jest.fn();
      const unsubscribe = onEvent('accountsChanged', handler);
      provider.listeners.get('accountsChanged')!.forEach(cb => cb('Mx1', 'Mx2'));
      expect(handler).toHaveBeenCalledWith('Mx1', 'Mx2');

      unsubscribe();
      expect(provider.listeners.get('accountsChanged')!.size).toBe(0);
    });
  });

  describe('agentProposePayment', () => {
    const intent = {
      type: 'payment' as const,
      amount: '10',
      tokenId: 'T1',
      recipient: 'Mx...',
      reason: 'invoice',
    };

    it('forwards to the wallet when no local policy is set', async () => {
      const provider = makeProvider();
      install(provider);
      provider.handler = async () => ({
        success: true,
        proposalId: 'prop-1',
        status: 'approved',
        receipt: { proposalId: 'prop-1', status: 'approved', settledAt: 123 },
      });
      const res = await agentProposePayment(ORIGIN, {
        agentId: 'agent-1',
        intent,
        explanation: 'Pay invoice #42',
      });
      expect(res).toEqual({
        success: true,
        proposalId: 'prop-1',
        status: 'approved',
        receipt: { proposalId: 'prop-1', status: 'approved', settledAt: 123 },
      });
      expect(provider.calls[0].method).toBe('totem_agentProposePayment');
      expect(provider.calls[0].params!.agentId).toBe('agent-1');
      expect(provider.calls[0].params!.intent).toEqual(intent);
    });

    it('rejects locally and skips the wallet when policy rejects', async () => {
      const provider = makeProvider();
      install(provider);
      setAgentPolicy({
        evaluate: async () => ({ outcome: 'rejected', reason: 'amount exceeds daily limit' }),
      });
      const res = await agentProposePayment(ORIGIN, {
        agentId: 'agent-1',
        intent,
        explanation: 'Pay invoice #42',
      });
      expect(res.success).toBe(false);
      expect(res.status).toBe('rejected');
      expect(res.rejectionReason).toBe('amount exceeds daily limit');
      expect(provider.calls.length).toBe(0);
    });

    it('routes to the wallet for human approval when policy requires_human', async () => {
      const provider = makeProvider();
      install(provider);
      setAgentPolicy({
        evaluate: async () => ({ outcome: 'requires_human', reason: 'needs confirmation' }),
      });
      provider.handler = async () => ({
        success: true,
        proposalId: 'prop-2',
        status: 'pending_user',
        receipt: { proposalId: 'prop-2', status: 'pending_user', settledAt: 456 },
      });
      const res = await agentProposePayment(ORIGIN, {
        agentId: 'agent-1',
        intent,
        explanation: 'Pay invoice #42',
      });
      expect(res.status).toBe('pending_user');
      expect(provider.calls.length).toBe(1);
      expect(provider.calls[0].method).toBe('totem_agentProposePayment');
    });

    it('forwards when policy approves', async () => {
      const provider = makeProvider();
      install(provider);
      setAgentPolicy({
        evaluate: async () => ({ outcome: 'approved', reason: 'ok' }),
      });
      provider.handler = async () => ({ success: true });
      await agentProposePayment(ORIGIN, {
        agentId: 'agent-1',
        intent,
        explanation: 'Pay invoice #42',
      });
      expect(provider.calls.length).toBe(1);
      expect(provider.calls[0].method).toBe('totem_agentProposePayment');
    });
  });

  describe('agentCreateReceipt', () => {
    it('forwards the receipt request', async () => {
      const provider = makeProvider();
      install(provider);
      await agentCreateReceipt(ORIGIN, {
        proposalId: 'prop-1',
        status: 'approved',
        txpowId: '0xabc',
      });
      expect(provider.calls[0].method).toBe('totem_agentCreateReceipt');
      expect(provider.calls[0].params).toEqual({
        origin: ORIGIN,
        proposalId: 'prop-1',
        status: 'approved',
        txpowId: '0xabc',
      });
    });
  });
});
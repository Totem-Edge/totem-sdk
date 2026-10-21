import { createAxiaProviderSet } from '../src/core/providers/axiaAdapter';

describe('Axia provider adapter (Phase 1)', () => {
  it('preserves the existing balance/history/wots/watermark calls', async () => {
    const calls: Array<{ method: string; params?: unknown }> = [];
    const client = {
      async call<T>(method: string, params?: unknown): Promise<{ result: T }> {
        calls.push({ method, params });
        return { result: [{ tokenid: '0x00', confirmed: '1' }] as T };
      },
      async getWatermark(root: string) {
        calls.push({ method: 'getWatermark', params: { root } });
        return { l1: 0, l2: 1, l3: 7 };
      },
    };

    const providers = createAxiaProviderSet(client as never);
    const balance = await providers.chain.getBalance('MxABC');
    expect(balance[0]).toMatchObject({ tokenid: '0x00', confirmed: '1' });
    await providers.chain.getHistory({ address: 'MxABC', limit: 10, tokenId: '0x00' });
    await providers.custody.getWotsStatus();
    await providers.custody.getWatermark('0xabc');

    expect(calls).toEqual([
      { method: 'balance', params: { address: 'MxABC' } },
      { method: 'history', params: { address: 'MxABC', limit: 10, tokenid: '0x00' } },
      { method: 'wots/status', params: {} },
      { method: 'getWatermark', params: { root: '0xabc' } },
    ]);
  });
});

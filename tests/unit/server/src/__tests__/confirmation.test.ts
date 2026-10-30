/**
 * RFC-036 — settlement verification.
 */

jest.mock('../sendTransaction.js', () => ({
  sendTransaction: jest.fn(async () => ({
    txpowId: '0xdead',
    status: 'submitted',
    miningSource: 'wasm',
    elapsedMs: 1,
    settlement: 'unverified',
  })),
}));

import {
  awaitConfirmation,
  sendAndConfirm,
  type ConfirmationProvider,
  type TxPowStatus,
} from '../confirmation.js';

const txpow = (over: Partial<TxPowStatus> = {}): TxPowStatus => ({
  txpowid: '0xabc',
  isblock: false,
  ...over,
});

/** Provider that walks `records` (clamped to the last entry). */
function seqProvider(
  records: Array<TxPowStatus | null>,
  balances?: { before?: string; after?: string },
): ConfirmationProvider {
  let i = 0;
  const provider: ConfirmationProvider = {
    async getTxPowStatus() {
      const r = records[Math.min(i, records.length - 1)];
      i++;
      return r;
    },
  };
  if (balances) {
    let n = 0;
    provider.getBalance = async () => {
      const v = n === 0 ? balances.before ?? '0' : balances.after ?? '0';
      n++;
      return v;
    };
  }
  return provider;
}

describe('awaitConfirmation (RFC-036)', () => {
  it('returns confirmed with blockHeight on inclusion', async () => {
    const provider = seqProvider([txpow(), txpow({ isblock: true, header: { block: 42 } })]);
    const result = await awaitConfirmation({ txpowId: '0xabc', provider, intervalMs: 5, timeoutMs: 1000 });
    expect(result.status).toBe('confirmed');
    expect(result.blockHeight).toBe(42);
    expect(result.confirmingTxPowId).toBe('0xabc');
  });

  it('returns timeout (not failed) when never included', async () => {
    const provider = seqProvider([txpow()]);
    const result = await awaitConfirmation({ txpowId: '0xabc', provider, intervalMs: 5, timeoutMs: 25 });
    expect(result.status).toBe('timeout');
    expect(result.reason).toMatch(/not included/);
  });

  it('cancels promptly on AbortSignal', async () => {
    const provider = seqProvider([txpow()]);
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 1);
    const result = await awaitConfirmation({
      txpowId: '0xabc',
      provider,
      intervalMs: 5000,
      timeoutMs: 60000,
      signal: ac.signal,
    });
    expect(result.status).toBe('failed');
    expect(result.reason).toBe('aborted');
  });

  it('evaluates the expected balance delta (met)', async () => {
    const provider = seqProvider([txpow({ isblock: true, header: { block: 5 } })], {
      before: '100',
      after: '110',
    });
    const result = await awaitConfirmation({
      txpowId: '0xabc',
      provider,
      intervalMs: 5,
      timeoutMs: 1000,
      expect: { toAddress: 'Mx', minIncrease: '10' },
    });
    expect(result.status).toBe('confirmed');
    expect(result.expectationMet).toBe(true);
    expect(result.balanceDelta).toEqual({ tokenId: '0x00', before: '100', after: '110' });
  });

  it('surfaces an expectation mismatch (not swallowed)', async () => {
    const provider = seqProvider([txpow({ isblock: true, header: { block: 5 } })], {
      before: '100',
      after: '105',
    });
    const result = await awaitConfirmation({
      txpowId: '0xabc',
      provider,
      intervalMs: 5,
      timeoutMs: 1000,
      expect: { toAddress: 'Mx', minIncrease: '10' },
    });
    expect(result.status).toBe('confirmed');
    expect(result.expectationMet).toBe(false);
    expect(result.reason).toMatch(/balance increase/);
  });

  it('fails recoverability when the node stops serving the record', async () => {
    const provider = seqProvider([txpow({ isblock: true, header: { block: 5 } }), null]);
    const result = await awaitConfirmation({
      txpowId: '0xabc',
      provider,
      intervalMs: 5,
      timeoutMs: 1000,
      assertRecoverable: true,
    });
    expect(result.status).toBe('failed');
    expect(result.reason).toMatch(/no longer serves/);
  });
});

describe('sendAndConfirm (RFC-036)', () => {
  it('returns the send result plus a confirmation', async () => {
    const provider = seqProvider([txpow({ isblock: true, header: { block: 9 } })], {
      before: '0',
      after: '10',
    });
    const result = await sendAndConfirm({
      seed: 'x',
      addressIndex: 0,
      toAddress: 'Mx',
      amount: '10',
      axiaBaseUrl: 'https://api.axia.test',
      apiKey: 'k',
      signingIndices: { l1: 0, l2: 0 },
      provider,
      intervalMs: 5,
      timeoutMs: 1000,
    });
    expect(result.txpowId).toBe('0xdead');
    expect(result.settlement).toBe('unverified');
    expect(result.confirmation.status).toBe('confirmed');
    expect(result.confirmation.expectationMet).toBe(true);
  });
});

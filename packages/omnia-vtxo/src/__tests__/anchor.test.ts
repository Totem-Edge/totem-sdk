/**
 * RFC-038 V1 — on-chain batch anchoring.
 */

import { buildAndHashPoolScript, poolScriptAddress } from '../pool-script.js';
import { buildBatchAnchorDraft, batchAnchorDigest, anchorBatch, poolStateVariables, verifyPoolFunding } from '../anchor.js';
import type { ChainStateProvider } from '@totemsdk/chain-provider';

const OP = '0x' + 'aa'.repeat(32);

const params = () => ({
  operatorPublicKeyDigest: OP,
  root: '0x' + 'bb'.repeat(32),
  epoch: 1,
  fundingCoinId: '0x' + 'cc'.repeat(32),
  fundingAddress: '0x' + 'dd'.repeat(32),
  fundingScript: 'RETURN TRUE',
  amount: 1000n,
  tokenId: '0x00',
});

describe('pool script (RFC-038 V1)', () => {
  it('builds a deterministic operator-controlled pool script + address', () => {
    const first = buildAndHashPoolScript(OP);
    const second = buildAndHashPoolScript(OP);
    expect(first.script).toBe(second.script);
    expect(first.script).toContain('STATE(100)');
    expect(first.script).toContain('STATE(101)');
    expect(first.address).toBe(poolScriptAddress(first.script));
    expect(first.address).toBeTruthy();
  });

  it('carries root + epoch as state variables', () => {
    expect(poolStateVariables('0xdead', 3)).toEqual([
      { port: 100, value: '0xdead', type: 'string' },
      { port: 101, value: 3n, type: 'number' },
    ]);
  });
});

describe('anchorBatch (RFC-038 V1)', () => {
  it('builds a stable batch-anchor digest', () => {
    const a = buildBatchAnchorDraft(params());
    const b = buildBatchAnchorDraft(params());
    expect(Buffer.from(batchAnchorDigest(a)).toString('hex')).toBe(Buffer.from(batchAnchorDigest(b)).toString('hex'));
  });

  it('does not broadcast without a chain provider', async () => {
    const result = await anchorBatch(params(), { signDigest: async () => new Uint8Array(1088).fill(1) });
    expect(result.txpowId).toBeUndefined();
    expect(result.witnessHex).toBeTruthy();
  });

  it('signs, mines and broadcasts when a chain provider is supplied', async () => {
    const broadcastTxPoW = jest.fn(async () => ({ success: true }));
    const result = await anchorBatch(params(), {
      signDigest: async () => new Uint8Array(1088).fill(1),
      chainProvider: { broadcastTxPoW } as unknown as ChainStateProvider,
      mine: async () => ({ minedHeaderBytes: new Uint8Array(80).fill(1), txpowId: new Uint8Array(32).fill(2) }),
    });
    expect(result.txpowId).toBeTruthy();
    expect(result.root).toBe(params().root);
    expect(result.epoch).toBe(1);
    expect(broadcastTxPoW).toHaveBeenCalledTimes(1);
  });
});

describe('verifyPoolFunding (RFC-038 V1)', () => {
  const coin = {
    coinid: '0x' + 'cc'.repeat(32),
    address: '0x' + 'dd'.repeat(32),
    amount: '1000',
    tokenid: '0x00',
    spent: false,
  };

  it('accepts a matching, unspent pool coin with a proof', async () => {
    const chainProvider = {
      getCoin: jest.fn(async () => coin),
      getProof: jest.fn(async () => ({ ok: true })),
    } as unknown as ChainStateProvider;
    const result = await verifyPoolFunding(coin.coinid, { address: coin.address, amount: '1000', tokenId: '0x00' }, chainProvider);
    expect(result.ok).toBe(true);
    expect(result.proof).toBeTruthy();
  });

  it('rejects a mismatched amount', async () => {
    const chainProvider = {
      getCoin: jest.fn(async () => coin),
      getProof: jest.fn(async () => ({ ok: true })),
    } as unknown as ChainStateProvider;
    const result = await verifyPoolFunding(coin.coinid, { address: coin.address, amount: '999', tokenId: '0x00' }, chainProvider);
    expect(result.ok).toBe(false);
  });
});

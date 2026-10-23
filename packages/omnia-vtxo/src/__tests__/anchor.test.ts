/**
 * RFC-038 V1/V3 — on-chain batch anchoring + per-share non-custodial pool script.
 */

import { buildAndHashPoolScript, poolScriptAddress, POOL_SHARE_PORT_BASE } from '../pool-script.js';
import {
  buildBatchAnchorDraft,
  batchAnchorDigest,
  anchorBatch,
  poolStateVariables,
  checkPoolFunding,
} from '../anchor.js';
import type { ChainStateProvider } from '@totemsdk/chain-provider';

const OP = '0x' + 'aa'.repeat(32);
const OWNER = '0x' + 'ab'.repeat(32);
const EXIT_BLOCK = 1000;
const POOL = buildAndHashPoolScript({
  operatorPublicKeyDigest: OP,
  holders: [OWNER],
  exitBlock: EXIT_BLOCK,
});

const params = () => ({
  operatorPublicKeyDigest: OP,
  holders: [OWNER],
  shares: [1000n],
  exitBlock: EXIT_BLOCK,
  root: '0x' + 'bb'.repeat(32),
  epoch: 1,
  fundingCoinId: '0x' + 'cc'.repeat(32),
  fundingAddress: POOL.address,
  fundingScript: POOL.script,
  amount: 1000n,
  tokenId: '0x00',
});

describe('pool script (RFC-038 V3 — per-share non-custodial)', () => {
  it('builds a deterministic pool script + address', () => {
    const a = buildAndHashPoolScript({ operatorPublicKeyDigest: OP, holders: [OWNER], exitBlock: EXIT_BLOCK });
    const b = buildAndHashPoolScript({ operatorPublicKeyDigest: OP, holders: [OWNER], exitBlock: EXIT_BLOCK });
    expect(a.script).toBe(b.script);
    expect(a.address).toBe(poolScriptAddress(a.script));
  });

  it('has a per-holder exit branch constrained to the committed share', () => {
    expect(POOL.script).toContain('IF @BLOCK GT exitblock THEN');
    expect(POOL.script).toContain('LET exitblock=PREVSTATE(102)');
    expect(POOL.script).toContain('LET share=PREVSTATE(128)');
    expect(POOL.script).toContain('IF SIGNEDBY(');
    expect(POOL.script).toContain('IF share GT 0 THEN');
    expect(POOL.script).toContain('ASSERT VERIFYOUT(0');
    expect(POOL.script).toContain(`ASSERT STATE(${POOL_SHARE_PORT_BASE}) EQ 0`);
    expect(POOL.script).toContain('RETURN VERIFYOUT(1 @ADDRESS @AMOUNT - share @TOKENID TRUE)');
  });

  it('keeps cooperative updates co-signed, epoch-monotone, value-confined and exit-block-immutable', () => {
    expect(POOL.script).toContain('ASSERT epoch GT PREVSTATE(101)');
    expect(POOL.script).toContain('ASSERT SAMESTATE(102 102)');
    expect(POOL.script).toContain('ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)');
    expect(POOL.script).toContain('RETURN MULTISIG(2');
    expect(POOL.script).toContain('STATE(101)');
    expect(POOL.script).toContain('STATE(102)');
  });

  it('rejects bad keys, no holders, or a bad exit block', () => {
    expect(() => buildAndHashPoolScript({ operatorPublicKeyDigest: '0xZZ', holders: [OWNER], exitBlock: 1 })).toThrow(/64 hex/);
    expect(() => buildAndHashPoolScript({ operatorPublicKeyDigest: OP, holders: [], exitBlock: 1 })).toThrow(/holder/);
    expect(() => buildAndHashPoolScript({ operatorPublicKeyDigest: OP, holders: [OWNER], exitBlock: -1 })).toThrow(/exitBlock/);
  });

  it('carries root + epoch + exit block + per-holder shares as state', () => {
    expect(poolStateVariables('0xdead', 3, 500, [1000n, 250n])).toEqual([
      { port: 100, value: '0xdead', type: 'string' },
      { port: 101, value: 3n, type: 'number' },
      { port: 102, value: 500n, type: 'number' },
      { port: POOL_SHARE_PORT_BASE, value: 1000n, type: 'number' },
      { port: POOL_SHARE_PORT_BASE + 1, value: 250n, type: 'number' },
    ]);
  });
});

describe('anchorBatch (RFC-038 V1)', () => {
  it('builds a stable batch-anchor digest', () => {
    const a = buildBatchAnchorDraft(params());
    const b = buildBatchAnchorDraft(params());
    expect(Buffer.from(batchAnchorDigest(a)).toString('hex')).toBe(Buffer.from(batchAnchorDigest(b)).toString('hex'));
  });

  it('rejects mismatched holders/shares or a foreign funding input', () => {
    expect(() => buildBatchAnchorDraft({ ...params(), shares: [] })).toThrow(/same length/);
    expect(() => buildBatchAnchorDraft({ ...params(), fundingScript: 'RETURN TRUE' })).toThrow(/pool script/);
    expect(() => buildBatchAnchorDraft({ ...params(), fundingAddress: '0x' + '99'.repeat(32) })).toThrow(/pool address/);
  });

  it('does not broadcast without a chain provider', async () => {
    const result = await anchorBatch(params(), { signDigest: async () => new Uint8Array(1088).fill(1) });
    expect(result.txpowId).toBeUndefined();
    expect(result.witnessHex).toBeTruthy();
  });

  it('assembles an N-of-N operator + holder witness', async () => {
    const signatures = [new Uint8Array(1088).fill(1), new Uint8Array(1088).fill(2)];
    const result = await anchorBatch(params(), {
      signatures,
      coinProofs: [new Uint8Array([1, 2, 3])],
      scriptProofs: [new Uint8Array([4, 5, 6])],
    });
    const witness = Buffer.from(result.witnessHex, 'hex');
    expect(witness.length).toBeGreaterThan(signatures[0].length);
    expect(result.witnessHex).not.toBe(Buffer.from(signatures[0]).toString('hex'));
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

describe('checkPoolFunding (RFC-038 V1)', () => {
  const coin = {
    coinid: '0x' + 'cc'.repeat(32),
    address: '0x' + 'dd'.repeat(32),
    amount: '1000',
    tokenid: '0x00',
    spent: false,
  };
  const expected = { address: coin.address, amount: '1000', tokenId: '0x00' };

  it('accepts a matching, unspent pool coin; reports the proof is unverified by default', async () => {
    const chainProvider = {
      getCoin: jest.fn(async () => coin),
      getProof: jest.fn(async () => ({ ok: true })),
    } as unknown as ChainStateProvider;
    const result = await checkPoolFunding(coin.coinid, expected, chainProvider);
    expect(result.ok).toBe(true);
    expect(result.proofVerified).toBe(false);
  });

  it('marks the proof verified when a verifyProof callback passes', async () => {
    const chainProvider = {
      getCoin: jest.fn(async () => coin),
      getProof: jest.fn(async () => ({ ok: true })),
    } as unknown as ChainStateProvider;
    const result = await checkPoolFunding(coin.coinid, expected, chainProvider, { verifyProof: () => true });
    expect(result.proofVerified).toBe(true);
  });

  it('rejects a mismatched amount', async () => {
    const chainProvider = {
      getCoin: jest.fn(async () => coin),
      getProof: jest.fn(async () => ({ ok: true })),
    } as unknown as ChainStateProvider;
    const result = await checkPoolFunding(coin.coinid, { ...expected, amount: '999' }, chainProvider);
    expect(result.ok).toBe(false);
  });
});

/**
 * RFC-038 V1/V2 — on-chain batch anchoring + non-custodial pool script.
 */

import { buildAndHashPoolScript, poolScriptAddress } from '../pool-script.js';
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
  ownerPublicKeyDigest: OWNER,
  exitBlock: EXIT_BLOCK,
});

const params = () => ({
  operatorPublicKeyDigest: OP,
  ownerPublicKeyDigest: OWNER,
  exitBlock: EXIT_BLOCK,
  root: '0x' + 'bb'.repeat(32),
  epoch: 1,
  fundingCoinId: '0x' + 'cc'.repeat(32),
  fundingAddress: POOL.address,
  fundingScript: POOL.script,
  amount: 1000n,
  tokenId: '0x00',
});

describe('pool script (RFC-038 V2 — non-custodial)', () => {
  it('builds a deterministic pool script + address', () => {
    const first = buildAndHashPoolScript({ operatorPublicKeyDigest: OP, ownerPublicKeyDigest: OWNER, exitBlock: EXIT_BLOCK });
    const second = buildAndHashPoolScript({ operatorPublicKeyDigest: OP, ownerPublicKeyDigest: OWNER, exitBlock: EXIT_BLOCK });
    expect(first.script).toBe(second.script);
    expect(first.address).toBe(poolScriptAddress(first.script));
  });

  it('has a unilateral owner-exit branch after the exit block', () => {
    expect(POOL.script).toContain('IF @BLOCK GT EXITBLOCK THEN');
    expect(POOL.script).toMatch(/RETURN SIGNEDBY\(0X[0-9A-F]+\)/);
    expect(POOL.script).toContain('@BLOCK GT EXITBLOCK');
  });

  it('keeps cooperative updates co-signed, epoch-monotone, value-confined and exit-block-immutable', () => {
    expect(POOL.script).toContain('ASSERT EPOCH GT PREVSTATE(101)');
    expect(POOL.script).toContain('ASSERT SAMESTATE(102 102)');
    expect(POOL.script).toContain('ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)');
    expect(POOL.script).toContain('RETURN MULTISIG(2');
    expect(POOL.script).toContain('STATE(101)');
    expect(POOL.script).toContain('STATE(102)');
  });

  it('rejects a malformed key digest or exit block', () => {
    expect(() => buildAndHashPoolScript({ operatorPublicKeyDigest: '0xZZ', ownerPublicKeyDigest: OWNER, exitBlock: 1 })).toThrow(/64 hex/);
    expect(() => buildAndHashPoolScript({ operatorPublicKeyDigest: OP, ownerPublicKeyDigest: OWNER, exitBlock: -1 })).toThrow(/exitBlock/);
  });

  it('carries root + epoch + exit block as state variables', () => {
    expect(poolStateVariables('0xdead', 3, 500)).toEqual([
      { port: 100, value: '0xdead', type: 'string' },
      { port: 101, value: 3n, type: 'number' },
      { port: 102, value: 500n, type: 'number' },
    ]);
  });
});

describe('anchorBatch (RFC-038 V1)', () => {
  it('builds a stable batch-anchor digest', () => {
    const a = buildBatchAnchorDraft(params());
    const b = buildBatchAnchorDraft(params());
    expect(Buffer.from(batchAnchorDigest(a)).toString('hex')).toBe(Buffer.from(batchAnchorDigest(b)).toString('hex'));
  });

  it('rejects a funding input that is not the pool output', () => {
    expect(() => buildBatchAnchorDraft({ ...params(), fundingScript: 'RETURN TRUE' })).toThrow(/pool script/);
    expect(() => buildBatchAnchorDraft({ ...params(), fundingAddress: '0x' + '99'.repeat(32) })).toThrow(/pool address/);
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
    expect(result.proof).toBeTruthy();
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

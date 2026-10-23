/** VTXO hardening suite — H2, H3, H5. */
import { createPool } from '../pool';
import { mintVtxo } from '../vtxo';
import { buildVtxoReceiptPayload, signVtxoReceipt, verifyVtxoReceipt } from '../receipt';
import { checkPoolFunding } from '../anchor';
import { MemoryOmniaVtxoStore } from '../memory-store';
import { createDurableOmniaVtxoStore } from '../durable-store';
import { MemoryStore } from '@totemsdk/storage';
import { transferVtxo } from '../transfer';
import type { OmniaVtxoOperator } from '../types';

const NOW = 1_000_000;
const hex = (bytes: Uint8Array) => '0x' + Buffer.from(bytes).toString('hex');

function mockOperator(): OmniaVtxoOperator {
  return {
    poolId: 'pool-1',
    sign: async (data: Uint8Array) => `sig:${hex(data)}`,
    verify: async (data: Uint8Array, sig: string) => sig === `sig:${hex(data)}`,
  };
}

function setupVtxo(nonce = 'h') {
  const pool = createPool({ operator: 'op', tokenId: '0x00', totalCapacity: 10_000n, nonce }, NOW);
  const { vtxo, receipt } = mintVtxo(pool, { owner: 'alice', amount: 1_000n, nonce: `${nonce}-mint` }, NOW);
  return { pool, vtxo, receipt };
}

describe('H2 — receipt security', () => {
  it('signs the canonical receipt and rejects root/epoch/output tampering', async () => {
    const { vtxo, receipt } = setupVtxo('h2');
    const operator = mockOperator();
    const batch = { outputs: [vtxo], root: vtxo.proof.root, epoch: receipt.epoch };
    const signed = await signVtxoReceipt(operator, receipt, batch);
    expect(await verifyVtxoReceipt(operator, signed, batch.root)).toBe(true);

    expect(() => buildVtxoReceiptPayload(receipt, { ...batch, root: '0'.repeat(64) })).toThrow();
    expect(() => buildVtxoReceiptPayload(receipt, { ...batch, epoch: receipt.epoch + 1 })).toThrow();
    expect(() => buildVtxoReceiptPayload(receipt, { ...batch, outputs: [] })).toThrow();
    expect(await verifyVtxoReceipt(operator, { ...signed, signature: 'forged' }, batch.root)).toBe(false);
  });
});

describe('H3 — pool funding proof', () => {
  const coin = { coinid: '0x' + '11'.repeat(32), address: '0xpool', amount: '1000', tokenid: '0x00', spent: false };
  const expected = { address: '0xpool', amount: '1000', tokenId: '0x00' };
  function provider(overrides: Record<string, unknown> = {}) {
    return {
      getCoin: jest.fn(async () => ({ ...coin, ...overrides })),
      getProof: jest.fn(async () => ({ proof: 'valid' })),
    } as any;
  }

  it('accepts a matching unspent coin and reports proof verification only when a verifier runs', async () => {
    const noVerifier = await checkPoolFunding(coin.coinid, expected, provider());
    expect(noVerifier.ok).toBe(true);
    expect(noVerifier.proofVerified).toBe(false);

    const verified = await checkPoolFunding(coin.coinid, expected, provider(), {
      verifyProof: (proof) => (proof as { proof: string }).proof === 'valid',
    });
    expect(verified.ok).toBe(true);
    expect(verified.proofVerified).toBe(true);
  });

  it('fails closed on spent, mismatched and proof-missing coins', async () => {
    expect((await checkPoolFunding(coin.coinid, expected, provider({ spent: true }))).ok).toBe(false);
    expect((await checkPoolFunding(coin.coinid, expected, provider({ amount: '999' }))).ok).toBe(false);
    expect((await checkPoolFunding(coin.coinid, expected, provider({ address: '0xother' }))).ok).toBe(false);
    const noProof = provider();
    noProof.getProof = jest.fn(async () => null);
    expect((await checkPoolFunding(coin.coinid, expected, noProof)).ok).toBe(false);
  });
});

describe('H4 — durable restart', () => {
  it('reopens the registry with spent state and history intact', async () => {
    const adapter = new MemoryStore();
    let store = createDurableOmniaVtxoStore(adapter, { requireAckMode: 'volatile' });
    const { pool, vtxo } = setupVtxo('h4');
    await store.savePool(pool);
    await store.saveVtxo(vtxo);
    await store.markVtxoSpent(vtxo.vtxoId, NOW + 1);

    store = createDurableOmniaVtxoStore(adapter, { requireAckMode: 'volatile' });
    const reopened = await store.getVtxo(vtxo.vtxoId);
    expect(reopened?.status).toBe('spent');
    expect(reopened?.history.at(-1)).toEqual({ op: 'spent', at: NOW + 1 });
    expect((await store.getPool(pool.poolId))?.poolId).toBe(pool.poolId);
  });
});

describe('H5 — one-time use at the store boundary', () => {
  it('refuses a second spend and refuses transfer of a spent VTXO', async () => {
    const { vtxo } = setupVtxo('h5');
    const store = new MemoryOmniaVtxoStore();
    await store.saveVtxo(vtxo);
    await store.markVtxoSpent(vtxo.vtxoId, NOW + 1);
    await expect(store.markVtxoSpent(vtxo.vtxoId, NOW + 2)).rejects.toThrow();
    await expect(store.saveVtxo(vtxo)).rejects.toThrow(/resurrect/);
    expect((await store.getVtxo(vtxo.vtxoId))?.status).toBe('spent');
    expect(() => transferVtxo({ ...vtxo, status: 'spent' }, {
      recipient: 'bob', amount: 1_000n, nonce: 'h5-spent',
    }, NOW + 3)).toThrow();
  });
});

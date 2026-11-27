import { MemoryStore, createJournal } from '@totemsdk/storage';
import { computeCommitmentRoot, computeVtxoLeaf } from '../commitment';
import { signVtxoReceipt } from '../receipt';
import { EpochAuthority, type EpochEvent } from '../epoch-authority';
import type { OmniaVtxo, OmniaVtxoOperator, VtxoOperatorReceipt } from '../types';

const POOL = 'pool-epoch';
const operator = {
  poolId: POOL,
  sign: async (data: Uint8Array) => Buffer.from(data).toString('hex'),
  verify: async (data: Uint8Array, sig: string) => Buffer.from(data).toString('hex') === sig,
} as OmniaVtxoOperator;

function vtxo(id: string, amount: bigint): OmniaVtxo {
  return {
    vtxoId: id,
    poolId: POOL,
    owner: '0x' + '11'.repeat(32),
    amount,
    tokenId: '0x00',
    status: 'active',
    epoch: 1,
    proof: { leaf: '', root: '', siblings: [], positions: [], epoch: 1, batchId: '' },
    history: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

function receipt(over: Partial<VtxoOperatorReceipt> = {}): VtxoOperatorReceipt {
  return {
    receiptId: 'r-1',
    poolId: POOL,
    op: 'transfer',
    inputIds: ['v1'],
    outputIds: ['v2', 'v3'],
    epoch: 1,
    at: 1,
    signature: '',
    ...over,
  };
}

async function signed(receiptIn: VtxoOperatorReceipt, outputs: OmniaVtxo[], inputsAmount: bigint) {
  const root = computeCommitmentRoot(outputs.map(computeVtxoLeaf));
  const signedReceipt = await signVtxoReceipt(operator, receiptIn, {
    outputs,
    root,
    epoch: receiptIn.epoch,
    inputsAmount,
  });
  return { root, receipt: signedReceipt };
}

function journal() {
  return createJournal<EpochEvent>(new MemoryStore(), {
    namespace: `test-epoch:${Math.random()}:v1:`,
    requireAckMode: 'volatile',
  });
}

describe('EpochAuthority (V0 spend-state)', () => {
  const outputs1 = [vtxo('v2', 100n), vtxo('v3', 200n)];

  it('records a signed receipt and verifies it against the current epoch/root', async () => {
    const j = journal();
    const authority = new EpochAuthority({ poolId: POOL, journal: j, operator });
    const { root, receipt: r1 } = await signed(receipt(), outputs1, 300n);
    await authority.append(r1, root);

    expect(await authority.verifyReceipt(r1, root)).toBe(true);
    expect(await authority.verifyReceipt(r1, '0x' + 'ff'.repeat(32))).toBe(false);
    expect((await authority.current()).epoch).toBe(1);
  });

  it('rejects a stale receipt and a conflicting root for one epoch', async () => {
    const j = journal();
    const authority = new EpochAuthority({ poolId: POOL, journal: j, operator });
    const one = await signed(receipt(), outputs1, 300n);
    await authority.append(one.receipt, one.root);

    const two = await signed(receipt({ receiptId: 'r-2', epoch: 2, inputIds: ['v2'], outputIds: ['v4'] }), [vtxo('v4', 100n)], 100n);
    await authority.append(two.receipt, two.root);

    await expect(authority.append(one.receipt, one.root)).rejects.toThrow(/stale/);
    const conflicting = await signed(receipt({ receiptId: 'r-conflict', epoch: 2, inputIds: ['v3'], outputIds: ['v5'] }), [vtxo('v5', 200n)], 200n);
    await expect(authority.append(conflicting.receipt, conflicting.root)).rejects.toThrow(/conflicting root/);
  });

  it('rejects a second spend of an already-used input', async () => {
    const j = journal();
    const authority = new EpochAuthority({ poolId: POOL, journal: j, operator });
    const one = await signed(receipt(), outputs1, 300n);
    await authority.append(one.receipt, one.root);

    const doubleSpend = await signed(
      receipt({ receiptId: 'r-double', epoch: 2, inputIds: ['v1'], outputIds: ['v6'] }),
      [vtxo('v6', 100n)],
      100n,
    );
    await expect(authority.append(doubleSpend.receipt, doubleSpend.root)).rejects.toThrow(/already spent/);
  });

  it('rejects an invalid receipt signature', async () => {
    const j = journal();
    const authority = new EpochAuthority({ poolId: POOL, journal: j, operator });
    const { root, receipt: r1 } = await signed(receipt(), outputs1, 300n);
    await expect(authority.append({ ...r1, at: r1.at + 1 }, root)).rejects.toThrow(/signature/);
  });

  it('recovers a durable but unpublished epoch after a restart', async () => {
    const j = journal();
    const authority = new EpochAuthority({ poolId: POOL, journal: j, operator });
    const one = await signed(receipt(), outputs1, 300n);
    await authority.append(one.receipt, one.root);

    const two = await signed(
      receipt({ receiptId: 'r-2', epoch: 2, inputIds: ['v2'], outputIds: ['v4'] }),
      [vtxo('v4', 100n)],
      100n,
    );
    await authority.append(two.receipt, two.root);

    const reopened = new EpochAuthority({ poolId: POOL, journal: j, operator });
    const recovery = await reopened.recover();
    expect(recovery.pending.map((e) => e.epoch)).toEqual([1, 2]);

    await reopened.markPublished(2);
    const after = await reopened.recover();
    expect(after.pending).toEqual([]);
    expect(after.publishedEpoch).toBe(2);
  });

  it('treats a lost acknowledgement as an idempotent retry', async () => {
    const j = journal();
    const authority = new EpochAuthority({ poolId: POOL, journal: j, operator });
    const one = await signed(receipt(), outputs1, 300n);
    const first = await authority.append(one.receipt, one.root);
    const retry = await authority.append(one.receipt, one.root);
    expect(retry).toEqual(first);
  });

  it('rejects an offline acceptance of an earlier snapshot', async () => {
    const j = journal();
    const authority = new EpochAuthority({ poolId: POOL, journal: j, operator });
    const one = await signed(receipt(), outputs1, 300n);
    await authority.append(one.receipt, one.root);
    const two = await signed(
      receipt({ receiptId: 'r-2', epoch: 2, inputIds: ['v2'], outputIds: ['v4'] }),
      [vtxo('v4', 100n)],
      100n,
    );
    await authority.append(two.receipt, two.root);

    expect(await authority.verifyReceipt(one.receipt, one.root)).toBe(false);
    await expect(authority.append(one.receipt, one.root)).rejects.toThrow(/stale/);
  });

  it('OMN-106: serialises concurrent appends so only one claim can win an input', async () => {
    const j = journal();
    const authority = new EpochAuthority({ poolId: POOL, journal: j, operator });
    const a = await signed(receipt({ receiptId: 'r-a', inputIds: ['v1'], outputIds: ['v2'] }), [vtxo('v2', 100n)], 100n);
    const b = await signed(receipt({ receiptId: 'r-b', inputIds: ['v1'], outputIds: ['v9'] }), [vtxo('v9', 100n)], 100n);

    const results = await Promise.allSettled([
      authority.append(a.receipt, a.root),
      authority.append(b.receipt, b.root),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(1);
    const state = await authority.current();
    expect([...state.spentInputIds]).toContain('v1');
    expect(state.epoch).toBe(1);
  });

  it('OMN-106: two authorities over one journal resolve the race deterministically', async () => {
    const j = journal();
    const one = new EpochAuthority({ poolId: POOL, journal: j, operator });
    const two = new EpochAuthority({ poolId: POOL, journal: j, operator });
    const a = await signed(receipt({ receiptId: 'r-a', inputIds: ['v1'], outputIds: ['v2'] }), [vtxo('v2', 100n)], 100n);
    const b = await signed(receipt({ receiptId: 'r-b', inputIds: ['v1'], outputIds: ['v9'] }), [vtxo('v9', 100n)], 100n);

    const results = await Promise.allSettled([
      one.append(a.receipt, a.root),
      two.append(b.receipt, b.root),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    // Exactly one signed epoch exists; no second signature was produced.
    const records = (await j.read()).map((e) => e.record).filter((e) => e.kind === 'epoch');
    expect(records).toHaveLength(1);
  });

  it('OMN-106: a reservation left by a crash is reported and resumable', async () => {
    const j = journal();
    const authority = new EpochAuthority({ poolId: POOL, journal: j, operator });
    const { root, receipt: r1 } = await signed(receipt(), outputs1, 300n);
    // Simulate a crash between reservation and the signed epoch record.
    await j.append({
      kind: 'claim',
      poolId: POOL,
      epoch: 1,
      root,
      receiptId: r1.receiptId,
      inputIds: [...r1.inputIds],
      at: 1,
    });

    const reopened = new EpochAuthority({ poolId: POOL, journal: j, operator });
    expect((await reopened.recover()).unfinishedClaims.map((c) => c.receiptId)).toEqual(['r-1']);
    await reopened.append(r1, root);
    expect((await reopened.recover()).unfinishedClaims).toEqual([]);
    expect((await reopened.current()).epoch).toBe(1);
  });

  it('OMN-107: recovery rejects a tampered epoch signature', async () => {
    const j = journal();
    const authority = new EpochAuthority({ poolId: POOL, journal: j, operator });
    const one = await signed(receipt(), outputs1, 300n);
    await authority.append(one.receipt, one.root);

    const events = (await j.read()).map((e) => e.record);
    const bad = events.map((e) =>
      e.kind === 'epoch' ? { ...e, signature: 'deadbeef' } : e,
    );
    const forged = createJournal<EpochEvent>(new MemoryStore(), {
      namespace: `test-epoch-forged:${Math.random()}:v1:`,
      requireAckMode: 'volatile',
    });
    for (const record of bad) await forged.append(record);

    const reopened = new EpochAuthority({ poolId: POOL, journal: forged, operator });
    await expect(reopened.recover()).rejects.toThrow(/signature does not verify/);
  });

  it('OMN-107: recovery rejects two roots for one epoch', async () => {
    const j = journal();
    const authority = new EpochAuthority({ poolId: POOL, journal: j, operator });
    const a = await signed(receipt({ receiptId: 'r-a', inputIds: ['v1'], outputIds: ['v2'] }), [vtxo('v2', 100n)], 100n);
    const b = await signed(receipt({ receiptId: 'r-b', inputIds: ['v3'], outputIds: ['v9'] }), [vtxo('v9', 100n)], 100n);
    await j.append({ kind: 'epoch', poolId: POOL, epoch: 1, root: a.root, receiptId: 'r-a', inputIds: ['v1'], outputIds: ['v2'], at: 1, signature: '' });
    await j.append({ kind: 'epoch', poolId: POOL, epoch: 1, root: b.root, receiptId: 'r-b', inputIds: ['v3'], outputIds: ['v9'], at: 1, signature: '' });
    await expect(authority.recover()).rejects.toThrow(/signature does not verify|two receipts/);
  });

  it('rejects an epoch gap', async () => {
    const j = journal();
    const authority = new EpochAuthority({ poolId: POOL, journal: j, operator });
    const one = await signed(receipt(), outputs1, 300n);
    await authority.append(one.receipt, one.root);
    const gap = await signed(
      receipt({ receiptId: 'r-gap', epoch: 3, inputIds: ['v3'], outputIds: ['v7'] }),
      [vtxo('v7', 200n)],
      200n,
    );
    await expect(authority.append(gap.receipt, gap.root)).rejects.toThrow(/epoch gap/);
  });
});

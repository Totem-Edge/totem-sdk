import { createPool } from '../pool';
import { mintVtxo } from '../vtxo';
import {
  markExiting,
  markExited,
  markExitBroadcast,
  markExitConfirmed,
  markExitSettled,
  createExitDraft,
  createMemoryExitDraftStore,
  consumeExitReceipt,
} from '../exit';
import { VtxoStatusError, VtxoExitError, VtxoProofError } from '../errors';
import { OmniaVtxo } from '../types';

const NOW = 1000;
const EXIT_TXPOW = '0x' + '77'.repeat(32);

function setup() {
  const pool = createPool(
    { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n1' },
    NOW
  );
  const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(500), nonce: 'mint-1' }, NOW);
  return { pool, vtxo };
}

const store = () => createMemoryExitDraftStore();

describe('markExiting', () => {
  it('transitions active → exiting', () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, NOW + 1);
    expect(exiting.status).toBe('exiting');
  });

  it('throws VtxoStatusError for non-active vtxo', () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, NOW + 1);
    expect(() => markExiting(exiting, NOW + 2)).toThrow(VtxoStatusError);
  });

  it('adds exit_initiated to history', () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, NOW + 1);
    const last = exiting.history[exiting.history.length - 1];
    expect(last.op).toBe('exit_initiated');
    expect(last.at).toBe(NOW + 1);
  });

  it('uses injected now timestamp', () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, 42000);
    expect(exiting.updatedAt).toBe(42000);
  });
});

describe('OMN-089 exit progress', () => {
  it('broadcast records the transaction but does not claim confirmation', () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, NOW + 1);
    const broadcast = markExitBroadcast(exiting, { txpowId: EXIT_TXPOW, now: NOW + 2 });
    expect(broadcast.status).toBe('exiting');
    expect(broadcast.exitState).toBe('broadcast');
    expect(broadcast.exitTxpowId).toBe(EXIT_TXPOW);
  });

  it('confirmation requires a chain verifier that confirms the transaction', async () => {
    const { vtxo } = setup();
    const exiting = markExitBroadcast(markExiting(vtxo, NOW + 1), { txpowId: EXIT_TXPOW });
    const confirmed = await markExitConfirmed(exiting, {
      txpowId: EXIT_TXPOW,
      verify: async () => ({ confirmed: true, block: 42, owner: 'alice', amount: '500' }),
    });
    expect(confirmed.exitState).toBe('confirmed');
    expect(confirmed.exitBlock).toBe(42);
    expect(confirmed.status).toBe('exiting');
  });

  it('a verifier that cannot see the transaction refuses confirmation', async () => {
    const { vtxo } = setup();
    const exiting = markExitBroadcast(markExiting(vtxo, NOW + 1), { txpowId: EXIT_TXPOW });
    await expect(markExitConfirmed(exiting, {
      txpowId: EXIT_TXPOW,
      verify: async () => ({ confirmed: false }),
    })).rejects.toThrow(/did not confirm/);
  });

  it('confirmation rejects an exit that pays another owner', async () => {
    const { vtxo } = setup();
    const exiting = markExitBroadcast(markExiting(vtxo, NOW + 1), { txpowId: EXIT_TXPOW });
    await expect(markExitConfirmed(exiting, {
      txpowId: EXIT_TXPOW,
      verify: async () => ({ confirmed: true, block: 1, owner: 'mallory' }),
    })).rejects.toThrow(/pays mallory/);
  });

  it('settlement requires confirmation', () => {
    const { vtxo } = setup();
    const broadcast = markExitBroadcast(markExiting(vtxo, NOW + 1), { txpowId: EXIT_TXPOW });
    expect(() => markExitSettled(broadcast, { txpowId: EXIT_TXPOW })).toThrow(/no confirmation evidence/);

    const settled = markExitSettled(broadcast, {
      txpowId: EXIT_TXPOW,
      evidence: { confirmed: true },
      now: NOW + 5,
    });
    expect(settled.status).toBe('exited');
    expect(settled.exitState).toBe('settled');
  });

  it('markExited refuses a bare transaction id', () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, NOW + 1);
    expect(() => markExited(exiting, { txpowId: EXIT_TXPOW, now: NOW + 2 }))
      .toThrow(/supply chain evidence/);
  });

  it('markExited accepts explicit evidence', () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, NOW + 1);
    const exited = markExited(exiting, {
      txpowId: EXIT_TXPOW,
      evidence: { confirmed: true, block: 10 },
      now: NOW + 2,
    });
    expect(exited.status).toBe('exited');
    expect(exited.exitState).toBe('settled');
  });

  it('markExited accepts an explicit trusted declaration', () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, NOW + 1);
    const exited = markExited(exiting, { txpowId: EXIT_TXPOW, trusted: true, now: NOW + 2 });
    expect(exited.status).toBe('exited');
  });

  it('throws VtxoStatusError if not exiting', () => {
    const { vtxo } = setup();
    expect(() => markExited(vtxo, { txpowId: EXIT_TXPOW, trusted: true, now: NOW + 1 }))
      .toThrow(VtxoStatusError);
  });

  it('OMN-042: refuses to finalize without an exit transaction id', () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, NOW + 1);
    expect(() => markExited(exiting, { txpowId: '', trusted: true, now: NOW + 2 })).toThrow(VtxoExitError);
  });

  it('adds exit_complete to history', () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, NOW + 1);
    const exited = markExited(exiting, { txpowId: EXIT_TXPOW, trusted: true, now: NOW + 2 });
    const last = exited.history[exited.history.length - 1];
    expect(last.op).toBe('exit_complete');
  });
});

describe('createExitDraft', () => {
  it('returns draftType vtxo-exit for active vtxo with valid proof', async () => {
    const { vtxo } = setup();
    const { draft } = await createExitDraft(vtxo, store(), NOW + 1);
    expect(draft.draftType).toBe('vtxo-exit');
    expect(draft.vtxoId).toBe(vtxo.vtxoId);
    expect(draft.owner).toBe(vtxo.owner);
    expect(draft.amount).toBe(vtxo.amount);
    expect(draft.poolId).toBe(vtxo.poolId);
    expect(draft.tokenId).toBe(vtxo.tokenId);
  });

  it('returns draftType vtxo-exit for exiting vtxo', async () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, NOW + 1);
    const { draft } = await createExitDraft(exiting, store(), NOW + 2);
    expect(draft.draftType).toBe('vtxo-exit');
  });

  it('throws VtxoExitError for invalid terminal status', async () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, NOW + 1);
    const exited = markExited(exiting, { txpowId: EXIT_TXPOW, trusted: true, now: NOW + 2 });
    await expect(createExitDraft(exited, store(), NOW + 3)).rejects.toThrow(VtxoExitError);
  });

  it('throws VtxoProofError when proof leaf is tampered', async () => {
    const { vtxo } = setup();
    const tampered: OmniaVtxo = {
      ...vtxo,
      proof: { ...vtxo.proof, leaf: '0'.repeat(64) },
    };
    await expect(createExitDraft(tampered, store(), NOW + 1)).rejects.toThrow(VtxoProofError);
  });

  it('succeeds for active vtxo with no proof (empty leaf)', async () => {
    const { vtxo } = setup();
    const noProof: OmniaVtxo = {
      ...vtxo,
      proof: { ...vtxo.proof, leaf: '' },
    };
    const { draft } = await createExitDraft(noProof, store(), NOW + 1);
    expect(draft.draftType).toBe('vtxo-exit');
  });

  it('receipt has op=exit_initiated', async () => {
    const { vtxo } = setup();
    const { receipt } = await createExitDraft(vtxo, store(), NOW + 1);
    expect(receipt.op).toBe('exit_initiated');
    expect(receipt.draftType).toBe('vtxo-exit');
  });

  it('draft has timelockSeconds', async () => {
    const { vtxo } = setup();
    const { draft } = await createExitDraft(vtxo, store(), NOW + 1);
    expect(draft.timelockSeconds).toBeGreaterThan(0);
  });

  it('uses injected now for draft.createdAt', async () => {
    const { vtxo } = setup();
    const { draft } = await createExitDraft(vtxo, store(), 55555);
    expect(draft.createdAt).toBe(55555);
  });

  it('caps the exit at the verified share', async () => {
    const { vtxo } = setup();
    const { draft } = await createExitDraft(vtxo, store(), NOW + 1);
    expect(draft.verifiedShare).toBe(vtxo.amount);
  });
});

describe('OMN-088 exit drafts reserve the VTXO', () => {
  it('consumes the receipt as part of the reservation', async () => {
    const { vtxo } = setup();
    const first = await createExitDraft(vtxo, store(), NOW + 1);
    expect(first.created).toBe(true);
    expect(first.vtxo.exitConsumedAt).toBe(NOW + 1);
    expect(first.vtxo.exitReceiptId).toBe(first.receipt.receiptId);
  });

  it('a repeat request returns the original draft instead of a competing one', async () => {
    const { vtxo } = setup();
    const reservationStore = store();
    const first = await createExitDraft(vtxo, reservationStore, NOW + 1);
    const second = await createExitDraft(first.vtxo, reservationStore, NOW + 9);

    expect(second.created).toBe(false);
    expect(second.draft).toEqual(first.draft);
    expect(second.receipt.receiptId).toBe(first.receipt.receiptId);
  });

  it('a second caller with a stale VTXO copy cannot create a second draft', async () => {
    const { vtxo } = setup();
    const reservationStore = store();
    const first = await createExitDraft(vtxo, reservationStore, NOW + 1);
    // The stale copy still looks active, but the store is authoritative.
    const second = await createExitDraft(vtxo, reservationStore, NOW + 2);
    expect(second.created).toBe(false);
    expect(second.receipt.receiptId).toBe(first.receipt.receiptId);
  });

  it('refuses to draft a VTXO marked consumed with no reservation record', async () => {
    const { vtxo } = setup();
    const consumed = consumeExitReceipt(vtxo, 'receipt-x', NOW + 1);
    await expect(createExitDraft(consumed, store(), NOW + 2))
      .rejects.toThrow(/exit store has no record/);
  });

  it('refuses to consume an exit receipt twice', () => {
    const { vtxo } = setup();
    const consumed = consumeExitReceipt(vtxo, 'r-1', NOW + 1);
    expect(() => consumeExitReceipt(consumed, 'r-2', NOW + 2)).toThrow(/already consumed/);
  });
});

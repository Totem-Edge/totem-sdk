import { createPool } from '../pool';
import { mintVtxo } from '../vtxo';
import { markExiting, markExited, createExitDraft, consumeExitReceipt } from '../exit';
import { VtxoStatusError, VtxoExitError, VtxoProofError } from '../errors';
import { OmniaVtxo } from '../types';

const NOW = 1000;

function setup() {
  const pool = createPool(
    { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n1' },
    NOW
  );
  const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(500), nonce: 'mint-1' }, NOW);
  return { pool, vtxo };
}

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

describe('markExited', () => {
  it('transitions exiting → exited', () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, NOW + 1);
    const exited = markExited(exiting, NOW + 2);
    expect(exited.status).toBe('exited');
  });

  it('throws VtxoStatusError if not exiting', () => {
    const { vtxo } = setup();
    expect(() => markExited(vtxo, NOW + 1)).toThrow(VtxoStatusError);
  });

  it('adds exit_complete to history', () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, NOW + 1);
    const exited = markExited(exiting, NOW + 2);
    const last = exited.history[exited.history.length - 1];
    expect(last.op).toBe('exit_complete');
  });
});

describe('createExitDraft', () => {
  it('returns draftType mock-exit for active vtxo with valid proof', () => {
    const { vtxo } = setup();
    const { draft } = createExitDraft(vtxo, NOW + 1);
    expect(draft.draftType).toBe('mock-exit');
    expect(draft.vtxoId).toBe(vtxo.vtxoId);
    expect(draft.owner).toBe(vtxo.owner);
    expect(draft.amount).toBe(vtxo.amount);
    expect(draft.poolId).toBe(vtxo.poolId);
    expect(draft.tokenId).toBe(vtxo.tokenId);
  });

  it('returns draftType mock-exit for exiting vtxo', () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, NOW + 1);
    const { draft } = createExitDraft(exiting, NOW + 2);
    expect(draft.draftType).toBe('mock-exit');
  });

  it('throws VtxoExitError for invalid terminal status', () => {
    const { vtxo } = setup();
    const exiting = markExiting(vtxo, NOW + 1);
    const exited = markExited(exiting, NOW + 2);
    expect(() => createExitDraft(exited, NOW + 3)).toThrow(VtxoExitError);
  });

  it('throws VtxoProofError when proof leaf is tampered', () => {
    const { vtxo } = setup();
    const tampered: OmniaVtxo = {
      ...vtxo,
      proof: { ...vtxo.proof, leaf: '0'.repeat(64) },
    };
    expect(() => createExitDraft(tampered, NOW + 1)).toThrow(VtxoProofError);
  });

  it('succeeds for active vtxo with no proof (empty leaf)', () => {
    const { vtxo } = setup();
    const noProof: OmniaVtxo = {
      ...vtxo,
      proof: { ...vtxo.proof, leaf: '' },
    };
    const { draft } = createExitDraft(noProof, NOW + 1);
    expect(draft.draftType).toBe('mock-exit');
  });

  it('receipt has op=exit_initiated', () => {
    const { vtxo } = setup();
    const { receipt } = createExitDraft(vtxo, NOW + 1);
    expect(receipt.op).toBe('exit_initiated');
    expect(receipt.draftType).toBe('mock-exit');
  });

  it('draft has timelockSeconds', () => {
    const { vtxo } = setup();
    const { draft } = createExitDraft(vtxo, NOW + 1);
    expect(draft.timelockSeconds).toBeGreaterThan(0);
  });

  it('uses injected now for draft.createdAt', () => {
    const { vtxo } = setup();
    const { draft } = createExitDraft(vtxo, 55555);
    expect(draft.createdAt).toBe(55555);
  });

  it('caps the exit at the verified share', () => {
    const { vtxo } = setup();
    const { draft } = createExitDraft(vtxo, NOW + 1);
    expect(draft.verifiedShare).toBe(vtxo.amount);
  });
});

describe('double-exit prevention (#28)', () => {
  it('refuses a second exit draft after the receipt is consumed', () => {
    const { vtxo } = setup();
    const { receipt } = createExitDraft(vtxo, NOW + 1);
    const consumed = consumeExitReceipt(vtxo, receipt.receiptId, NOW + 2);
    expect(consumed.exitConsumedAt).toBe(NOW + 2);
    expect(consumed.exitReceiptId).toBe(receipt.receiptId);
    expect(() => createExitDraft(consumed, NOW + 3)).toThrow(/exit already consumed/);
  });

  it('refuses to consume an exit receipt twice', () => {
    const { vtxo } = setup();
    const consumed = consumeExitReceipt(vtxo, 'r-1', NOW + 1);
    expect(() => consumeExitReceipt(consumed, 'r-2', NOW + 2)).toThrow(/already consumed/);
  });
});

describe('mint funding proof (#28)', () => {
  it('records the on-chain funding proof at mint', () => {
    const pool = createPool(
      { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n1' },
      NOW,
    );
    const fundingProof = { fundingCoinId: '0xFUND', txpowId: '0xTXPOW' };
    const { vtxo } = mintVtxo(
      pool,
      { owner: 'alice', amount: BigInt(500), nonce: 'mint-1', fundingProof },
      NOW,
    );
    expect(vtxo.fundingProof).toEqual(fundingProof);
  });
});

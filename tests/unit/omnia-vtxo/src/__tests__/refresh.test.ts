import { createPool } from '../pool';
import { mintVtxo } from '../vtxo';
import { refreshVtxo } from '../refresh';
import { VtxoStatusError, VtxoPolicyError } from '../errors';

const NOW = 1000;

function setup() {
  const pool = createPool(
    { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n1' },
    NOW
  );
  const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(500), nonce: 'mint-1' }, NOW);
  return { pool, vtxo };
}

describe('refreshVtxo', () => {
  it('transitions old to refreshed, new to active', () => {
    const { vtxo } = setup();
    const { old, refreshed } = refreshVtxo(vtxo, { newEpoch: 1, nonce: 'ref-1' }, NOW + 1);
    expect(old.status).toBe('refreshed');
    expect(refreshed.status).toBe('active');
  });

  it('new vtxo has updated epoch', () => {
    const { vtxo } = setup();
    const { refreshed } = refreshVtxo(vtxo, { newEpoch: 5, nonce: 'ref-1' }, NOW + 1);
    expect(refreshed.epoch).toBe(5);
  });

  it('preserves owner, amount, tokenId, poolId', () => {
    const { vtxo } = setup();
    const { refreshed } = refreshVtxo(vtxo, { newEpoch: 1, nonce: 'ref-1' }, NOW + 1);
    expect(refreshed.owner).toBe(vtxo.owner);
    expect(refreshed.amount).toBe(vtxo.amount);
    expect(refreshed.tokenId).toBe(vtxo.tokenId);
    expect(refreshed.poolId).toBe(vtxo.poolId);
  });

  it('throws VtxoPolicyError for same epoch', () => {
    const { vtxo } = setup();
    expect(() => refreshVtxo(vtxo, { newEpoch: 0, nonce: 'ref-1' }, NOW + 1))
      .toThrow(VtxoPolicyError);
  });

  it('throws VtxoPolicyError for lower epoch', () => {
    const { vtxo } = setup();
    const { refreshed } = refreshVtxo(vtxo, { newEpoch: 5, nonce: 'ref-1' }, NOW + 1);
    expect(() => refreshVtxo(refreshed, { newEpoch: 3, nonce: 'ref-2' }, NOW + 2))
      .toThrow(VtxoPolicyError);
  });

  it('throws VtxoStatusError for non-active vtxo', () => {
    const { vtxo } = setup();
    const { old } = refreshVtxo(vtxo, { newEpoch: 1, nonce: 'ref-1' }, NOW + 1);
    expect(() => refreshVtxo(old, { newEpoch: 2, nonce: 'ref-2' }, NOW + 2))
      .toThrow(VtxoStatusError);
  });

  it('new vtxo has a populated proof', () => {
    const { vtxo } = setup();
    const { refreshed } = refreshVtxo(vtxo, { newEpoch: 1, nonce: 'ref-1' }, NOW + 1);
    expect(refreshed.proof.leaf).toHaveLength(64);
  });

  it('receipt has op=refresh and correct ids', () => {
    const { vtxo } = setup();
    const { receipt } = refreshVtxo(vtxo, { newEpoch: 1, nonce: 'ref-1' }, NOW + 1);
    expect(receipt.op).toBe('refresh');
    expect(receipt.inputIds).toContain(vtxo.vtxoId);
    expect(receipt.outputIds).toHaveLength(1);
  });

  it('preserves expiresAt', () => {
    const pool = createPool(
      { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n1' },
      NOW
    );
    const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(100), nonce: 'mint-x', expiresAt: 99999 }, NOW);
    const { refreshed } = refreshVtxo(vtxo, { newEpoch: 1, nonce: 'ref-1' }, NOW + 1);
    expect(refreshed.expiresAt).toBe(99999);
  });
});

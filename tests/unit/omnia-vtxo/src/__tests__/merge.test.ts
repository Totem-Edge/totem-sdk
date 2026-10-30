import { createPool } from '../pool';
import { mintVtxo } from '../vtxo';
import { mergeVtxos } from '../merge';
import { VtxoStatusError, VtxoMergeError, VtxoOwnershipError } from '../errors';
import { OmniaVtxo } from '../types';

const NOW = 1000;

function setup() {
  const pool = createPool(
    { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n1' },
    NOW
  );
  const { vtxo: v1 } = mintVtxo(pool, { owner: 'alice', amount: BigInt(400), nonce: 'mint-1' }, NOW);
  const { vtxo: v2 } = mintVtxo(pool, { owner: 'alice', amount: BigInt(600), nonce: 'mint-2' }, NOW);
  return { pool, v1, v2 };
}

describe('mergeVtxos — valid merge', () => {
  it('transitions inputs to merged, output to active', () => {
    const { v1, v2 } = setup();
    const { inputs, output } = mergeVtxos([v1, v2], { nonce: 'mg-1', owner: 'alice' }, NOW + 1);
    for (const i of inputs) expect(i.status).toBe('merged');
    expect(output.status).toBe('active');
  });

  it('output amount equals sum of inputs', () => {
    const { v1, v2 } = setup();
    const { output } = mergeVtxos([v1, v2], { nonce: 'mg-1', owner: 'alice' }, NOW + 1);
    expect(output.amount).toBe(BigInt(1000));
  });

  it('output has correct owner', () => {
    const { v1, v2 } = setup();
    const { output } = mergeVtxos([v1, v2], { nonce: 'mg-1', owner: 'alice' }, NOW + 1);
    expect(output.owner).toBe('alice');
  });

  it('output has proof', () => {
    const { v1, v2 } = setup();
    const { output } = mergeVtxos([v1, v2], { nonce: 'mg-1', owner: 'alice' }, NOW + 1);
    expect(output.proof.leaf).toHaveLength(64);
  });

  it('returns receipt with op=merge', () => {
    const { v1, v2 } = setup();
    const { receipt } = mergeVtxos([v1, v2], { nonce: 'mg-1', owner: 'alice' }, NOW + 1);
    expect(receipt.op).toBe('merge');
    expect(receipt.inputIds).toHaveLength(2);
    expect(receipt.outputIds).toHaveLength(1);
  });
});

describe('mergeVtxos — invalid cases', () => {
  it('throws VtxoMergeError for only one VTXO', () => {
    const { v1 } = setup();
    expect(() => mergeVtxos([v1], { nonce: 'mg-1', owner: 'alice' }, NOW + 1))
      .toThrow(VtxoMergeError);
  });

  it('throws VtxoMergeError for different pools', () => {
    const pool1 = createPool({ operator: 'op', tokenId: 't', totalCapacity: BigInt(1000), nonce: 'n1' }, NOW);
    const pool2 = createPool({ operator: 'op', tokenId: 't', totalCapacity: BigInt(1000), nonce: 'n2' }, NOW);
    const { vtxo: va } = mintVtxo(pool1, { owner: 'alice', amount: BigInt(100), nonce: 'ma' }, NOW);
    const { vtxo: vb } = mintVtxo(pool2, { owner: 'alice', amount: BigInt(100), nonce: 'mb' }, NOW);
    expect(() => mergeVtxos([va, vb], { nonce: 'mg', owner: 'alice' }, NOW + 1))
      .toThrow(VtxoMergeError);
  });

  it('throws VtxoMergeError for different tokens', () => {
    const pool1 = createPool({ operator: 'op', tokenId: 'token-A', totalCapacity: BigInt(1000), nonce: 'n1' }, NOW);
    const pool2 = createPool({ operator: 'op', tokenId: 'token-B', totalCapacity: BigInt(1000), nonce: 'n2' }, NOW);
    const { vtxo: va } = mintVtxo(pool1, { owner: 'alice', amount: BigInt(100), nonce: 'ma' }, NOW);
    const { vtxo: vb } = mintVtxo(pool2, { owner: 'alice', amount: BigInt(100), nonce: 'mb' }, NOW);
    expect(() => mergeVtxos([va, vb], { nonce: 'mg', owner: 'alice' }, NOW + 1))
      .toThrow(VtxoMergeError);
  });

  it('throws VtxoStatusError for inactive input', () => {
    const { v1, v2 } = setup();
    const { inputs } = mergeVtxos([v1, v2], { nonce: 'mg-1', owner: 'alice' }, NOW + 1);
    const { v1: v1b } = (() => {
      const pool = createPool({ operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n1' }, NOW);
      const { vtxo: v1b } = mintVtxo(pool, { owner: 'alice', amount: BigInt(400), nonce: 'mint-3' }, NOW);
      return { v1: v1b };
    })();
    expect(() => mergeVtxos([inputs[0], v1b], { nonce: 'mg-2', owner: 'alice' }, NOW + 2))
      .toThrow(VtxoStatusError);
  });

  it('throws VtxoMergeError for duplicate VTXO IDs', () => {
    const { v1 } = setup();
    expect(() => mergeVtxos([v1, v1], { nonce: 'mg-1', owner: 'alice' }, NOW + 1))
      .toThrow(VtxoMergeError);
  });

  it('throws VtxoOwnershipError when inputs have different owners', () => {
    const pool = createPool(
      { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n1' },
      NOW
    );
    const { vtxo: aliceVtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(400), nonce: 'ma' }, NOW);
    const { vtxo: bobVtxo } = mintVtxo(pool, { owner: 'bob', amount: BigInt(400), nonce: 'mb' }, NOW);
    expect(() => mergeVtxos([aliceVtxo, bobVtxo], { nonce: 'mg-1', owner: 'alice' }, NOW + 1))
      .toThrow(VtxoOwnershipError);
  });

  it('throws VtxoOwnershipError when output owner differs from input owner', () => {
    const { v1, v2 } = setup();
    expect(() => mergeVtxos([v1, v2], { nonce: 'mg-1', owner: 'carol' }, NOW + 1))
      .toThrow(VtxoOwnershipError);
  });
});

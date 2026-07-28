import { createPool } from '../pool';
import { mintVtxo } from '../vtxo';
import { splitVtxo } from '../split';
import { VtxoStatusError, VtxoAmountError, VtxoSplitError } from '../errors';

const NOW = 1000;

function setup() {
  const pool = createPool(
    { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n1' },
    NOW
  );
  const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(1000), nonce: 'mint-1' }, NOW);
  return { pool, vtxo };
}

describe('splitVtxo — valid split', () => {
  it('transitions input to split and outputs to active', () => {
    const { vtxo } = setup();
    const { input, outputs } = splitVtxo(vtxo, { amounts: [BigInt(400), BigInt(600)], nonces: ['n1', 'n2'] }, NOW + 1);
    expect(input.status).toBe('split');
    for (const o of outputs) expect(o.status).toBe('active');
  });

  it('output amounts sum equals input amount', () => {
    const { vtxo } = setup();
    const { outputs } = splitVtxo(vtxo, { amounts: [BigInt(300), BigInt(300), BigInt(400)], nonces: ['n1', 'n2', 'n3'] }, NOW + 1);
    const sum = outputs.reduce((s, o) => s + o.amount, BigInt(0));
    expect(sum).toBe(BigInt(1000));
  });

  it('preserves owner, tokenId, poolId on outputs', () => {
    const { vtxo } = setup();
    const { outputs } = splitVtxo(vtxo, { amounts: [BigInt(500), BigInt(500)], nonces: ['n1', 'n2'] }, NOW + 1);
    for (const o of outputs) {
      expect(o.owner).toBe('alice');
      expect(o.tokenId).toBe(vtxo.tokenId);
      expect(o.poolId).toBe(vtxo.poolId);
    }
  });

  it('outputs have proofs', () => {
    const { vtxo } = setup();
    const { outputs } = splitVtxo(vtxo, { amounts: [BigInt(500), BigInt(500)], nonces: ['n1', 'n2'] }, NOW + 1);
    for (const o of outputs) expect(o.proof.leaf).toHaveLength(64);
  });

  it('returns a receipt with op=split', () => {
    const { vtxo } = setup();
    const { receipt } = splitVtxo(vtxo, { amounts: [BigInt(500), BigInt(500)], nonces: ['n1', 'n2'] }, NOW + 1);
    expect(receipt.op).toBe('split');
    expect(receipt.inputIds).toContain(vtxo.vtxoId);
    expect(receipt.outputIds).toHaveLength(2);
  });
});

describe('splitVtxo — invalid cases', () => {
  it('throws VtxoAmountError when sum does not match', () => {
    const { vtxo } = setup();
    expect(() => splitVtxo(vtxo, { amounts: [BigInt(400), BigInt(400)], nonces: ['n1', 'n2'] }, NOW + 1))
      .toThrow(VtxoAmountError);
  });

  it('throws VtxoAmountError for zero amount in split', () => {
    const { vtxo } = setup();
    expect(() => splitVtxo(vtxo, { amounts: [BigInt(0), BigInt(1000)], nonces: ['n1', 'n2'] }, NOW + 1))
      .toThrow(VtxoAmountError);
  });

  it('throws VtxoSplitError for only one output', () => {
    const { vtxo } = setup();
    expect(() => splitVtxo(vtxo, { amounts: [BigInt(1000)], nonces: ['n1'] }, NOW + 1))
      .toThrow(VtxoSplitError);
  });

  it('throws VtxoStatusError for inactive input', () => {
    const { vtxo } = setup();
    const { input } = splitVtxo(vtxo, { amounts: [BigInt(500), BigInt(500)], nonces: ['n1', 'n2'] }, NOW + 1);
    expect(() => splitVtxo(input, { amounts: [BigInt(250), BigInt(250)], nonces: ['n3', 'n4'] }, NOW + 2))
      .toThrow(VtxoStatusError);
  });

  it('throws VtxoSplitError when amounts and nonces lengths differ', () => {
    const { vtxo } = setup();
    expect(() => splitVtxo(vtxo, { amounts: [BigInt(500), BigInt(500)], nonces: ['n1'] }, NOW + 1))
      .toThrow(VtxoSplitError);
  });
});

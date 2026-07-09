import { createPool } from '../pool';
import { mintVtxo } from '../vtxo';
import { transferVtxo } from '../transfer';
import { VtxoStatusError, VtxoAmountError } from '../errors';

const NOW = 1000;

function setup() {
  const pool = createPool(
    { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n1' },
    NOW
  );
  const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(1000), nonce: 'mint-1' }, NOW);
  return { pool, vtxo };
}

describe('transferVtxo — full transfer', () => {
  it('transitions input to transferred, output to active', () => {
    const { vtxo } = setup();
    const { input, output } = transferVtxo(vtxo, { recipient: 'bob', amount: BigInt(1000), nonce: 'tx-1' }, NOW + 1);
    expect(input.status).toBe('transferred');
    expect(output.status).toBe('active');
  });

  it('output has correct owner, amount, tokenId, poolId', () => {
    const { vtxo } = setup();
    const { output } = transferVtxo(vtxo, { recipient: 'bob', amount: BigInt(1000), nonce: 'tx-1' }, NOW + 1);
    expect(output.owner).toBe('bob');
    expect(output.amount).toBe(BigInt(1000));
    expect(output.tokenId).toBe(vtxo.tokenId);
    expect(output.poolId).toBe(vtxo.poolId);
  });

  it('no change vtxo on full transfer', () => {
    const { vtxo } = setup();
    const result = transferVtxo(vtxo, { recipient: 'bob', amount: BigInt(1000), nonce: 'tx-1' }, NOW + 1);
    expect(result.change).toBeUndefined();
  });

  it('output has populated proof', () => {
    const { vtxo } = setup();
    const { output } = transferVtxo(vtxo, { recipient: 'bob', amount: BigInt(1000), nonce: 'tx-1' }, NOW + 1);
    expect(output.proof.leaf).toHaveLength(64);
  });
});

describe('transferVtxo — partial transfer', () => {
  it('transitions input to split, output and change to active', () => {
    const { vtxo } = setup();
    const { input, output, change } = transferVtxo(
      vtxo,
      { recipient: 'bob', amount: BigInt(300), nonce: 'tx-1', changeNonce: 'chg-1' },
      NOW + 1
    );
    expect(input.status).toBe('split');
    expect(output.status).toBe('active');
    expect(change?.status).toBe('active');
  });

  it('change has correct owner and amount', () => {
    const { vtxo } = setup();
    const { change } = transferVtxo(
      vtxo,
      { recipient: 'bob', amount: BigInt(300), nonce: 'tx-1', changeNonce: 'chg-1' },
      NOW + 1
    );
    expect(change?.owner).toBe('alice');
    expect(change?.amount).toBe(BigInt(700));
  });

  it('preserves tokenId and poolId on output and change', () => {
    const { vtxo } = setup();
    const { output, change } = transferVtxo(
      vtxo,
      { recipient: 'bob', amount: BigInt(300), nonce: 'tx-1', changeNonce: 'chg-1' },
      NOW + 1
    );
    expect(output.tokenId).toBe(vtxo.tokenId);
    expect(output.poolId).toBe(vtxo.poolId);
    expect(change?.tokenId).toBe(vtxo.tokenId);
    expect(change?.poolId).toBe(vtxo.poolId);
  });
});

describe('transferVtxo — invalid cases', () => {
  it('throws VtxoAmountError for zero amount', () => {
    const { vtxo } = setup();
    expect(() => transferVtxo(vtxo, { recipient: 'bob', amount: BigInt(0), nonce: 'tx-1' }, NOW + 1))
      .toThrow(VtxoAmountError);
  });

  it('throws VtxoAmountError when amount exceeds vtxo amount', () => {
    const { vtxo } = setup();
    expect(() => transferVtxo(vtxo, { recipient: 'bob', amount: BigInt(9999), nonce: 'tx-1' }, NOW + 1))
      .toThrow(VtxoAmountError);
  });

  it('throws VtxoStatusError for inactive vtxo', () => {
    const { vtxo } = setup();
    const { input } = transferVtxo(vtxo, { recipient: 'bob', amount: BigInt(1000), nonce: 'tx-1' }, NOW + 1);
    expect(() => transferVtxo(input, { recipient: 'charlie', amount: BigInt(100), nonce: 'tx-2' }, NOW + 2))
      .toThrow(VtxoStatusError);
  });
});

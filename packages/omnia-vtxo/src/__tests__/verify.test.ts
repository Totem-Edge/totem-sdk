import { createPool } from '../pool';
import { mintVtxo } from '../vtxo';
import { transferVtxo } from '../transfer';
import { verifyVtxo, verifyVtxoProof, verifyVtxoTransfer, verifyConservation } from '../verify';
import { OmniaVtxo } from '../types';

const NOW = 1000;

function setup() {
  const pool = createPool(
    { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n1' },
    NOW
  );
  const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(1000), nonce: 'mint-1' }, NOW);
  return { pool, vtxo };
}

describe('verifyVtxo', () => {
  it('returns valid for a well-formed vtxo', () => {
    const { vtxo } = setup();
    const result = verifyVtxo(vtxo);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns invalid for zero amount', () => {
    const { vtxo } = setup();
    const bad: OmniaVtxo = { ...vtxo, amount: BigInt(0) };
    const result = verifyVtxo(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Amount'))).toBe(true);
  });

  it('returns invalid for missing owner', () => {
    const { vtxo } = setup();
    const bad: OmniaVtxo = { ...vtxo, owner: '' };
    const result = verifyVtxo(bad);
    expect(result.valid).toBe(false);
  });
});

describe('verifyVtxoProof', () => {
  it('verifies proof for minted vtxo', () => {
    const { vtxo } = setup();
    const result = verifyVtxoProof(vtxo, vtxo.proof);
    expect(result.valid).toBe(true);
  });

  it('fails for tampered leaf', () => {
    const { vtxo } = setup();
    const badProof = { ...vtxo.proof, leaf: '0'.repeat(64) };
    const result = verifyVtxoProof(vtxo, badProof);
    expect(result.valid).toBe(false);
  });
});

describe('verifyVtxoTransfer', () => {
  it('verifies a valid transfer', () => {
    const { vtxo } = setup();
    const { output, transfer } = transferVtxo(vtxo, { recipient: 'bob', amount: BigInt(1000), nonce: 'tx-1' }, NOW + 1);
    const result = verifyVtxoTransfer(vtxo, output, transfer);
    expect(result.valid).toBe(true);
  });

  it('fails when transfer amount exceeds input', () => {
    const { vtxo } = setup();
    const { output, transfer } = transferVtxo(vtxo, { recipient: 'bob', amount: BigInt(1000), nonce: 'tx-1' }, NOW + 1);
    const badTransfer = { ...transfer, amount: BigInt(99999) };
    const result = verifyVtxoTransfer(vtxo, output, badTransfer);
    expect(result.valid).toBe(false);
  });
});

describe('verifyConservation — lte mode (default)', () => {
  it('passes when output sum equals input sum', () => {
    const pool = createPool(
      { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'ns-1' },
      NOW
    );
    const { vtxo: v1 } = mintVtxo(pool, { owner: 'alice', amount: BigInt(1000), nonce: 'ma' }, NOW);
    const { vtxo: v2 } = mintVtxo(pool, { owner: 'bob', amount: BigInt(1000), nonce: 'mb' }, NOW);
    const result = verifyConservation({ inputs: [v1], outputs: [v2] });
    expect(result.valid).toBe(true);
  });

  it('passes when output sum is less than input sum (exit/fee flow)', () => {
    const pool = createPool(
      { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'ns-2' },
      NOW
    );
    const { vtxo: v1 } = mintVtxo(pool, { owner: 'alice', amount: BigInt(1000), nonce: 'ma' }, NOW);
    const { vtxo: v2 } = mintVtxo(pool, { owner: 'bob', amount: BigInt(900), nonce: 'mb' }, NOW);
    const result = verifyConservation({ inputs: [v1], outputs: [v2] });
    expect(result.valid).toBe(true);
  });

  it('fails when output sum exceeds input sum', () => {
    const pool = createPool(
      { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'ns-3' },
      NOW
    );
    const { vtxo: v1 } = mintVtxo(pool, { owner: 'alice', amount: BigInt(1000), nonce: 'ma' }, NOW);
    const { vtxo: v2 } = mintVtxo(pool, { owner: 'bob', amount: BigInt(1001), nonce: 'mb' }, NOW);
    const result = verifyConservation({ inputs: [v1], outputs: [v2] });
    expect(result.valid).toBe(false);
  });
});

describe('verifyConservation — strict mode', () => {
  it('passes when output sum equals input sum', () => {
    const pool = createPool(
      { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'ss-1' },
      NOW
    );
    const { vtxo: v1 } = mintVtxo(pool, { owner: 'alice', amount: BigInt(1000), nonce: 'ma' }, NOW);
    const { vtxo: v2 } = mintVtxo(pool, { owner: 'bob', amount: BigInt(1000), nonce: 'mb' }, NOW);
    const result = verifyConservation({ inputs: [v1], outputs: [v2], mode: 'strict' });
    expect(result.valid).toBe(true);
  });

  it('fails when output sum is less than input sum (strict rejects non-equality)', () => {
    const pool = createPool(
      { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'ss-2' },
      NOW
    );
    const { vtxo: v1 } = mintVtxo(pool, { owner: 'alice', amount: BigInt(1000), nonce: 'ma' }, NOW);
    const { vtxo: v2 } = mintVtxo(pool, { owner: 'bob', amount: BigInt(900), nonce: 'mb' }, NOW);
    const result = verifyConservation({ inputs: [v1], outputs: [v2], mode: 'strict' });
    expect(result.valid).toBe(false);
  });

  it('fails when output sum exceeds input sum', () => {
    const pool = createPool(
      { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'ss-3' },
      NOW
    );
    const { vtxo: v1 } = mintVtxo(pool, { owner: 'alice', amount: BigInt(1000), nonce: 'ma' }, NOW);
    const { vtxo: v2 } = mintVtxo(pool, { owner: 'bob', amount: BigInt(1001), nonce: 'mb' }, NOW);
    const result = verifyConservation({ inputs: [v1], outputs: [v2], mode: 'strict' });
    expect(result.valid).toBe(false);
  });
});

describe('verifyConservation — cross-pool rejection', () => {
  it('fails for cross-pool conservation check', () => {
    const pool1 = createPool({ operator: 'op', tokenId: 't', totalCapacity: BigInt(1000), nonce: 'np1' }, NOW);
    const pool2 = createPool({ operator: 'op', tokenId: 't', totalCapacity: BigInt(1000), nonce: 'np2' }, NOW);
    const { vtxo: v1 } = mintVtxo(pool1, { owner: 'alice', amount: BigInt(500), nonce: 'ma' }, NOW);
    const { vtxo: v2 } = mintVtxo(pool2, { owner: 'alice', amount: BigInt(500), nonce: 'mb' }, NOW);
    const result = verifyConservation({ inputs: [v1], outputs: [v2] });
    expect(result.valid).toBe(false);
  });
});

import { createPool } from '../pool';
import { mintVtxo } from '../vtxo';
import { transferVtxo } from '../transfer';
import { verifyVtxo, verifyVtxoProof, verifyVtxoTransfer, verifyConservation } from '../verify';
import { computeVtxoLeaf } from '../commitment';
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
    const result = verifyVtxo(vtxo, { expectedRoot: vtxo.proof.root });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns invalid for zero amount', () => {
    const { vtxo } = setup();
    const bad: OmniaVtxo = { ...vtxo, amount: BigInt(0) };
    const result = verifyVtxo(bad, { expectedRoot: bad.proof.root });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Amount'))).toBe(true);
  });

  it('treats expiresAt as untrusted metadata (not bound to the leaf or proof)', () => {
    const { vtxo } = setup();
    const withExpiry: OmniaVtxo = { ...vtxo, expiresAt: 1 };
    expect(computeVtxoLeaf(withExpiry)).toBe(computeVtxoLeaf(vtxo));
    expect(verifyVtxo(withExpiry, { expectedRoot: withExpiry.proof.root }).valid).toBe(true);
  });

  it('returns invalid for missing owner', () => {
    const { vtxo } = setup();
    const bad: OmniaVtxo = { ...vtxo, owner: '' };
    const result = verifyVtxo(bad, { expectedRoot: bad.proof.root });
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

describe('OMN-118: conservation rejects duplicate and negative records', () => {
  const build = (noncePrefix: string) => {
    const pool = createPool(
      { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: `${noncePrefix}-pool` },
      NOW,
    );
    const { vtxo: a } = mintVtxo(pool, { owner: 'alice', amount: 1000n, nonce: `${noncePrefix}-a` }, NOW);
    const { vtxo: b } = mintVtxo(pool, { owner: 'bob', amount: 1000n, nonce: `${noncePrefix}-b` }, NOW);
    return { a, b };
  };

  it('rejects a duplicated input that would inflate the budget', () => {
    const { a, b } = build('dup-in');
    const result = verifyConservation({ inputs: [a, a], outputs: [b, { ...b, amount: 2000n, vtxoId: 'out-2' }] });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Duplicate input/);
  });

  it('rejects a duplicated output', () => {
    const { a, b } = build('dup-out');
    const result = verifyConservation({ inputs: [a], outputs: [b, b] });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Duplicate output/);
  });

  it('rejects individually negative amounts', () => {
    const { a, b } = build('neg');
    const result = verifyConservation({ inputs: [{ ...a, amount: -1000n }], outputs: [b] });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/negative amount/);
  });

  it('rejects an id on both sides and an empty id', () => {
    const { a, b } = build('sides');
    expect(verifyConservation({ inputs: [a], outputs: [a] }).valid).toBe(false);
    expect(verifyConservation({ inputs: [{ ...a, vtxoId: '' }], outputs: [b] }).valid).toBe(false);
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


describe('verifyVtxoTransfer value/recipient binding (OMN-029)', () => {
  const base = (over: Record<string, unknown> = {}) => ({
    vtxoId: 'v1',
    poolId: 'p1',
    owner: 'alice',
    amount: 100n,
    tokenId: '0x00',
    epoch: 1,
    status: 'active',
    proof: { leaf: '0x00', root: '0x00', siblings: [], positions: [], epoch: 1 },
    ...over,
  } as never);

  it('rejects a non-positive transfer amount', async () => {
    const { verifyVtxoTransfer } = await import('../verify');
    const result = verifyVtxoTransfer(
      base(),
      base({ vtxoId: 'v2', owner: 'bob', amount: 0n }),
      { inputId: 'v1', outputId: 'v2', from: 'alice', to: 'bob', amount: 0n, poolId: 'p1', tokenId: '0x00', at: 1 },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/positive/);
  });

  it('rejects an output that does not match the transfer amount or recipient', async () => {
    const { verifyVtxoTransfer } = await import('../verify');
    const result = verifyVtxoTransfer(
      base(),
      base({ vtxoId: 'v2', owner: 'carol', amount: 40n }),
      { inputId: 'v1', outputId: 'v2', from: 'alice', to: 'bob', amount: 60n, poolId: 'p1', tokenId: '0x00', at: 1 },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/does not match output owner/);
    expect(result.errors.join(' ')).toMatch(/does not match output amount/);
  });

  it('requires change for a partial transfer and exact conservation', async () => {
    const { verifyVtxoTransfer } = await import('../verify');
    const partial = verifyVtxoTransfer(
      base(),
      base({ vtxoId: 'v2', owner: 'bob', amount: 60n }),
      { inputId: 'v1', outputId: 'v2', from: 'alice', to: 'bob', amount: 60n, poolId: 'p1', tokenId: '0x00', at: 1 },
    );
    expect(partial.valid).toBe(false);
    expect(partial.errors.join(' ')).toMatch(/change/);

    const mismatched = verifyVtxoTransfer(
      base(),
      base({ vtxoId: 'v2', owner: 'bob', amount: 60n }),
      { inputId: 'v1', outputId: 'v2', changeId: 'v3', from: 'alice', to: 'bob', amount: 60n, changeAmount: 30n, poolId: 'p1', tokenId: '0x00', at: 1 },
    );
    expect(mismatched.valid).toBe(false);
    expect(mismatched.errors.join(' ')).toMatch(/does not equal the input amount/);
  });
});

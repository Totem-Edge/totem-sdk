/**
 * OMN-007 — claim verification must require cryptographic proof material.
 *
 * A name list in `witness.signers` is a claim, not a signature. The
 * authoritative `verifyVtxoClaim` requires signatures over the canonical claim
 * preimage, verifies them, and evaluates the policy only against the verified
 * signer identities.
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import { createPool } from '../pool';
import { mintVtxo } from '../vtxo';
import {
  verifyVtxoClaim,
  verifyClaimPolicy,
  computeVtxoClaimPreimage,
  type VtxoClaimPolicy,
  type VtxoClaimWitness,
  type VtxoClaimContext,
  type VtxoClaimSignatureVerifier,
} from '../claim-policy';
import type { OmniaVtxo } from '../types';

const NOW = 1_000;
const SECRETS: Record<string, string> = {
  alice: 'alice-secret',
  bob: 'bob-secret',
  carol: 'carol-secret',
};

function sign(signer: string, preimage: Uint8Array): string {
  const secret = SECRETS[signer];
  if (!secret) throw new Error(`no key for ${signer}`);
  return bytesToHex(
    sha3_256(new TextEncoder().encode(`${secret}|${bytesToHex(preimage)}`)),
  );
}

const verifySignature: VtxoClaimSignatureVerifier = ({ signer, preimage, signature }) => {
  if (!SECRETS[signer]) return false;
  return Buffer.from(signature).toString('hex') === sign(signer, preimage).toLowerCase().replace(/^0x/, '');
};

function setup(policy?: VtxoClaimPolicy): OmniaVtxo {
  const pool = createPool(
    { operator: 'op-1', tokenId: '0x00', totalCapacity: 1_000_000n, nonce: 'n1' },
    NOW,
  );
  const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: 500n, nonce: 'mint-1' }, NOW);
  return policy ? { ...vtxo, claimPolicy: policy } : vtxo;
}

function signedWitness(
  vtxo: OmniaVtxo,
  signers: string[],
  ctx: VtxoClaimContext,
  extra: Partial<VtxoClaimWitness> = {},
): VtxoClaimWitness {
  const base: VtxoClaimWitness = { signers, ...extra };
  return {
    ...base,
    signatures: signers.map((signer) => ({
      signer,
      signature: sign(signer, computeVtxoClaimPreimage(vtxo, base, ctx, signer)),
    })),
  };
}

describe('OMN-007 — claim signatures are required', () => {
  it('rejects a bare signer name list (the reported reproduction)', async () => {
    const vtxo = setup();
    const context: VtxoClaimContext = { block: 1 };
    const result = await verifyVtxoClaim(
      vtxo,
      { signers: ['alice'] },
      context,
      { verifySignature },
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cryptographic signatures/);
  });

  it('rejects verification without a signature verifier', async () => {
    const vtxo = setup();
    const result = await verifyVtxoClaim(
      vtxo,
      { signers: ['alice'], signatures: [{ signer: 'alice', signature: 'aa' }] },
      { block: 1 },
      undefined as never,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/signature verifier/);
  });

  it('accepts a valid signed claim', async () => {
    const vtxo = setup();
    const context: VtxoClaimContext = { block: 1 };
    const result = await verifyVtxoClaim(
      vtxo,
      signedWitness(vtxo, ['alice'], context),
      context,
      { verifySignature },
    );
    expect(result.valid).toBe(true);
    expect(result.verifiedSigners).toEqual(['alice']);
  });

  it('rejects a signature attributed to the wrong signer', async () => {
    const vtxo = setup();
    const context: VtxoClaimContext = { block: 1 };
    const alicePreimage = computeVtxoClaimPreimage(vtxo, { signers: ['alice'] }, context, 'alice');
    const result = await verifyVtxoClaim(
      vtxo,
      {
        signers: ['alice'],
        signatures: [{ signer: 'alice', signature: sign('bob', alicePreimage) }],
      },
      context,
      { verifySignature },
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/invalid claim signature for alice/);
  });

  it('rejects names that have no signature behind them', async () => {
    const policy: VtxoClaimPolicy = {
      type: 'threshold', threshold: 2, owners: ['alice', 'bob', 'carol'],
    };
    const vtxo = setup(policy);
    const context: VtxoClaimContext = { block: 1 };
    const witness = signedWitness(vtxo, ['alice'], context);
    witness.signers = ['alice', 'bob'];

    const result = await verifyVtxoClaim(vtxo, witness, context, { verifySignature });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unverified signers: bob/);
  });

  it('requires every threshold signature (2-of-3)', async () => {
    const policy: VtxoClaimPolicy = {
      type: 'threshold', threshold: 2, owners: ['alice', 'bob', 'carol'],
    };
    const vtxo = setup(policy);
    const context: VtxoClaimContext = { block: 1 };

    const one = await verifyVtxoClaim(
      vtxo,
      signedWitness(vtxo, ['alice'], context),
      context,
      { verifySignature },
    );
    expect(one.valid).toBe(false);

    const two = await verifyVtxoClaim(
      vtxo,
      signedWitness(vtxo, ['alice', 'bob'], context),
      context,
      { verifySignature },
    );
    expect(two.valid).toBe(true);
    expect(two.verifiedSigners).toEqual(['alice', 'bob']);
  });

  it('binds the signature to the VTXO, block and claim context', async () => {
    const first = setup();
    const secondPool = createPool(
      { operator: 'op-1', tokenId: '0x00', totalCapacity: 1_000_000n, nonce: 'n2' },
      NOW,
    );
    const { vtxo: second } = mintVtxo(
      secondPool,
      { owner: 'alice', amount: 500n, nonce: 'mint-2' },
      NOW,
    );

    const context: VtxoClaimContext = { block: 10 };
    const witness = signedWitness(first, ['alice'], context);
    // Replay the first VTXO's signature against a different VTXO.
    const replay = await verifyVtxoClaim(second, witness, context, { verifySignature });
    expect(replay.valid).toBe(false);

    // Replay against a different block.
    const otherBlock = await verifyVtxoClaim(
      first,
      witness,
      { block: 11 },
      { verifySignature },
    );
    expect(otherBlock.valid).toBe(false);
  });

  it('rejects a caller-supplied block ahead of the chain tip', async () => {
    const vtxo = setup();
    const context: VtxoClaimContext = { block: 1_000 };
    const witness = signedWitness(vtxo, ['alice'], context);

    const result = await verifyVtxoClaim(vtxo, witness, context, {
      verifySignature,
      chainTip: 999,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/ahead of the chain tip/);

    const atTip = await verifyVtxoClaim(vtxo, witness, context, {
      verifySignature,
      chainTip: 1_000,
    });
    expect(atTip.valid).toBe(true);
  });

  it('keeps the pure policy evaluator usable offline', () => {
    expect(
      verifyClaimPolicy({ type: 'single', owner: 'alice' }, { signers: ['alice'] }, { block: 1 }).valid,
    ).toBe(true);
  });

  it('uses the VTXO amount as the vesting allocation on the authoritative path', async () => {
    const policy: VtxoClaimPolicy = {
      type: 'vesting',
      owner: 'employer',
      beneficiary: 'alice',
      startBlock: 0,
      cliffBlock: 0,
      endBlock: 100,
      // no totalAmount on purpose
    };
    const vtxo = setup(policy);
    const context: VtxoClaimContext = { block: 100 };

    const overClaim = await verifyVtxoClaim(
      vtxo,
      signedWitness(vtxo, ['alice'], context, { claimAmount: 501n }),
      context,
      { verifySignature },
    );
    expect(overClaim.valid).toBe(false);

    const fullClaim = await verifyVtxoClaim(
      vtxo,
      signedWitness(vtxo, ['alice'], context, { claimAmount: 500n }),
      context,
      { verifySignature },
    );
    expect(fullClaim.valid).toBe(true);
    expect(fullClaim.schedule?.totalAmount).toBe(500n);
  });
});

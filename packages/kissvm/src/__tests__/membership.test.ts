/**
 * MMR membership covenant — structure and validation (RFC-048 §12.4).
 *
 * kissvm jest maps `@totemsdk/core` to a mock without `MMRTree`/`serializeMMRProof`,
 * so the real inclusion proof is exercised in `scripts/exercise-exec-vm.mjs`
 * (TS + Rust/WASM). Here we assert the emitted script and input validation.
 */

import { buildMmrMembershipCovenant } from '../templates/membership';

describe('buildMmrMembershipCovenant', () => {
  const covenant = buildMmrMembershipCovenant({ rootPort: 111, leafPort: 112, proofPort: 113 });

  it('verifies the leaf against the committed root via PROOF', () => {
    expect(covenant).toContain('LET ROOT = PREVSTATE(111)');
    expect(covenant).toContain('ASSERT SAMESTATE(111 111)');
    expect(covenant).toContain('LET LEAF = STATE(112)');
    expect(covenant).toContain('LET MMRPROOF = STATE(113)');
    expect(covenant).toContain('ASSERT PROOF(LEAF 0 ROOT 0 MMRPROOF)');
  });

  it('binds the signer to the leaf and pays it', () => {
    expect(covenant).toContain('IF SIGNEDBY(LEAF) THEN');
    expect(covenant).toContain('ASSERT VERIFYOUT(0 LEAF @AMOUNT 0x00 FALSE)');
  });

  it('can omit the signature and/or the payout', () => {
    const noSig = buildMmrMembershipCovenant({ rootPort: 111, leafPort: 112, proofPort: 113, requireSignature: false });
    expect(noSig).not.toContain('SIGNEDBY');
    const noPay = buildMmrMembershipCovenant({ rootPort: 111, leafPort: 112, proofPort: 113, pay: false });
    expect(noPay).not.toContain('VERIFYOUT');
  });


  it('reads runtime leaf/root sums from state ports (committed balances)', () => {
    const c = buildMmrMembershipCovenant({ rootPort: 111, leafPort: 112, proofPort: 113, leafSumPort: 114, rootSumPort: 115 });
    expect(c).toContain('ASSERT PROOF(LEAF STATE(114) ROOT STATE(115) MMRPROOF)');
  });

  it('rejects an out-of-range port', () => {
    expect(() => buildMmrMembershipCovenant({ rootPort: 300, leafPort: 112, proofPort: 113 })).toThrow();
  });
});

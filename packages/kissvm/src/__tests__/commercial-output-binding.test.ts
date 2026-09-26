import { escrowLayer } from '../templates/commercial.js';

/**
 * RFC-016 P4 residual — commercial review.
 *
 * The audited commercial paths already bind outputs to a named recipient, so no
 * code change was required; this locks that in as a regression guard.
 */
describe('RFC-016 P4 residual: commercial output binding', () => {
  const escrowPk = 'aa'.repeat(32);
  const beneficiary = 'bb'.repeat(32);

  it('escrow authorizes the escrow agent and binds the payout to the beneficiary', () => {
    const script = escrowLayer(escrowPk, {
      escrowId: 'e-1',
      workOrderId: 'wo-1',
      requiredEvidence: ['photo', 'signature'],
      paymentAmount: '100',
      beneficiaryPkd: beneficiary,
    }).script;

    expect(script).toContain(`LET escrow = 0x${escrowPk}`);
    expect(script).toContain('ASSERT SIGNEDBY(escrow)');
    expect(script).toContain(`ASSERT VERIFYOUT(@INPUT 0x${beneficiary} 100 @TOKENID TRUE)`);
    expect(script).not.toContain('VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)');
    // each evidence item gets its own state port (no contradictory single port)
    expect(script).toContain('ASSERT STATE(30) EQ [photo]');
    expect(script).toContain('ASSERT STATE(31) EQ [signature]');
  });
});

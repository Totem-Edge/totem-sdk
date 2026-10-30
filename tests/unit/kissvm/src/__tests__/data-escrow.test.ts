/**
 * RFC-020 P1-8: data escrow — release conditions are mandatory and the release
 * is bound to the beneficiary output.
 */
import { buildDataEscrowScript } from '../templates/data-privacy';

const base = {
  escrowId: 'e1',
  beneficiaryPkd: 'bb'.repeat(32),
  arbiterPkd: 'cc'.repeat(32),
  dataHash: 'dd'.repeat(32),
  escrowPort: 1,
  releasePort: 2,
};
const depositor = 'aa'.repeat(32);

describe('RFC-020 P1-8: data escrow', () => {
  it('throws when a release-condition parameter is omitted', () => {
    expect(() => buildDataEscrowScript(depositor, { ...base, releaseCondition: 'time-lock' } as never)).toThrow(/releaseBlock/);
    expect(() => buildDataEscrowScript(depositor, { ...base, releaseCondition: 'oracle' } as never)).toThrow(/oraclePort/);
    expect(() => buildDataEscrowScript(depositor, { ...base, releaseCondition: 'event' } as never)).toThrow(/oraclePort/);
    expect(() => buildDataEscrowScript(depositor, { ...base, releaseCondition: 'multi-sig' } as never)).toThrow(/custodian/);
  });

  it('binds the release to the beneficiary output', () => {
    const layer = buildDataEscrowScript(depositor, { ...base, releaseCondition: 'time-lock', releaseBlock: 100 });
    expect(layer.script).toContain('VERIFYOUT(@INPUT beneficiary @AMOUNT @TOKENID TRUE)');
    expect(layer.script).toContain('ASSERT @BLOCK GTE 100');
  });
});

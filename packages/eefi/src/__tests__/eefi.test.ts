import {
  EefiValidationError,
  eefiCapitalTermsHash,
  eefiExerciseCovenantHash,
  eefiMarketQuoteDigest,
  eefiRiskPolicyId,
  validateCapitalAgreement,
  validateEefiContract,
  validateExerciseCovenant,
  validateMarketAgreement,
  validateRiskPolicyRef,
} from '../index.js';
import type {
  EefiCapitalAgreement,
  EefiExerciseCovenant,
  EefiMarketAgreement,
  EefiRiskPolicyRef,
} from '../index.js';

const h = (byte: string): string => '0x' + byte.repeat(32);

function capital(): EefiCapitalAgreement {
  const agreement: EefiCapitalAgreement = {
    version: 'eefi-capital/v1',
    termsHash: h('00'),
    funding: {
      mashPolicyRoot: h('11'),
      allowedProgramHash: h('22'),
      assetId: '0x00',
      maxAmountAtoms: '1000',
    },
    operation: {
      channelProgramId: 'eltoo-payment',
      maturityBlock: '100',
      stateRulesHash: h('33'),
    },
    settlement: {
      payoutPolicyHash: h('44'),
      recoveryPolicyHash: h('55'),
    },
  };
  agreement.termsHash = eefiCapitalTermsHash(agreement);
  return agreement;
}

function market(): EefiMarketAgreement {
  const agreement: EefiMarketAgreement = {
    version: 'eefi-market/v1',
    quoteId: h('00'),
    nonce: 'nonce-1',
    side: 'buy',
    baseAssetId: h('aa'),
    quoteAssetId: '0x00',
    baseScale: 0,
    quoteScale: 0,
    exactIn: '100',
    priceAtoms: '2',
    feesBps: 25,
    venue: 'reserve:1',
    deadlineBlock: '500',
    makerId: 'maker',
    takerId: 'taker',
    domain: 'minima:test',
    signatureRef: h('bb'),
  };
  agreement.quoteId = eefiMarketQuoteDigest(agreement);
  return agreement;
}

function risk(): EefiRiskPolicyRef {
  const policy: EefiRiskPolicyRef = {
    version: 'eefi-risk/v1',
    policyId: h('00'),
    maxExposureAtoms: '10000',
    collateralRatioBps: 1500,
    haircutBps: 500,
    liquidationConditionId: 'block:500',
    oraclePolicyIds: ['oracle:1'],
  };
  policy.policyId = eefiRiskPolicyId(policy);
  return policy;
}

function exercise(): EefiExerciseCovenant {
  return {
    version: 'eefi-exercise/v1',
    kind: 'unilateral-exercise',
    conditionId: 'block:500',
    beneficiaryPolicyHash: h('66'),
    recoveryPolicyHash: h('77'),
    timelockBlocks: 10,
  };
}

describe('@totemsdk/eefi — digests', () => {
  it('produces 0x-prefixed 32-byte hashes', () => {
    expect(eefiCapitalTermsHash(capital())).toMatch(/^0x[0-9a-f]{64}$/);
    expect(eefiMarketQuoteDigest(market())).toMatch(/^0x[0-9a-f]{64}$/);
    expect(eefiRiskPolicyId(risk())).toMatch(/^0x[0-9a-f]{64}$/);
    expect(eefiExerciseCovenantHash(exercise())).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('canonicalises key order', () => {
    const a = {
      funding: {
        mashPolicyRoot: h('11'),
        allowedProgramHash: h('22'),
        assetId: '0x00',
        maxAmountAtoms: '1000',
      },
      operation: {
        channelProgramId: 'eltoo-payment',
        maturityBlock: '100',
        stateRulesHash: h('33'),
      },
      settlement: {
        payoutPolicyHash: h('44'),
        recoveryPolicyHash: h('55'),
      },
    };
    const b = {
      settlement: {
        recoveryPolicyHash: h('55'),
        payoutPolicyHash: h('44'),
      },
      operation: {
        stateRulesHash: h('33'),
        maturityBlock: '100',
        channelProgramId: 'eltoo-payment',
      },
      funding: {
        maxAmountAtoms: '1000',
        assetId: '0x00',
        allowedProgramHash: h('22'),
        mashPolicyRoot: h('11'),
      },
    };
    expect(eefiCapitalTermsHash(a)).toBe(eefiCapitalTermsHash(b));
  });

  it('separates domains', () => {
    expect(eefiCapitalTermsHash(capital())).not.toBe(
      eefiExerciseCovenantHash(exercise()),
    );
  });

  it('excludes quoteId and signatureRef from the quote identity', () => {
    const quote = market();
    expect(
      eefiMarketQuoteDigest({ ...quote, quoteId: h('ff'), signatureRef: h('ee') }),
    ).toBe(quote.quoteId);
  });

  it('treats omitted and undefined optional fields identically', () => {
    const quote = market();
    expect(eefiMarketQuoteDigest({ ...quote, exactOut: undefined })).toBe(
      quote.quoteId,
    );
  });

  it('excludes policyId from the risk-policy identity', () => {
    const policy = risk();
    expect(eefiRiskPolicyId({ ...policy, policyId: h('ff') })).toBe(
      policy.policyId,
    );
  });
});

describe('@totemsdk/eefi — validation', () => {
  it('accepts valid contracts', () => {
    expect(() => validateCapitalAgreement(capital())).not.toThrow();
    expect(() => validateMarketAgreement(market())).not.toThrow();
    expect(() => validateRiskPolicyRef(risk())).not.toThrow();
    expect(() => validateExerciseCovenant(exercise())).not.toThrow();
  });

  it('rejects a tampered capital terms hash', () => {
    const agreement = capital();
    agreement.funding.maxAmountAtoms = '1001';
    expect(() => validateCapitalAgreement(agreement)).toThrow(
      /termsHash does not match/,
    );
  });

  it('rejects a tampered quote id', () => {
    expect(() =>
      validateMarketAgreement({ ...market(), quoteId: h('ff') }),
    ).toThrow(/quoteId does not match/);
  });

  it('rejects a tampered risk policy id', () => {
    expect(() =>
      validateRiskPolicyRef({ ...risk(), policyId: h('ff') }),
    ).toThrow(/policyId does not match/);
  });

  it('requires exactly one of exactIn / exactOut', () => {
    expect(() =>
      validateMarketAgreement({ ...market(), exactOut: '100' }),
    ).toThrow(/exactly one of exactIn or exactOut/);
  });

  it('rejects atom floats and out-of-range basis points', () => {
    expect(() =>
      validateCapitalAgreement({
        ...capital(),
        funding: { ...capital().funding, maxAmountAtoms: '1.5' },
      }),
    ).toThrow(/maxAmountAtoms/);
    expect(() =>
      validateMarketAgreement({ ...market(), feesBps: 10_001 }),
    ).toThrow(/feesBps/);
  });

  it('rejects odd-length hex and negative timelocks', () => {
    expect(() =>
      validateExerciseCovenant({
        ...exercise(),
        beneficiaryPolicyHash: '0x0',
      }),
    ).toThrow(/beneficiaryPolicyHash/);
    expect(() =>
      validateExerciseCovenant({ ...exercise(), timelockBlocks: -1 }),
    ).toThrow(/timelockBlocks/);
  });

  it('dispatches by version and rejects unknown versions', () => {
    const agreement = capital();
    const quote = market();
    const policy = risk();
    const covenant = exercise();
    expect(validateEefiContract(agreement)).toBe(agreement);
    expect(validateEefiContract(quote)).toBe(quote);
    expect(validateEefiContract(policy)).toBe(policy);
    expect(validateEefiContract(covenant)).toBe(covenant);
    expect(() => validateEefiContract({ version: 'eefi-nope/v1' })).toThrow(
      EefiValidationError,
    );
  });
});

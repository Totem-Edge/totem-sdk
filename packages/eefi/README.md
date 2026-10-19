# @totemsdk/eefi

Neutral Eefi generic contracts (RFC-050 §5): capital, market, risk and exercise
agreement schemas with canonical, domain-separated digests and fail-closed
validation.

This package is deliberately **data + digests only**. It performs no money
movement, no script construction and no policy evaluation.

## Boundary

| Concern | Home |
|---|---|
| Eefi contract schemas, digests, validation | `@totemsdk/eefi` (this package) |
| P-EXIT / collateral / oracle / membership covenant builders | `@totemsdk/kissvm` |
| Oracle policy / quorum runtime | `@totemsdk/proof` |
| Signed negotiation and quote canonicalisation | `@totemsdk/edge` |
| Channel funding, updates, settlement | `@totemsdk/omnia` |

Product-specific terms (option strikes, tranche waterfalls, credit schedules)
are a product-layer concern and are out of scope here.

## Contracts

- `EefiCapitalAgreement` — binds MASH authorisation to Omnia terms and
  settlement rights. `termsHash` commits `{ funding, operation, settlement }`.
- `EefiMarketAgreement` — a signed, finite, executable quote. `quoteId`
  commits the quote body excluding `quoteId` and `signatureRef`.
- `EefiRiskPolicyRef` — a declarative risk policy. `policyId` commits the body
  excluding `policyId`.
- `EefiExerciseCovenant` — the P-EXIT descriptor (condition + exact payout
  paths); the script is built by `@totemsdk/kissvm`.

## Digests

All digests reuse `@totemsdk/core`'s canonical JSON and SHA3-256:

- `eefiCapitalTermsHash(agreement)`
- `eefiMarketQuoteDigest(agreement)`
- `eefiRiskPolicyId(policy)`
- `eefiExerciseCovenantHash(covenant)`

Domains are versioned (`eefi:capital-terms:v1`, etc.) and results are
`0x`-prefixed 32-byte hashes.

## Validation

```ts
import {
  eefiCapitalTermsHash,
  validateEefiContract,
  type EefiCapitalAgreement,
} from '@totemsdk/eefi';

const agreement: EefiCapitalAgreement = {
  version: 'eefi-capital/v1',
  termsHash: '0x00',
  funding: {
    mashPolicyRoot: '0x' + '11'.repeat(32),
    allowedProgramHash: '0x' + '22'.repeat(32),
    assetId: '0x00',
    maxAmountAtoms: '1000',
  },
  operation: {
    channelProgramId: 'eltoo-payment',
    maturityBlock: '100',
    stateRulesHash: '0x' + '33'.repeat(32),
  },
  settlement: {
    payoutPolicyHash: '0x' + '44'.repeat(32),
    recoveryPolicyHash: '0x' + '55'.repeat(32),
  },
};

agreement.termsHash = eefiCapitalTermsHash(agreement);

validateEefiContract(agreement); // throws EefiValidationError if invalid
```

Validation checks structure, hex, atom strings, basis points, and that any
committed identifier matches its canonical digest.

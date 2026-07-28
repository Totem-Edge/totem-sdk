# KISSVM Templates

TotemSDK provides 33 template modules in `src/templates/`. Each module exports builder functions that generate KISSVM script strings for on-chain patterns.

The 24 canonical `.kiss` examples from the Minima repository are verified against the evaluator in `src/__tests__/canonical-verify.ts`.

## Mapping: Templates → Canonical Examples

| Template module | Builders | Example Mapping |
|----------------|----------|-----------------|
| `identity` | `buildIdentityVerificationScript`, `buildDelegationProofScript`, `buildRotationScript`, `buildRevocationScript` | — |
| `compliance` | `buildCompliancePipeline`, `buildStandardCompliancePipeline`, `buildSupplyChainPipeline` | — |
| `sensor-proof` | `buildSensorProofScript`, `buildSensorFleetPolicy`, `buildSensorProofChain` | — |
| `firmware-update` | `buildFirmwareUpdateScript` | — |
| `payment-channel` | `buildPaymentChannelScript`, `buildChannelFactoryScript` | `24_commit_reveal_round` |
| `state-machine` | `buildStateMachineScript`, `buildStateMachineWorkflow`, + 4 presets | `07_counter_state_machine` |
| `layers` | 8 layer constants | — |
| `recovery` | `buildThresholdRecoveryScript`, `buildEpochRotationScript`, `buildDelegatedCredentialScript`, `buildInstitutionalHierarchy`, `buildSuccessionScript` | — |
| `commercial` | 10 layer constants | — |
| `data-privacy` | `buildDataAccessConsentScript`, `buildGdprSubjectRequestScript`, `buildDataPortabilityScript`, `buildZkProofIntegrationScript`, `buildDataEscrowScript` | — |
| `device-lifecycle` | 8 layer constants | — |
| `energy` | `buildRecTradingScript`, `buildMicrogridScript`, `buildP2PEnergyScript`, `buildDemandResponseScript`, `buildNetMeteringScript` | — |
| `healthcare` | `buildMedicalDeviceRegulationScript`, `buildPatientConsentScript`, `buildClinicalTrialScript`, `buildPrescriptionScript`, `buildHealthDataAccessScript` | — |
| `legal` | `buildDocumentNotarizationScript`, `buildTimestampVerificationScript`, `buildSmartContractExecutionScript`, `buildPowerOfAttorneyScript`, `buildMultiJurisdictionScript` | — |
| `rwa-lifecycle` | 8 builders for asset tokenization, fractionalization, audit, etc. | — |
| `supply-chain` | 6 builders for provenance, cold-chain, customs, etc. | — |
| `treasury` | 6 builders for multi-sig, budgets, streaming, delegation | — |
| `voting` | 5 builders for weighted, liquid, quadratic voting | — |
| `authority` | `buildMandateEnforcementScript`, `buildActionAuthorizationScript`, `buildAuthorityRevocationScript`, `buildUsageTrackingScript` | — |
| `agent-policy` | `buildPaymentIntentScript`, `buildAgentProposalScript`, `buildPolicyEnforcementScript` | — |
| `lookup-protocol` | `buildLeaseMessageScript`, `buildCoinUpdateScript`, `buildTrustMessageScript` | — |
| `manifest` | `buildManifestBindingScript`, `buildCapabilityScript`, `buildManifestExpiryScript` | — |
| `temporal` | `buildLinearRelease`, `buildCliffRelease`, `buildDeadlineScript`, `buildWindowScript`, `buildRateLimitScript`, `buildDecayScript`, `buildTemporalScript`, `computeRelease` | `03_absolute_block_timelock`, `04_relative_coinage_timelock` |
| `proof` | `buildProofAnchorScript`, `buildCapabilityProofScript`, `buildRevocationProofScript`, `buildProofDelegationScript` | `20_mmr_membership` |
| `wots-lease` | `buildLeaseCertificateScript`, `buildWatermarkTrackingScript`, `buildLeaseStateMachineScript` | — |
| `liquidity-bond` | `buildLiquidityLockScript`, `buildFeeAccrualScript`, `buildWithdrawalScript`, `buildPositionStateMachineScript` | — |
| `provider-bond` | `buildBondLockupScript`, `buildHeartbeatScript`, `buildBondStateMachineScript`, `buildChallengeScript`, `buildBondReleaseScript` | — |
| `txpow` | `buildTxPoWValidationScript`, `buildMagicConstantsScript` | — |
| `statechain` | `buildStatechainScript`, `buildStatechainOwnerRotationScript` | — |
| `governance` | `buildProposalStateMachineScript`, `buildVoteSubmissionScript`, `buildVoteTallyScript`, `buildExecutionMandateScript`, `buildTreasuryExecutionScript`, `computeScriptHash` | — |
| `eltoo` | `buildEltooChannelScript`, `buildEltooFundingScript`, `buildEltooSettlementScript`, `buildFactoryFundingScript` | — |
| `industrial-action` | `buildCommitScript`, `buildRevealScript`, `buildActionStateMachineScript`, `buildEscrowEnforcementScript` | — |

## 24 canonical examples

Located at [`./examples/`](./examples/).

| # | File | Pattern | Our Evaluator |
|---|------|---------|---------------|
| 01 | `01_single_signature.kiss` | Basic owner authorization | ✅ `SIGNEDBY` |
| 02 | `02_multisig_2_of_3.kiss` | Threshold authorization | ✅ `MULTISIG` |
| 03 | `03_absolute_block_timelock.kiss` | Block-height release | ✅ `@BLOCK` |
| 04 | `04_relative_coinage_timelock.kiss` | Age-relative release | ✅ `@COINAGE` |
| 05 | `05_htlc_dual_path.kiss` | Preimage claim or refund | ✅ `SHA3`, `@COINAGE` |
| 06 | `06_three_party_escrow.kiss` | 2-of-3 escrow | ✅ `MULTISIG` |
| 07 | `07_counter_state_machine.kiss` | Nonce increment + self-recreate | ✅ `INC`, `SAMESTATE`, `VERIFYOUT` |
| 08 | `08_immutable_state_schema.kiss` | Preserve state range | ✅ `SAMESTATE` |
| 09 | `09_token_gate.kiss` | Token-gated access | ✅ `@TOKENID` |
| 10 | `10_exact_indexed_payout.kiss` | Single exact payout | ✅ `VERIFYOUT` |
| 11 | `11_two_output_split.kiss` | Two-recipient split | ✅ `VERIFYOUT` |
| 12 | `12_self_recreating_covenant.kiss` | Same address/value/token/state | ✅ `VERIFYOUT` |
| 13 | `13_bounded_withdrawal_vault.kiss` | Per-transition cap | ✅ `STATE`, `PREVSTATE`, `@INPUT` |
| 14 | `14_nonce_authorized_transition.kiss` | Replay-resistant nonce | ✅ `INC`, `SIGNEDBY`, `SAMESTATE` |
| 15 | `15_bitfield_permissions.kiss` | Compact permission flags | ✅ `BITGET` |
| 16 | `16_dynamic_function_safe_demo.kiss` | Typed local function | ✅ `FUNCTION`, positional `$N` |
| 17 | `17_exec_hash_authorized.kiss` | Hash-authorized dynamic exec | ✅ `EXEC`, `SHA3` |
| 18 | `18_mast_leaf_dispatch.kiss` | Witness-proven MAST branch | ✅ `MAST` |
| 19 | `19_explicit_checksig_oracle.kiss` | Arbitrary-message CHECKSIG | ✅ `CHECKSIG` |
| 20 | `20_mmr_membership.kiss` | MMR membership proof | ✅ `PROOF` |
| 21 | `21_array_allowlist.kiss` | Tuple array + bounded scan | ✅ `STORE_TUPLE`, `GET`, `INC` |
| 22 | `22_preserve_selected_state.kiss` | Immutable range + mutable nonce | ✅ `SAMESTATE`, `INC` |
| 23 | `23_emergency_escape_plus_covenant.kiss` | Rescue key + normal covenant | ✅ `SIGNEDBY`, `SAMESTATE` |
| 24 | `24_commit_reveal_round.kiss` | Two-round state transition | ✅ `INC`, `SAMESTATE`, `SHA3` |

Run verification:

```bash
cd packages/kissvm && npx tsx src/__tests__/canonical-verify.ts
```

## Template usage pattern

Every template exports a builder function that takes a typed config object and returns a KISSVM script string:

```ts
import { buildIdentityVerificationScript } from '@totemsdk/kissvm'
import type { IdentityVerificationConfig } from '@totemsdk/kissvm'

const config: IdentityVerificationConfig = {
  trustedIssuers: ['0xAA', '0xBB'],
  verificationMethod: 'multisig',
  threshold: 2,
  expiryBlock: 1000000,
}

const script = buildIdentityVerificationScript(config)
// → "ASSERT @BLOCK LT 1000000 RETURN MULTISIG(2 0xAA 0xBB)"
```

Some templates export layer constants (e.g. `maasLayer`, `manufacturerLayer`) for use with the layered-MAST infrastructure.

**@totemsdk/txpow**

***

# @totemsdk/txpow

## Interfaces

- [MachineWorkAction](interfaces/MachineWorkAction.md)
- [MachineWorkAdmissionProof](interfaces/MachineWorkAdmissionProof.md)
- [MineOptions](interfaces/MineOptions.md)
- [MineResult](interfaces/MineResult.md)
- [MineWorkAdmissionOptions](interfaces/MineWorkAdmissionOptions.md)
- [MinimaWorkRelay](interfaces/MinimaWorkRelay.md)
- [MinimaWorkTemplate](interfaces/MinimaWorkTemplate.md)
- [MinimaWorkTemplateProvider](interfaces/MinimaWorkTemplateProvider.md)
- [MiningEstimate](interfaces/MiningEstimate.md)
- [TxBodyOptions](interfaces/TxBodyOptions.md)
- [TxHeaderOptions](interfaces/TxHeaderOptions.md)
- [TxPowParams](interfaces/TxPowParams.md)
- [VerifyResult](interfaces/VerifyResult.md)
- [VerifyWorkAdmissionOptions](interfaces/VerifyWorkAdmissionOptions.md)
- [WorkAdmissionVerification](interfaces/WorkAdmissionVerification.md)
- [WorkChallenge](interfaces/WorkChallenge.md)

## Type Aliases

- [TxPoWOptions](type-aliases/TxPoWOptions.md)

## Variables

- [CASCADE\_LEVELS](variables/CASCADE_LEVELS.md)
- [DEFAULT\_CHALLENGE\_TTL\_MS](variables/DEFAULT_CHALLENGE_TTL_MS.md)
- [MACHINE\_WORK\_ADMISSION\_VERSION](variables/MACHINE_WORK_ADMISSION_VERSION.md)
- [MACHINE\_WORK\_DOMAIN](variables/MACHINE_WORK_DOMAIN.md)
- [MAIN\_NET\_CHAIN\_ID](variables/MAIN_NET_CHAIN_ID.md)
- [MAX\_CHALLENGE\_TTL\_MS](variables/MAX_CHALLENGE_TTL_MS.md)
- [MAX\_HASH](variables/MAX_HASH.md)
- [TX\_POW\_MIN\_DIFFICULTY](variables/TX_POW_MIN_DIFFICULTY.md)
- [ZERO\_HASH](variables/ZERO_HASH.md)

## Functions

- [assembleTxPoWEnvelope](functions/assembleTxPoWEnvelope.md)
- [buildBlockHeaderTail](functions/buildBlockHeaderTail.md)
- [buildEmptyBlockBody](functions/buildEmptyBlockBody.md)
- [buildEmptyBurnTxBytes](functions/buildEmptyBurnTxBytes.md)
- [buildEmptyBurnWitnessBytes](functions/buildEmptyBurnWitnessBytes.md)
- [buildEmptyTransactionBytes](functions/buildEmptyTransactionBytes.md)
- [buildEmptyWitnessBytes](functions/buildEmptyWitnessBytes.md)
- [buildHeaderTail](functions/buildHeaderTail.md)
- [calibrateHashRate](functions/calibrateHashRate.md)
- [canonicalAction](functions/canonicalAction.md)
- [canonicalChallenge](functions/canonicalChallenge.md)
- [challengeFingerprint](functions/challengeFingerprint.md)
- [computeActionCommitment](functions/computeActionCommitment.md)
- [computeBlockCandidateId](functions/computeBlockCandidateId.md)
- [computeSuperLevel](functions/computeSuperLevel.md)
- [computeTxPoWId](functions/computeTxPoWId.md)
- [createWorkChallenge](functions/createWorkChallenge.md)
- [estimateMiningCost](functions/estimateMiningCost.md)
- [fetchTxPowTarget](functions/fetchTxPowTarget.md)
- [getBrowserWasmUrl](functions/getBrowserWasmUrl.md)
- [isBlockWinner](functions/isBlockWinner.md)
- [isLessThan](functions/isLessThan.md)
- [isWasmAvailable](functions/isWasmAvailable.md)
- [mineHeaderTail](functions/mineHeaderTail.md)
- [mineTxPoW](functions/mineTxPoW.md)
- [mineTxPoWInProcess](functions/mineTxPoWInProcess.md)
- [mineWorkAdmission](functions/mineWorkAdmission.md)
- [reconstructTxPoWEnvelope](functions/reconstructTxPoWEnvelope.md)
- [serializeMagic](functions/serializeMagic.md)
- [serializeSuperParents](functions/serializeSuperParents.md)
- [serializeTxBody](functions/serializeTxBody.md)
- [serializeTxHeader](functions/serializeTxHeader.md)
- [serializeTxPoW](functions/serializeTxPoW.md)
- [setBrowserWorkerUrl](functions/setBrowserWorkerUrl.md)
- [setWasmUrl](functions/setWasmUrl.md)
- [templateFreshness](functions/templateFreshness.md)
- [validateWorkChallenge](functions/validateWorkChallenge.md)
- [verifyProofOfWork](functions/verifyProofOfWork.md)
- [verifyTxPoWParts](functions/verifyTxPoWParts.md)
- [verifyTxPoWWork](functions/verifyTxPoWWork.md)
- [verifyWorkAdmission](functions/verifyWorkAdmission.md)

**@totemsdk/tx-builder**

***

**Maturity: rc**

# @totemsdk/tx-builder

## Classes

- [CoinSelectionError](classes/CoinSelectionError.md)
- [CoinSelectionService](classes/CoinSelectionService.md)
- [MultisigManager](classes/MultisigManager.md)
- [MultisigStorageError](classes/MultisigStorageError.md)

## Interfaces

- [BuildPoolFundTxParams](interfaces/BuildPoolFundTxParams.md)
- [CoinFetcher](interfaces/CoinFetcher.md)
- [CoinSelectionOptions](interfaces/CoinSelectionOptions.md)
- [CoinSelectionResult](interfaces/CoinSelectionResult.md)
- [DeepFundingProof](interfaces/DeepFundingProof.md)
- [EnhancedBuildParams](interfaces/EnhancedBuildParams.md)
- [EnhancedCoinInput](interfaces/EnhancedCoinInput.md)
- [EnhancedCoinOutput](interfaces/EnhancedCoinOutput.md)
- [MultisigConfig](interfaces/MultisigConfig.md)
- [MultisigExportData](interfaces/MultisigExportData.md)
- [PendingMultisigTransaction](interfaces/PendingMultisigTransaction.md)
- [PoolFundBuildResult](interfaces/PoolFundBuildResult.md)
- [PoolFundTx](interfaces/PoolFundTx.md)
- [PoolFundVerification](interfaces/PoolFundVerification.md)
- [ScriptProofWitnessInput](interfaces/ScriptProofWitnessInput.md)
- [SignatureWitnessInput](interfaces/SignatureWitnessInput.md)
- [SpendableCoin](interfaces/SpendableCoin.md)
- [StorageAdapter](interfaces/StorageAdapter.md)
- [TokenProofWitnessInput](interfaces/TokenProofWitnessInput.md)
- [TransactionWitnessDescriptor](interfaces/TransactionWitnessDescriptor.md)

## Type Aliases

- [SendMode](type-aliases/SendMode.md)
- [StoragePort](type-aliases/StoragePort.md)

## Variables

- [POOL\_FUND\_DOMAIN](variables/POOL_FUND_DOMAIN.md)

## Functions

- [addDecimalStrings](functions/addDecimalStrings.md)
- [addDecimalStringsWasm](functions/addDecimalStringsWasm.md)
- [addressFromPkDigest](functions/addressFromPkDigest.md)
- [bigIntToDecimalString](functions/bigIntToDecimalString.md)
- [buildPoolFundTx](functions/buildPoolFundTx.md)
- [compareDecimal](functions/compareDecimal.md)
- [compareDecimalWasm](functions/compareDecimalWasm.md)
- [computeMultisigAddressWasm](functions/computeMultisigAddressWasm.md)
- [hashPoolFundTx](functions/hashPoolFundTx.md)
- [isPositive](functions/isPositive.md)
- [isPositiveWasm](functions/isPositiveWasm.md)
- [orderCoinsByAmountWasm](functions/orderCoinsByAmountWasm.md)
- [parseDecimalToBigInt](functions/parseDecimalToBigInt.md)
- [recomputeDigestWasm](functions/recomputeDigestWasm.md)
- [selectCoinsWasm](functions/selectCoinsWasm.md)
- [sha3\_256\_hexWasm](functions/sha3_256_hexWasm.md)
- [subtractDecimalStrings](functions/subtractDecimalStrings.md)
- [subtractDecimalStringsWasm](functions/subtractDecimalStringsWasm.md)
- [toProofHex](functions/toProofHex.md)
- [verifyPoolFundTx](functions/verifyPoolFundTx.md)

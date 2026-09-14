[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / verifyDeposit

# Function: verifyDeposit()

> **verifyDeposit**(`provider`, `params`): `Promise`\<[`DepositVerification`](../interfaces/DepositVerification.md)\>

Live deposit check against a chain provider. All gates must hold:
 1. the coin exists;
 2. it is unspent (confirmed on-chain, never a declared flag);
 3. it is owned by `ownerAddress` (Mx or 0x-root form);
 4. its tokenid matches (base MINIMA = '0x00' when none is requested);
 5. its amount covers `claimedAmount`;
 6. when `requireConfirmed` is set, the coin is chain-confirmed.

## Parameters

### provider

`Pick`\<[`ChainStateProvider`](../interfaces/ChainStateProvider.md), `"getCoin"`\>

### params

[`VerifyDepositParams`](../interfaces/VerifyDepositParams.md)

## Returns

`Promise`\<[`DepositVerification`](../interfaces/DepositVerification.md)\>

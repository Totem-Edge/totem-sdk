[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildTreasuryExecutionScript

# Function: buildTreasuryExecutionScript()

> **buildTreasuryExecutionScript**(`config`): `string`

Build a treasury execution script that enforces:
  1. Timelock (block > committed execution block)
  2. Mandate constraint verification (proposalId, actionIndex, actionType)
  3. Governance multisig threshold
  4. Exact output verification (recipient, amount, token)

Port layout:
  0 — executionTimelockBlock (must be < @BLOCK)
  1 — proposalId hash (commitment)
  2 — actionIndex
  3 — actionType hash
  4 — mandateNonce (for single-use replay protection)

## Parameters

### config

[`TreasuryExecutionConfig`](../interfaces/TreasuryExecutionConfig.md)

## Returns

`string`

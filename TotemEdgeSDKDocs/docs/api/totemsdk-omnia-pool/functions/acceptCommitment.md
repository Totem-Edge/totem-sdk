[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / acceptCommitment

# Function: acceptCommitment()

> **acceptCommitment**(`params`): `Promise`\<\{ `commitment`: `LiquidityCommitment`; `registry`: `LiquidityBondRegistryState`; \}\>

Accept an LP commitment and register it — only after on-chain verification
confirms the funding. Throws when the funding is missing, declared-only, or
fails the chain check (an attacker cannot fake an accepted commitment).

## Parameters

### params

`AcceptCommitmentParams`

## Returns

`Promise`\<\{ `commitment`: `LiquidityCommitment`; `registry`: `LiquidityBondRegistryState`; \}\>

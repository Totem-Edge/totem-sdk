[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildChallengeScript

# Function: buildChallengeScript()

> **buildChallengeScript**(`config`): `string`

Build a challenge/slash script that enforces:
  1. Only a challenger can file during the challenge window
  2. Challenger must post a dispute bond
  3. Governor adjudicates (uphold → slash bond, dismiss → return bond)
  4. Slashed funds are distributed (challenger reward + treasury)

Port layout:
  0 — challenge status (0=none, 1=filed, 2=upheld, 3=dismissed)
  1 — challenger pk hex
  2 — dispute bond amount
  3 — adjudication deadline block
  4 — challenger reward share (basis points)

## Parameters

### config

#### adjudicationBlocks

`bigint`

#### challengerRewardBps

`number`

#### disputeBondAmount

`string`

#### governancePk

`string`

#### treasuryPk

`string`

## Returns

`string`

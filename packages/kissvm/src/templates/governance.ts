import { sha3_256, bytesToHex } from '@totemsdk/core'

export function computeScriptHash(script: string): string {
  const bytes = new TextEncoder().encode(script)
  const hash = sha3_256(bytes)
  return bytesToHex(hash)
}

/*
 * Status port assignment (for all governance scripts):
 *   PORT 0 — Current status (0=draft, 1=active, 2=passed, 3=failed, 4=executed, 5=cancelled, 6=expired)
 *   PORT 1 — votingStartsAt (block number)
 *   PORT 2 — votingEndsAt (block number)
 *   PORT 3 — executionDelayBlocks
 *   PORT 4 — proposer public key (hex)
 *   PORT 5 — membershipSnapshotHash (committed hash as bytes)
 */

export const STATUS = {
  DRAFT: 0,
  ACTIVE: 1,
  PASSED: 2,
  FAILED: 3,
  EXECUTED: 4,
  CANCELLED: 5,
  EXPIRED: 6,
} as const

export interface ProposalConfig {
  governancePks: string[]
  /** Number of governance keys required to sign execution (passed→executed). */
  multisigThreshold: number
  /** Execution delay in blocks (applied after votingEndsAt). */
  executionDelayBlocks: bigint
  /** Port storing the proposer's public key (default 4). */
  proposerPort?: number
  /** Port storing the membership snapshot hash (default 5). */
  snapshotPort?: number
}

export interface VoteTallyConfig {
  quorumPct: number
  minVoteBlocks: bigint
  governancePk: string
  /** Ports for the voting window (must NOT overlap with yes/no/abstain/total ports). */
  votingStartPort?: number
  votingEndPort?: number
  /** Ports for yes/no/abstain/total vote counts (default 0-3). */
  yesPort?: number
  noPort?: number
  abstainPort?: number
  totalPort?: number
}

export interface TreasuryExecutionConfig {
  treasuryPk: string
  governancePks: string[]
  multisigThreshold: number
  recipientPk: string
  amount: string
  tokenId: string
}

export interface VoteSubmissionConfig {
  governancePk: string
  /** Voting window start block (baked in as constant). */
  votingStartBlock: bigint
  /** Voting window end block (baked in as constant). */
  votingEndBlock: bigint
  /** Port storing the per-voter nonce to prevent double voting. */
  noncePort: number
  /** Port storing the voter's attested membership weight. */
  weightPort: number
  /** Port storing the frozen membership snapshot hash. */
  snapshotPort: number
}

export interface ExecutionMandateConfig {
  governancePks: string[]
  multisigThreshold: number
  executionDelayBlocks: bigint
  /** Port storing the outcome proof ID (commitment). */
  outcomeProofPort: number
  /** Port storing the vote tally hash that anchors the outcome. */
  tallyHashPort: number
  /** Port storing the membership snapshot hash for the proposal. */
  snapshotPort: number
}

/**
 * Build a proposal state-machine script that enforces the full
 * 7-status lifecycle: draft → active → passed → failed → executed
 *                                       ↘ cancelled  (from any except executed)
 *                                       ↘ expired    (from active, after votingEndsAt)
 *
 * Port layout (STATE / PREVSTATE):
 *   0 — status
 *   1 — votingStartsAt (block)
 *   2 — votingEndsAt   (block)
 *   3 — executionDelay (blocks)
 *   4 — proposer pk hex
 */
export function buildProposalStateMachineScript(config: ProposalConfig): string {
  const multisigKeys = config.governancePks.map(pk => `0x${pk}`).join(', ')
  const proposerPort = config.proposerPort ?? 4

  return [
    `SWITCH PREVSTATE(0)`,
    ``,
    `  CASE ${STATUS.DRAFT}`,
    `    IF STATE(0) EQ ${STATUS.ACTIVE} THEN`,
    `      ASSERT @BLOCK GTE STATE(1)`,
    `    ELSEIF STATE(0) EQ ${STATUS.CANCELLED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePks[0]}) OR SIGNEDBY(STATE(${proposerPort}))`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${STATUS.ACTIVE}`,
    `    IF STATE(0) EQ ${STATUS.PASSED} THEN`,
    `      ASSERT @BLOCK GTE STATE(2)`,
    `      ASSERT SIGNEDBY(0x${config.governancePks[0]})`,
    `    ELSEIF STATE(0) EQ ${STATUS.FAILED} THEN`,
    `      ASSERT @BLOCK GTE STATE(2)`,
    `      ASSERT SIGNEDBY(0x${config.governancePks[0]})`,
    `    ELSEIF STATE(0) EQ ${STATUS.EXPIRED} THEN`,
    `      ASSERT @BLOCK GT STATE(2)`,
    `    ELSEIF STATE(0) EQ ${STATUS.CANCELLED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePks[0]}) OR SIGNEDBY(STATE(${proposerPort}))`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${STATUS.PASSED}`,
    `    IF STATE(0) EQ ${STATUS.EXECUTED} THEN`,
    `      ASSERT @BLOCK GT STATE(2) ADD STATE(3)`,
    `      ASSERT MULTISIG(${config.multisigThreshold}, ${multisigKeys})`,
    `    ELSEIF STATE(0) EQ ${STATUS.CANCELLED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePks[0]})`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${STATUS.FAILED}`,
    `    IF STATE(0) EQ ${STATUS.CANCELLED} THEN`,
    `      RETURN TRUE`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${STATUS.EXECUTED}`,
    `    RETURN FALSE`,
    ``,
    `  CASE ${STATUS.CANCELLED}`,
    `    RETURN FALSE`,
    ``,
    `  CASE ${STATUS.EXPIRED}`,
    `    RETURN FALSE`,
    ``,
    `  DEFAULT`,
    `    RETURN FALSE`,
    ``,
    `ENDSWITCH`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}

export function buildVoteTallyScript(config: VoteTallyConfig): string {
  const vStartPort = config.votingStartPort ?? 10
  const vEndPort = config.votingEndPort ?? 11
  const yesPort = config.yesPort ?? 0
  const noPort = config.noPort ?? 1
  const abstainPort = config.abstainPort ?? 2
  const totalPort = config.totalPort ?? 3

  return [
    `ASSERT @BLOCK GTE STATE(${vStartPort})`,
    `ASSERT @BLOCK LTE STATE(${vEndPort})`,
    ``,
    `LET prevYes = PREVSTATE(${yesPort})`,
    `LET prevNo = PREVSTATE(${noPort})`,
    `LET prevAbstain = PREVSTATE(${abstainPort})`,
    `LET prevTotal = PREVSTATE(${totalPort})`,
    ``,
    `LET currYes = STATE(${yesPort})`,
    `LET currNo = STATE(${noPort})`,
    `LET currAbstain = STATE(${abstainPort})`,
    `LET currTotal = STATE(${totalPort})`,
    ``,
    `LET yesDelta = currYes SUB prevYes`,
    `LET noDelta = currNo SUB prevNo`,
    `LET abstainDelta = currAbstain SUB prevAbstain`,
    `LET totalDelta = currTotal SUB prevTotal`,
    ``,
    `ASSERT yesDelta GTE 0`,
    `ASSERT noDelta GTE 0`,
    `ASSERT abstainDelta GTE 0`,
    ``,
    `ASSERT yesDelta ADD noDelta ADD abstainDelta EQ totalDelta`,
    ``,
    `ASSERT totalDelta GT 0`,
    ``,
    `ASSERT currTotal GTE ${config.quorumPct}`,
    `ASSERT SIGNEDBY(0x${config.governancePk})`,
    `RETURN TRUE`,
  ].join('\n')
}

/**
 * Build a vote-submission script that enforces:
 *   1. Voting window is open (block between votingStartsAt and votingEndsAt)
 *   2. Voter is in the membership snapshot (weight > 0)
 *   3. No double vote (nonce spent via INC)
 *   4. Vote weight matches attested membership weight
 *   5. Choice is valid (yes/no/abstain, mutually exclusive)
 *
 * Port layout (STATE / PREVSTATE):
 *   0 — voter pk (hex, committed on first vote submit)
 *   1 — nonce (incremented each vote to prevent replay)
 *   2 — attested membership weight
 *   3 — choice (0=yes, 1=no, 2=abstain)
 *   4 — vote weight submitted
 *   5 — membership snapshot hash anchor
 */
export function buildVoteSubmissionScript(config: VoteSubmissionConfig): string {
  return [
    `// Voting window (baked in at script generation)`,
    `ASSERT @BLOCK GTE ${config.votingStartBlock.toString()}`,
    `ASSERT @BLOCK LTE ${config.votingEndBlock.toString()}`,
    ``,
    `// Voter identity`,
    `LET voter = STATE(0)`,
    `ASSERT voter NEQ 0x00`,
    `ASSERT SIGNEDBY(voter)`,
    ``,
    `// Nonce: prevent double voting via INC`,
    `ASSERT STATE(${config.noncePort}) EQ INC(PREVSTATE(${config.noncePort}))`,
    ``,
    `// Membership weight must be positive`,
    `LET weight = STATE(${config.weightPort})`,
    `ASSERT weight GT 0`,
    ``,
    `// Choice must be valid (0=yes, 1=no, 2=abstain)`,
    `LET choice = STATE(3)`,
    `ASSERT choice GTE 0`,
    `ASSERT choice LTE 2`,
    ``,
    `// Submitted weight must match attested membership weight`,
    `LET voteWeight = STATE(4)`,
    `ASSERT voteWeight EQ weight`,
    ``,
    `// Membership snapshot hash anchor`,
    `LET snapshotHash = STATE(${config.snapshotPort})`,
    `ASSERT snapshotHash NEQ 0x00`,
    ``,
    `ASSERT SIGNEDBY(0x${config.governancePk})`,
    `RETURN TRUE`,
  ].join('\n')
}

/**
 * Build an execution-mandate script that enforces:
 *   1. Timelock: current block > votingEndsAt + executionDelay
 *   2. Outcome proof committed and verified on-chain
 *   3. Vote tally hash matches the committed outcome
 *   4. Membership snapshot hash matches the proposal
 *   5. Governance multisig threshold must authorize execution
 *   6. Single-use enforcement via INC nonce
 *
 * Port layout:
 *   0 — execution nonce (for single-use replay protection)
 *   1 — outcomeProofId (committed hash bytes)
 *   2 — voteTallyHash (committed hash bytes)
 *   3 — membershipSnapshotHash (committed hash bytes)
 *   4 — votingEndsAt (block, from proposal anchor)
 *   5 — executionDelay (blocks, from proposal anchor)
 */
export function buildExecutionMandateScript(config: ExecutionMandateConfig): string {
  const multisigKeys = config.governancePks.map(pk => `0x${pk}`).join(', ')

  return [
    `// Timelock`,
    `LET votingEndsAt = STATE(4)`,
    `LET executionDelay = STATE(5)`,
    `ASSERT @BLOCK GT votingEndsAt ADD executionDelay`,
    ``,
    `// Outcome proof must be committed`,
    `LET outcomeProof = STATE(${config.outcomeProofPort})`,
    `ASSERT outcomeProof NEQ 0x00`,
    ``,
    `// Vote tally hash must match`,
    `LET tallyHash = STATE(${config.tallyHashPort})`,
    `ASSERT tallyHash NEQ 0x00`,
    ``,
    `// Membership snapshot hash must match`,
    `LET snapshotHash = STATE(${config.snapshotPort})`,
    `ASSERT snapshotHash NEQ 0x00`,
    ``,
    `// Replay protection via INC`,
    `LET nonce = STATE(0)`,
    `ASSERT nonce GT PREVSTATE(0)`,
    ``,
    `// Governance authorization`,
    `ASSERT MULTISIG(${config.multisigThreshold}, ${multisigKeys})`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}

/**
 * Build a treasury execution script that enforces:
 *   1. Timelock (block > committed execution block)
 *   2. Mandate constraint verification (proposalId, actionIndex, actionType)
 *   3. Governance multisig threshold
 *   4. Exact output verification (recipient, amount, token)
 *
 * Port layout:
 *   0 — executionTimelockBlock (must be < @BLOCK)
 *   1 — proposalId hash (commitment)
 *   2 — actionIndex
 *   3 — actionType hash
 *   4 — mandateNonce (for single-use replay protection)
 */
export function buildTreasuryExecutionScript(config: TreasuryExecutionConfig): string {
  const multisigKeys = config.governancePks.map(pk => `0x${pk}`).join(', ')

  return [
    `LET treasury = 0x${config.treasuryPk}`,
    ``,
    `// Timelock`,
    `ASSERT @BLOCK GT STATE(0)`,
    ``,
    `// Mandate: proposal identity`,
    `LET proposalId = STATE(1)`,
    `ASSERT proposalId NEQ 0x00`,
    ``,
    `// Mandate: action index must match`,
    `LET actionIndex = STATE(2)`,
    `ASSERT actionIndex GTE 0`,
    ``,
    `// Mandate: action type must be treasury_spend`,
    `LET actionType = STATE(3)`,
    `ASSERT actionType NEQ 0x00`,
    ``,
    `// Replay protection`,
    `LET nonce = STATE(4)`,
    `ASSERT nonce GT PREVSTATE(4)`,
    ``,
    `// Governance authorization`,
    `ASSERT MULTISIG(${config.multisigThreshold}, ${multisigKeys})`,
    ``,
    `// Output verification`,
    `ASSERT VERIFYOUT(0, 0x${config.recipientPk}, ${config.amount}, ${config.tokenId}, TRUE)`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}

import { computeCanonicalScriptHash } from '../mast/mast-compiler.js'

/**
 * RFC-020 P2-6 (STABLE-009): script hashes must be the canonical on-chain MMR
 * leaf hash, not a bare SHA3 of the source string.
 */
export function computeScriptHash(script: string): string {
  return computeCanonicalScriptHash(script)
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

/**
 * RFC-020 KISSVM-MULTISIG-THRESHOLD-001: a governance multisig config must be
 * meaningful — non-empty, distinct keys, and an in-range threshold. A duplicate
 * key collapses MULTISIG positions; a non-positive threshold is unsatisfiable.
 */
function assertGovernanceMultisig(pks: readonly string[], threshold: number, label: string): void {
  if (!Array.isArray(pks) || pks.length === 0) {
    throw new Error(`${label}: governancePks must be non-empty`)
  }
  const normalized = pks.map((pk) => pk.replace(/^0x/i, '').toLowerCase())
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${label}: governancePks must be distinct (duplicate keys collapse MULTISIG positions)`)
  }
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > normalized.length) {
    throw new Error(`${label}: multisigThreshold must satisfy 1 <= threshold <= ${normalized.length}`)
  }
}

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
  /**
   * RFC-020 P2-4 (STABLE-013): committed port holding the eligible-voter /
   * weight total. When set, `quorumPct` is enforced as a true percentage of it
   * (`total * 100 >= quorumPct * eligible`). When omitted, `quorumPct` is
   * treated as an absolute minimum vote count.
   */
  eligiblePort?: number
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
  assertGovernanceMultisig(config.governancePks, config.multisigThreshold, 'buildProposalStateMachineScript')
  const multisigKeys = config.governancePks.map(pk => `0x${pk}`).join(', ')
  const proposerPort = config.proposerPort ?? 4

  return [
    `// RFC-020 P2-4 (STABLE-007): the proposal timing/proposer anchors are`,
    `// committed; no state transition may rewrite them.`,
    `ASSERT STATE(1) EQ PREVSTATE(1)`,
    `ASSERT STATE(2) EQ PREVSTATE(2)`,
    `ASSERT STATE(3) EQ PREVSTATE(3)`,
    `ASSERT STATE(${proposerPort}) EQ PREVSTATE(${proposerPort})`,
    ``,
    `SWITCH PREVSTATE(0)`,
    ``,
    `  CASE ${STATUS.DRAFT}`,
    `    IF STATE(0) EQ ${STATUS.ACTIVE} THEN`,
    `      ASSERT @BLOCK GTE STATE(1)`,
    `    ELSEIF STATE(0) EQ ${STATUS.CANCELLED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePks[0]}) OR SIGNEDBY(PREVSTATE(${proposerPort}))`,
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
    `      ASSERT SIGNEDBY(0x${config.governancePks[0]}) OR SIGNEDBY(PREVSTATE(${proposerPort}))`,
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
    ...(config.eligiblePort !== undefined
      ? [
          `// Quorum as a percentage of the committed electorate (RFC-020 P2-4)`,
          `LET eligible = PREVSTATE(${config.eligiblePort})`,
          `ASSERT eligible GT 0`,
          `ASSERT currTotal MUL 100 GTE ${config.quorumPct} MUL eligible`,
        ]
      : [
          `// Quorum as an absolute minimum vote count (no eligiblePort configured)`,
          `ASSERT currTotal GTE ${config.quorumPct}`,
        ]),
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
    `// RFC-020 P2-4 (STABLE-006): voter identity, membership weight and the`,
    `// snapshot anchor are committed in PREVSTATE, not self-declared in STATE.`,
    `LET voter = PREVSTATE(0)`,
    `ASSERT voter NEQ 0x00`,
    `ASSERT STATE(0) EQ voter`,
    `ASSERT SIGNEDBY(voter)`,
    ``,
    `// Nonce: prevent double voting via INC`,
    `ASSERT STATE(${config.noncePort}) EQ INC(PREVSTATE(${config.noncePort}))`,
    ``,
    `// Membership weight must be positive and committed`,
    `LET weight = PREVSTATE(${config.weightPort})`,
    `ASSERT weight GT 0`,
    `ASSERT STATE(${config.weightPort}) EQ weight`,
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
    `// Membership snapshot hash committed and unchanged`,
    `LET snapshotHash = PREVSTATE(${config.snapshotPort})`,
    `ASSERT snapshotHash NEQ 0x00`,
    `ASSERT STATE(${config.snapshotPort}) EQ snapshotHash`,
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
  assertGovernanceMultisig(config.governancePks, config.multisigThreshold, 'buildExecutionMandateScript')
  const multisigKeys = config.governancePks.map(pk => `0x${pk}`).join(', ')

  return [
    `// RFC-020 P2-1 (STABLE-003): the timelock and all anchors are read from the`,
    `// committed PREVSTATE and preserved, so a caller cannot inject new values at`,
    `// execution time (the previous script trusted mutable STATE and only checked`,
    `// the anchors were non-zero).`,
    `LET votingEndsAt = PREVSTATE(4)`,
    `LET executionDelay = PREVSTATE(5)`,
    `ASSERT @BLOCK GT votingEndsAt ADD executionDelay`,
    ``,
    `// Committed anchors must be carried forward unchanged`,
    `ASSERT STATE(4) EQ votingEndsAt`,
    `ASSERT STATE(5) EQ executionDelay`,
    ``,
    `// Outcome proof must be committed and preserved`,
    `LET outcomeProof = PREVSTATE(${config.outcomeProofPort})`,
    `ASSERT outcomeProof NEQ 0x00`,
    `ASSERT STATE(${config.outcomeProofPort}) EQ outcomeProof`,
    ``,
    `// Vote tally hash must be committed and preserved`,
    `LET tallyHash = PREVSTATE(${config.tallyHashPort})`,
    `ASSERT tallyHash NEQ 0x00`,
    `ASSERT STATE(${config.tallyHashPort}) EQ tallyHash`,
    ``,
    `// Membership snapshot hash must be committed and preserved`,
    `LET snapshotHash = PREVSTATE(${config.snapshotPort})`,
    `ASSERT snapshotHash NEQ 0x00`,
    `ASSERT STATE(${config.snapshotPort}) EQ snapshotHash`,
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
  assertGovernanceMultisig(config.governancePks, config.multisigThreshold, 'buildTreasuryExecutionScript')
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

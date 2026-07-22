export type ProposalStatus =
  | 'draft'
  | 'active'
  | 'passed'
  | 'failed'
  | 'executed'
  | 'cancelled'
  | 'expired'

export type ProposalActionType =
  | 'rotate_root'
  | 'advance_epoch'
  | 'treasury_spend'
  | 'budget_allocate'
  | 'member_add'
  | 'member_remove'
  | 'policy_update'
  | 'custom'

export interface ProposalAction {
  type: ProposalActionType
  target?: string
  payload: Record<string, unknown>
  description: string
}

export interface Proposal {
  id: string
  daoId: string
  title: string
  description: string
  actions: ProposalAction[]
  proposer: string
  status: ProposalStatus
  createdAt: number
  votingStartsAt: number
  votingEndsAt: number
  executionDelay: number
  executedAt?: number
  executionTxId?: string
  voteTally?: VoteTally
  membershipSnapshotHash: string
}

// ─── Voting ──────────────────────────────────────────────────────────────────

export interface Vote {
  id: string
  proposalId: string
  voter: string
  choice: 'yes' | 'no' | 'abstain'
  weight: number
  quadraticCredits?: number
  delegationChain?: string[]
  castAt: number
}

export interface VoteTally {
  proposalId: string
  yes: number
  no: number
  abstain: number
  totalWeight: number
  quorumWeight: number
  quorumReached: boolean
  passed: boolean
  thresholdBps: number
  algorithm: TallyAlgorithm
}

export type TallyAlgorithm = 'linear' | 'quadratic'

// ─── Delegation / Liquid democracy ──────────────────────────────────────────

export interface Delegation {
  id: string
  daoId: string
  delegator: string
  delegate: string
  weight: number
  scope?: 'all' | 'proposal' | string
  expiresAt?: number
  castAt: number
  revokedAt?: number
  previousDelegationId?: string
}

export interface DelegationResolution {
  finalVoter: string
  weight: number
  chain: string[]
  depth: number
}

// ─── Quadratic ──────────────────────────────────────────────────────────────

export interface QuadraticCredits {
  memberId: string
  totalCredits: number
  spentCredits: number
  creditSource: 'weight' | 'fixed'
}

export interface QuadraticVoteAllocation {
  proposalId: string
  memberId: string
  creditsSpent: number
  votesCast: number
  directedTo: string
}

// ─── Membership ─────────────────────────────────────────────────────────────

export interface MembershipEntry {
  memberId: string
  role: string
  weight: number
  addedAt: number
  addedBy: string
  expiresAt?: number
}

export interface MembershipSnapshot {
  daoId: string
  frozenAt: number
  entries: Map<string, MembershipEntry>
  hash: string
}

// ─── Config ─────────────────────────────────────────────────────────────────

export interface QuadraticConfig {
  enabled: boolean
  creditSource: 'weight' | 'fixed'
  maxCreditsPerMember?: number
}

export interface DelegationConfig {
  enabled: boolean
  maxChainDepth: number
  allowPartialDelegation: boolean
  allowScopeRestricted: boolean
  allowRecall: boolean
  recallThresholdBps?: number
}

export interface VotingConfig {
  algorithm: 'linear' | 'quadratic' | 'liquid'
  quorumBps: number
  passThresholdBps: number
  votingPeriodMs: number
  delayBeforeVotingMs: number
  executionDelayMs: number
  allowAbstain: boolean
  quadratic?: QuadraticConfig
  delegation?: DelegationConfig
}

export interface GovernanceConfig {
  daoId: string
  name: string
  voting: VotingConfig
  membership: {
    defaultWeight: number
    minWeightToPropose: number
  }
  authorityScope: string
  authorityResolver: string
}

// ─── Usage store ────────────────────────────────────────────────────────────

export interface UsageReservation {
  id: string
  mandateProofId: string
  intentId: string
  reservedAt: number
  expiresAt: number
  status: 'reserved' | 'committed' | 'aborted'
}

export interface MandateReceipt {
  id: string
  mandateProofId: string
  intentId: string
  proposalId: string
  actionIndex: number
  actionType: ProposalActionType
  committedAt: number
  proofId?: string
}

// ─── Outcome ────────────────────────────────────────────────────────────────

export interface ProposalOutcome {
  proposalId: string
  status: ProposalStatus
  tallyHash: string
  passed: boolean
  determinedAt: number
  determinedBy: string
  proofId?: string
}

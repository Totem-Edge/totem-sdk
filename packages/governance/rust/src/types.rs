use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProposalStatus {
    #[serde(rename = "draft")]
    Draft,
    #[serde(rename = "active")]
    Active,
    #[serde(rename = "passed")]
    Passed,
    #[serde(rename = "failed")]
    Failed,
    #[serde(rename = "executed")]
    Executed,
    #[serde(rename = "cancelled")]
    Cancelled,
    #[serde(rename = "expired")]
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProposalActionType {
    #[serde(rename = "rotate_root")]
    RotateRoot,
    #[serde(rename = "advance_epoch")]
    AdvanceEpoch,
    #[serde(rename = "treasury_spend")]
    TreasurySpend,
    #[serde(rename = "budget_allocate")]
    BudgetAllocate,
    #[serde(rename = "member_add")]
    MemberAdd,
    #[serde(rename = "member_remove")]
    MemberRemove,
    #[serde(rename = "policy_update")]
    PolicyUpdate,
    #[serde(rename = "custom")]
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalAction {
    #[serde(rename = "type")]
    pub action_type: ProposalActionType,
    pub target: Option<String>,
    pub payload: serde_json::Value,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Proposal {
    pub id: String,
    #[serde(rename = "daoId")]
    pub dao_id: String,
    pub title: String,
    pub description: String,
    pub actions: Vec<ProposalAction>,
    pub proposer: String,
    pub status: ProposalStatus,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    #[serde(rename = "votingStartsAt")]
    pub voting_starts_at: u64,
    #[serde(rename = "votingEndsAt")]
    pub voting_ends_at: u64,
    #[serde(rename = "executionDelay")]
    pub execution_delay: u64,
    #[serde(rename = "executedAt")]
    pub executed_at: Option<u64>,
    #[serde(rename = "executionTxId")]
    pub execution_tx_id: Option<String>,
    #[serde(rename = "voteTally")]
    pub vote_tally: Option<VoteTally>,
    #[serde(rename = "membershipSnapshotHash")]
    pub membership_snapshot_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vote {
    pub id: String,
    #[serde(rename = "proposalId")]
    pub proposal_id: String,
    pub voter: String,
    pub choice: String,
    pub weight: f64,
    #[serde(rename = "quadraticCredits")]
    pub quadratic_credits: Option<f64>,
    #[serde(rename = "delegationChain")]
    pub delegation_chain: Option<Vec<String>>,
    #[serde(rename = "castAt")]
    pub cast_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteTally {
    #[serde(rename = "proposalId")]
    pub proposal_id: String,
    pub yes: f64,
    pub no: f64,
    pub abstain: f64,
    #[serde(rename = "totalWeight")]
    pub total_weight: f64,
    #[serde(rename = "quorumWeight")]
    pub quorum_weight: f64,
    #[serde(rename = "quorumReached")]
    pub quorum_reached: bool,
    pub passed: bool,
    #[serde(rename = "thresholdBps")]
    pub threshold_bps: u32,
    pub algorithm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Delegation {
    pub id: String,
    #[serde(rename = "daoId")]
    pub dao_id: String,
    pub delegator: String,
    pub delegate: String,
    pub weight: f64,
    pub scope: Option<String>,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<u64>,
    #[serde(rename = "castAt")]
    pub cast_at: u64,
    #[serde(rename = "revokedAt")]
    pub revoked_at: Option<u64>,
    #[serde(rename = "previousDelegationId")]
    pub previous_delegation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegationResolution {
    #[serde(rename = "finalVoter")]
    pub final_voter: String,
    pub weight: f64,
    pub chain: Vec<String>,
    pub depth: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuadraticCredits {
    #[serde(rename = "memberId")]
    pub member_id: String,
    #[serde(rename = "totalCredits")]
    pub total_credits: f64,
    #[serde(rename = "spentCredits")]
    pub spent_credits: f64,
    #[serde(rename = "creditSource")]
    pub credit_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuadraticVoteAllocation {
    #[serde(rename = "proposalId")]
    pub proposal_id: String,
    #[serde(rename = "memberId")]
    pub member_id: String,
    #[serde(rename = "creditsSpent")]
    pub credits_spent: f64,
    #[serde(rename = "votesCast")]
    pub votes_cast: f64,
    #[serde(rename = "directedTo")]
    pub directed_to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MembershipEntry {
    #[serde(rename = "memberId")]
    pub member_id: String,
    pub role: String,
    pub weight: f64,
    #[serde(rename = "addedAt")]
    pub added_at: u64,
    #[serde(rename = "addedBy")]
    pub added_by: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MembershipSnapshot {
    #[serde(rename = "daoId")]
    pub dao_id: String,
    #[serde(rename = "frozenAt")]
    pub frozen_at: u64,
    pub entries: HashMap<String, MembershipEntry>,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuadraticConfig {
    pub enabled: bool,
    #[serde(rename = "creditSource")]
    pub credit_source: String,
    #[serde(rename = "maxCreditsPerMember")]
    pub max_credits_per_member: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegationConfig {
    pub enabled: bool,
    #[serde(rename = "maxChainDepth")]
    pub max_chain_depth: u32,
    #[serde(rename = "allowPartialDelegation")]
    pub allow_partial_delegation: bool,
    #[serde(rename = "allowScopeRestricted")]
    pub allow_scope_restricted: bool,
    #[serde(rename = "allowRecall")]
    pub allow_recall: bool,
    #[serde(rename = "recallThresholdBps")]
    pub recall_threshold_bps: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VotingConfig {
    pub algorithm: String,
    #[serde(rename = "quorumBps")]
    pub quorum_bps: u32,
    #[serde(rename = "passThresholdBps")]
    pub pass_threshold_bps: u32,
    #[serde(rename = "votingPeriodMs")]
    pub voting_period_ms: u64,
    #[serde(rename = "delayBeforeVotingMs")]
    pub delay_before_voting_ms: u64,
    #[serde(rename = "executionDelayMs")]
    pub execution_delay_ms: u64,
    #[serde(rename = "allowAbstain")]
    pub allow_abstain: bool,
    pub quadratic: Option<QuadraticConfig>,
    pub delegation: Option<DelegationConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceConfig {
    #[serde(rename = "daoId")]
    pub dao_id: String,
    pub name: String,
    pub voting: VotingConfig,
    pub membership: MembershipConfig,
    #[serde(rename = "authorityScope")]
    pub authority_scope: String,
    #[serde(rename = "authorityResolver")]
    pub authority_resolver: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MembershipConfig {
    #[serde(rename = "defaultWeight")]
    pub default_weight: f64,
    #[serde(rename = "minWeightToPropose")]
    pub min_weight_to_propose: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalOutcome {
    #[serde(rename = "proposalId")]
    pub proposal_id: String,
    pub status: ProposalStatus,
    #[serde(rename = "tallyHash")]
    pub tally_hash: String,
    pub passed: bool,
    #[serde(rename = "determinedAt")]
    pub determined_at: u64,
    #[serde(rename = "determinedBy")]
    pub determined_by: String,
    #[serde(rename = "proofId")]
    pub proof_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VotingPowerResult {
    #[serde(rename = "directWeight")]
    pub direct_weight: f64,
    #[serde(rename = "delegatedFrom")]
    pub delegated_from: Vec<DelegatedWeight>,
    #[serde(rename = "totalWeight")]
    pub total_weight: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegatedWeight {
    #[serde(rename = "memberId")]
    pub member_id: String,
    pub weight: f64,
    pub chain: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernedMandate {
    pub grantor: String,
    pub grantee: String,
    pub principal: String,
    pub scope: String,
    pub constraints: Vec<MandateConstraint>,
    #[serde(rename = "usageLimit")]
    pub usage_limit: UsageLimit,
    #[serde(rename = "issuedAt")]
    pub issued_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MandateConstraint {
    pub field: String,
    pub operator: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageLimit {
    #[serde(rename = "maxCount")]
    pub max_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub action: ProposalAction,
    #[serde(rename = "actionIndex")]
    pub action_index: u32,
    #[serde(rename = "mandateBody")]
    pub mandate_body: GovernedMandate,
}

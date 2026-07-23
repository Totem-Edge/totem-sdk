use std::time::{SystemTime, UNIX_EPOCH};

use crate::ids::compute_tally_hash;
use crate::outcome::{create_governed_mandate, create_outcome, CreateGovernedMandateParams, CreateOutcomeParams};
use crate::types::{ExecutionResult, GovernanceConfig, Proposal, ProposalStatus, VoteTally};

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn execute_proposal(
    proposal: &Proposal,
    tally: &VoteTally,
    outcome_proof_id: &str,
    governance_identity: &str,
    executor: &str,
) -> Vec<ExecutionResult> {
    if proposal.status != ProposalStatus::Passed {
        return Vec::new();
    }

    let now = now_ms();
    let execution_deadline = proposal.voting_ends_at + proposal.execution_delay;
    if now < execution_deadline {
        return Vec::new();
    }

    let outcome = create_outcome(CreateOutcomeParams {
        proposal: proposal.clone(),
        tally: tally.clone(),
        determined_by: governance_identity.to_string(),
        determined_at: None,
    });

    let tally_hash = compute_tally_hash(tally);

    proposal
        .actions
        .iter()
        .enumerate()
        .map(|(index, action)| {
            let mandate_body = create_governed_mandate(CreateGovernedMandateParams {
                outcome: outcome.clone(),
                action: action.clone(),
                action_index: index as u32,
                governance_identity: governance_identity.to_string(),
                executor: executor.to_string(),
                membership_snapshot_hash: proposal.membership_snapshot_hash.clone(),
                vote_tally_hash: tally_hash.clone(),
                outcome_proof_id: outcome_proof_id.to_string(),
            });
            ExecutionResult {
                action: action.clone(),
                action_index: index as u32,
                mandate_body,
            }
        })
        .collect()
}

pub fn is_execution_ready(proposal: &Proposal, _config: Option<&GovernanceConfig>) -> bool {
    if proposal.status != ProposalStatus::Passed {
        return false;
    }
    let now = now_ms();
    now >= proposal.voting_ends_at + proposal.execution_delay
}

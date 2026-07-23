use serde::Deserialize;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::ids::compute_proposal_id;
use crate::snapshot::get_member_weight;
use crate::types::{GovernanceConfig, MembershipSnapshot, Proposal, ProposalAction, ProposalStatus};

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[derive(Deserialize)]
pub struct CreateProposalParams {
    pub config: GovernanceConfig,
    pub actions: Vec<ProposalAction>,
    pub title: String,
    pub description: String,
    pub proposer: String,
    pub snapshot: MembershipSnapshot,
    pub created_at: Option<u64>,
}

pub fn create_proposal(params: CreateProposalParams) -> Result<Proposal, String> {
    let now = params.created_at.unwrap_or_else(now_ms);

    if !params.snapshot.entries.contains_key(&params.proposer) {
        return Err("proposer is not a member".to_string());
    }

    let proposer_weight = get_member_weight(&params.snapshot, &params.proposer);
    if proposer_weight < params.config.membership.min_weight_to_propose {
        return Err(format!(
            "proposer weight {} below minimum {}",
            proposer_weight, params.config.membership.min_weight_to_propose
        ));
    }

    let proposal_id = compute_proposal_id(
        &params.config.dao_id,
        &params.proposer,
        now,
        params.actions.len(),
    );

    let voting_starts_at = now + params.config.voting.delay_before_voting_ms;
    let voting_ends_at = voting_starts_at + params.config.voting.voting_period_ms;

    Ok(Proposal {
        id: proposal_id,
        dao_id: params.config.dao_id,
        title: params.title,
        description: params.description,
        actions: params.actions,
        proposer: params.proposer,
        status: ProposalStatus::Draft,
        created_at: now,
        voting_starts_at,
        voting_ends_at,
        execution_delay: params.config.voting.execution_delay_ms,
        executed_at: None,
        execution_tx_id: None,
        vote_tally: None,
        membership_snapshot_hash: params.snapshot.hash,
    })
}

pub fn activate_proposal(proposal: &Proposal) -> Result<Proposal, String> {
    if proposal.status != ProposalStatus::Draft {
        return Err(format!(
            "cannot activate proposal in status '{:?}'",
            proposal.status
        ));
    }
    let now = now_ms();
    if now < proposal.voting_starts_at {
        return Err(format!(
            "voting has not started yet (starts at {})",
            proposal.voting_starts_at
        ));
    }
    let mut p = proposal.clone();
    p.status = ProposalStatus::Active;
    Ok(p)
}

pub fn cancel_proposal(proposal: &Proposal) -> Result<Proposal, String> {
    if proposal.status == ProposalStatus::Executed || proposal.status == ProposalStatus::Cancelled {
        return Err(format!(
            "cannot cancel proposal in status '{:?}'",
            proposal.status
        ));
    }
    let mut p = proposal.clone();
    p.status = ProposalStatus::Cancelled;
    Ok(p)
}

use serde::Deserialize;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::ids::compute_vote_id;
use crate::snapshot::get_member_weight;
use crate::delegation::get_active_delegations;
use crate::types::{
    Delegation, GovernanceConfig, MembershipSnapshot, Proposal, ProposalStatus, QuadraticCredits, Vote,
};

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[derive(Deserialize)]
pub struct CreateVoteParams {
    pub proposal: Proposal,
    pub voter: String,
    pub choice: String,
    pub snapshot: MembershipSnapshot,
    pub delegations: Option<Vec<Delegation>>,
    pub config: Option<GovernanceConfig>,
    pub cast_at: Option<u64>,
}

pub fn create_vote(params: CreateVoteParams) -> Result<Vote, String> {
    let now = params.cast_at.unwrap_or_else(now_ms);

    if params.proposal.status != ProposalStatus::Active && params.proposal.status != ProposalStatus::Draft {
        return Err(format!(
            "proposal is in status '{:?}', cannot vote",
            params.proposal.status
        ));
    }
    if now < params.proposal.voting_starts_at {
        return Err("voting has not started yet".to_string());
    }
    if now > params.proposal.voting_ends_at {
        return Err("voting has ended".to_string());
    }

    if params.choice == "abstain" {
        if let Some(ref config) = params.config {
            if !config.voting.allow_abstain {
                return Err("abstain is not allowed".to_string());
            }
        }
    }

    let weight = get_member_weight(&params.snapshot, &params.voter);
    if weight <= 0.0 {
        return Err("voter has no weight in membership snapshot".to_string());
    }

    let id = compute_vote_id(&params.proposal.id, &params.voter, &params.choice, now);

    let delegation_chain: Option<Vec<String>> = if let Some(ref delegations) = params.delegations {
        if !delegations.is_empty() {
            let active = get_active_delegations(delegations, &params.proposal.dao_id, None);
            let out_delegations: Vec<&Delegation> = active.iter().filter(|d| d.delegator == params.voter).collect();
            if !out_delegations.is_empty() {
                Some(vec![params.voter.clone()])
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    Ok(Vote {
        id,
        proposal_id: params.proposal.id,
        voter: params.voter,
        choice: params.choice,
        weight,
        quadratic_credits: None,
        delegation_chain,
        cast_at: now,
    })
}

#[derive(Deserialize)]
pub struct CreateQuadraticVoteParams {
    pub proposal: Proposal,
    pub voter: String,
    pub allocations: Vec<QuadraticAllocation>,
    pub snapshot: MembershipSnapshot,
    pub credits: Option<QuadraticCredits>,
    pub config: Option<GovernanceConfig>,
    pub cast_at: Option<u64>,
}

#[derive(Deserialize)]
pub struct QuadraticAllocation {
    pub choice: String,
    pub votes: f64,
}

pub fn create_quadratic_vote(params: CreateQuadraticVoteParams) -> Result<Vec<Vote>, String> {
    let now = params.cast_at.unwrap_or_else(now_ms);

    if params.proposal.status != ProposalStatus::Active && params.proposal.status != ProposalStatus::Draft {
        return Err(format!(
            "proposal is in status '{:?}', cannot vote",
            params.proposal.status
        ));
    }
    if now < params.proposal.voting_starts_at {
        return Err("voting has not started yet".to_string());
    }
    if now > params.proposal.voting_ends_at {
        return Err("voting has ended".to_string());
    }

    let weight = get_member_weight(&params.snapshot, &params.voter);
    if weight <= 0.0 {
        return Err("voter has no weight in membership snapshot".to_string());
    }

    let total_credits_needed: f64 = params.allocations.iter().map(|a| a.votes * a.votes).sum();

    if let Some(ref credits) = params.credits {
        let available = credits.total_credits - credits.spent_credits;
        if total_credits_needed > available {
            return Err(format!(
                "quadratic vote requires {} credits but only {} available",
                total_credits_needed, available
            ));
        }
    }

    if let Some(ref config) = params.config {
        if let Some(ref quad) = config.voting.quadratic {
            if quad.credit_source == "weight" && total_credits_needed > weight {
                return Err(format!(
                    "quadratic vote requires {} credits but weight is only {}",
                    total_credits_needed, weight
                ));
            }
        }
    }

    let votes: Vec<Vote> = params
        .allocations
        .iter()
        .map(|alloc| {
            let id = compute_vote_id(&params.proposal.id, &params.voter, &alloc.choice, now);
            Vote {
                id,
                proposal_id: params.proposal.id.clone(),
                voter: params.voter.clone(),
                choice: alloc.choice.clone(),
                weight: (alloc.votes * alloc.votes).sqrt(),
                quadratic_credits: Some(alloc.votes * alloc.votes),
                delegation_chain: None,
                cast_at: now,
            }
        })
        .collect();

    Ok(votes)
}

#[derive(Deserialize)]
pub struct CreateDelegatedVoteParams {
    pub proposal: Proposal,
    pub delegate: String,
    pub delegations: Vec<Delegation>,
    pub snapshot: MembershipSnapshot,
    pub choice: String,
    pub cast_at: Option<u64>,
}

pub fn create_delegated_vote(params: CreateDelegatedVoteParams) -> Result<Vec<Vote>, String> {
    let now = params.cast_at.unwrap_or_else(now_ms);

    if params.proposal.status != ProposalStatus::Active {
        return Err(format!(
            "proposal is in status '{:?}', cannot vote",
            params.proposal.status
        ));
    }
    if now < params.proposal.voting_starts_at {
        return Err("voting has not started yet".to_string());
    }
    if now > params.proposal.voting_ends_at {
        return Err("voting has ended".to_string());
    }

    let active_delegations = get_active_delegations(&params.delegations, &params.proposal.dao_id, None);
    let inbound_delegations: Vec<&Delegation> = active_delegations
        .iter()
        .filter(|d| d.delegate == params.delegate)
        .collect();

    if inbound_delegations.is_empty() {
        return Err(format!("no delegations found pointing to {}", params.delegate));
    }

    let mut votes: Vec<Vote> = Vec::new();
    let mut processed: std::collections::HashSet<String> = std::collections::HashSet::new();

    for del in &inbound_delegations {
        if processed.contains(&del.delegator) {
            continue;
        }
        processed.insert(del.delegator.clone());

        let delegator_weight = get_member_weight(&params.snapshot, &del.delegator);
        if delegator_weight <= 0.0 {
            continue;
        }

        let effective_weight = if del.weight > 0.0 {
            del.weight.min(delegator_weight)
        } else {
            delegator_weight
        };

        let id = compute_vote_id(&params.proposal.id, &del.delegator, &params.choice, now);

        votes.push(Vote {
            id,
            proposal_id: params.proposal.id.clone(),
            voter: del.delegator.clone(),
            choice: params.choice.clone(),
            weight: effective_weight,
            quadratic_credits: None,
            delegation_chain: Some(vec![del.delegator.clone(), params.delegate.clone()]),
            cast_at: now,
        });
    }

    Ok(votes)
}

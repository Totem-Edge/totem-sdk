use serde::Deserialize;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::ids::compute_tally_hash;
use crate::types::{GovernanceConfig, Proposal, ProposalStatus, Vote, VoteTally};

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[derive(Deserialize)]
pub struct TallyVotesParams {
    pub proposal: Proposal,
    pub votes: Vec<Vote>,
    pub total_weight: f64,
    pub quorum_weight: Option<f64>,
    pub config: Option<GovernanceConfig>,
}

pub fn tally_votes(params: TallyVotesParams) -> Result<VoteTally, String> {
    if params.votes.is_empty() {
        return Err("no votes to tally".to_string());
    }

    let now = now_ms();
    if now < params.proposal.voting_ends_at {
        return Err("voting has not ended yet".to_string());
    }

    let algorithm = match params.config {
        Some(ref c) if c.voting.algorithm == "quadratic" => "quadratic",
        _ => "linear",
    };

    let mut yes_weight = 0.0_f64;
    let mut no_weight = 0.0_f64;
    let mut abstain_weight = 0.0_f64;

    if algorithm == "quadratic" {
        for vote in &params.votes {
            let sqrt_weight = if vote.weight > 0.0 {
                vote.weight.sqrt()
            } else {
                0.0
            };
            match vote.choice.as_str() {
                "yes" => yes_weight += sqrt_weight,
                "no" => no_weight += sqrt_weight,
                "abstain" => abstain_weight += sqrt_weight,
                _ => {}
            }
        }
    } else {
        for vote in &params.votes {
            match vote.choice.as_str() {
                "yes" => yes_weight += vote.weight,
                "no" => no_weight += vote.weight,
                "abstain" => abstain_weight += vote.weight,
                _ => {}
            }
        }
    }

    let total_cast = yes_weight + no_weight + abstain_weight;

    let quorum_weight = params.quorum_weight.unwrap_or_else(|| {
        if let Some(ref config) = params.config {
            ((params.total_weight * config.voting.quorum_bps as f64) / 10000.0).floor()
        } else {
            params.total_weight
        }
    });

    let quorum_reached = total_cast >= quorum_weight;

    let pass_threshold_bps = params
        .config
        .as_ref()
        .map(|c| c.voting.pass_threshold_bps)
        .unwrap_or(5000);

    let passed = if quorum_reached && (yes_weight + no_weight) > 0.0 {
        let ratio = (yes_weight / (yes_weight + no_weight)) * 10000.0;
        ratio >= pass_threshold_bps as f64
    } else {
        false
    };

    let floor_3 = |v: f64| (v * 1000.0).floor() / 1000.0;

    let tally = VoteTally {
        proposal_id: params.proposal.id,
        yes: floor_3(yes_weight),
        no: floor_3(no_weight),
        abstain: floor_3(abstain_weight),
        total_weight: params.total_weight,
        quorum_weight,
        quorum_reached,
        passed,
        threshold_bps: pass_threshold_bps,
        algorithm: algorithm.to_string(),
    };

    Ok(tally)
}

pub fn finalize_proposal(proposal: &Proposal, tally: &VoteTally) -> Proposal {
    let mut p = proposal.clone();
    p.status = if tally.passed {
        ProposalStatus::Passed
    } else {
        ProposalStatus::Failed
    };
    p.vote_tally = Some(tally.clone());
    p
}

pub fn compute_tally_proof_hash(tally: &VoteTally) -> String {
    compute_tally_hash(tally)
}

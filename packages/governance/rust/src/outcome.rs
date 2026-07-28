use serde::Deserialize;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::tally::compute_tally_proof_hash;
use crate::types::{
    GovernedMandate, MandateConstraint, Proposal, ProposalAction, ProposalOutcome, ProposalStatus,
    UsageLimit, VoteTally,
};

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[derive(Deserialize)]
pub struct CreateOutcomeParams {
    pub proposal: Proposal,
    pub tally: VoteTally,
    pub determined_by: String,
    pub determined_at: Option<u64>,
}

pub fn create_outcome(params: CreateOutcomeParams) -> ProposalOutcome {
    let tally_hash = compute_tally_proof_hash(&params.tally);
    let now = params.determined_at.unwrap_or_else(now_ms);

    ProposalOutcome {
        proposal_id: params.proposal.id,
        status: if params.tally.passed {
            ProposalStatus::Passed
        } else {
            ProposalStatus::Failed
        },
        tally_hash,
        passed: params.tally.passed,
        determined_at: now,
        determined_by: params.determined_by,
        proof_id: None,
    }
}

#[derive(Deserialize)]
pub struct CreateGovernedMandateParams {
    pub outcome: ProposalOutcome,
    pub action: ProposalAction,
    pub action_index: u32,
    pub governance_identity: String,
    pub executor: String,
    pub membership_snapshot_hash: String,
    pub vote_tally_hash: String,
    pub outcome_proof_id: String,
}

pub fn create_governed_mandate(params: CreateGovernedMandateParams) -> GovernedMandate {
    let mut constraints: Vec<MandateConstraint> = vec![
        MandateConstraint {
            field: "proposalId".to_string(),
            operator: "eq".to_string(),
            value: serde_json::Value::String(params.outcome.proposal_id.clone()),
        },
        MandateConstraint {
            field: "actionIndex".to_string(),
            operator: "eq".to_string(),
            value: serde_json::Value::Number(serde_json::Number::from(params.action_index)),
        },
        MandateConstraint {
            field: "actionType".to_string(),
            operator: "eq".to_string(),
            value: serde_json::Value::String(format!("{:?}", params.action.action_type)),
        },
        MandateConstraint {
            field: "membershipSnapshotHash".to_string(),
            operator: "eq".to_string(),
            value: serde_json::Value::String(params.membership_snapshot_hash),
        },
        MandateConstraint {
            field: "voteTallyHash".to_string(),
            operator: "eq".to_string(),
            value: serde_json::Value::String(params.vote_tally_hash),
        },
        MandateConstraint {
            field: "outcomeProofId".to_string(),
            operator: "eq".to_string(),
            value: serde_json::Value::String(params.outcome_proof_id),
        },
    ];

    if let Some(ref target) = params.action.target {
        constraints.push(MandateConstraint {
            field: "target".to_string(),
            operator: "eq".to_string(),
            value: serde_json::Value::String(target.clone()),
        });
    }

    if let serde_json::Value::Object(ref payload_map) = params.action.payload {
        let mut keys: Vec<&String> = payload_map.keys().collect();
        keys.sort();
        for key in keys {
            constraints.push(MandateConstraint {
                field: format!("payload.{}", key),
                operator: "eq".to_string(),
                value: payload_map[key].clone(),
            });
        }
    }

    GovernedMandate {
        grantor: params.governance_identity,
        grantee: params.executor,
        principal: params.outcome.proposal_id,
        scope: format!("governance:{:?}:execute", params.action.action_type),
        constraints,
        usage_limit: UsageLimit { max_count: 1 },
        issued_at: params.outcome.determined_at,
    }
}

pub fn finalize_proposal_execution(
    proposal: &Proposal,
    _outcome_proof_signed: &serde_json::Value,
    tx_id: &str,
) -> Proposal {
    let mut p = proposal.clone();
    p.status = ProposalStatus::Executed;
    p.executed_at = Some(now_ms());
    p.execution_tx_id = Some(tx_id.to_string());
    p
}

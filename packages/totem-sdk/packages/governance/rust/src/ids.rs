use crate::canonical::hash_canonical;
use crate::types::VoteTally;

const DOMAIN_PROPOSAL: &str = "TOTEM_GOVERNANCE_PROPOSAL_V1";
const DOMAIN_VOTE: &str = "TOTEM_GOVERNANCE_VOTE_V1";
const DOMAIN_TALLY: &str = "TOTEM_GOVERNANCE_TALLY_V1";
const DOMAIN_DELEGATION: &str = "TOTEM_GOVERNANCE_DELEGATION_V1";
const DOMAIN_SNAPSHOT: &str = "TOTEM_GOVERNANCE_SNAPSHOT_V1";
const DOMAIN_OUTCOME: &str = "TOTEM_GOVERNANCE_OUTCOME_V1";

pub fn compute_proposal_id(dao_id: &str, proposer: &str, created_at: u64, action_count: usize) -> String {
    let payload = serde_json::json!({
        "daoId": dao_id,
        "proposer": proposer,
        "createdAt": created_at,
        "actionCount": action_count,
    });
    format!("totem:gov:proposal:{}", hash_canonical(DOMAIN_PROPOSAL, &payload))
}

pub fn compute_vote_id(proposal_id: &str, voter: &str, choice: &str, cast_at: u64) -> String {
    let payload = serde_json::json!({
        "proposalId": proposal_id,
        "voter": voter,
        "choice": choice,
        "castAt": cast_at,
    });
    format!("totem:gov:vote:{}", hash_canonical(DOMAIN_VOTE, &payload))
}

pub fn compute_tally_hash(tally: &VoteTally) -> String {
    let payload = serde_json::json!({
        "proposalId": tally.proposal_id,
        "yes": tally.yes,
        "no": tally.no,
        "abstain": tally.abstain,
        "totalWeight": tally.total_weight,
        "quorumWeight": tally.quorum_weight,
        "thresholdBps": tally.threshold_bps,
        "algorithm": tally.algorithm,
    });
    hash_canonical(DOMAIN_TALLY, &payload)
}

pub fn compute_delegation_id(delegator: &str, delegate: &str, dao_id: &str, cast_at: u64) -> String {
    let payload = serde_json::json!({
        "delegator": delegator,
        "delegate": delegate,
        "daoId": dao_id,
        "castAt": cast_at,
    });
    format!("totem:gov:delegation:{}", hash_canonical(DOMAIN_DELEGATION, &payload))
}

pub fn compute_snapshot_hash(
    dao_id: &str,
    frozen_at: u64,
    entries: &[(&str, f64)],
) -> String {
    let mut sorted: Vec<(&str, f64)> = entries.to_vec();
    sorted.sort_by(|a, b| a.0.cmp(b.0));
    let entries_json: Vec<serde_json::Value> = sorted
        .iter()
        .map(|(member_id, weight)| {
            serde_json::json!({
                "memberId": member_id,
                "weight": weight,
            })
        })
        .collect();
    let payload = serde_json::json!({
        "daoId": dao_id,
        "frozenAt": frozen_at,
        "entries": entries_json,
    });
    hash_canonical(DOMAIN_SNAPSHOT, &payload)
}

pub fn compute_outcome_id(proposal_id: &str, tally_hash: &str, determined_at: u64) -> String {
    let payload = serde_json::json!({
        "proposalId": proposal_id,
        "tallyHash": tally_hash,
        "determinedAt": determined_at,
    });
    format!("totem:gov:outcome:{}", hash_canonical(DOMAIN_OUTCOME, &payload))
}

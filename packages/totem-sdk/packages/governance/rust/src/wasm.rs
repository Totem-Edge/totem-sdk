use wasm_bindgen::prelude::*;

use crate::canonical;
use crate::config;
use crate::delegation;
use crate::execution;
use crate::ids;
use crate::outcome;
use crate::proposal;
use crate::snapshot;
use crate::tally;
use crate::types::*;
use crate::voting;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

// ─── canonical ───────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn to_hex_wasm(bytes: &[u8]) -> String {
    canonical::to_hex(bytes)
}

#[wasm_bindgen]
pub fn canonical_json_wasm(value: JsValue) -> Result<String, JsValue> {
    let v: serde_json::Value = serde_wasm_bindgen::from_value(value)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse value: {}", e)))?;
    Ok(canonical::canonical_json(&v))
}

#[wasm_bindgen]
pub fn hash_canonical_wasm(domain: &str, value: JsValue) -> Result<String, JsValue> {
    let v: serde_json::Value = serde_wasm_bindgen::from_value(value)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse value: {}", e)))?;
    Ok(canonical::hash_canonical(domain, &v))
}

// ─── ids ─────────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn compute_proposal_id_wasm(
    dao_id: &str,
    proposer: &str,
    created_at: u64,
    action_count: usize,
) -> String {
    ids::compute_proposal_id(dao_id, proposer, created_at, action_count)
}

#[wasm_bindgen]
pub fn compute_vote_id_wasm(
    proposal_id: &str,
    voter: &str,
    choice: &str,
    cast_at: u64,
) -> String {
    ids::compute_vote_id(proposal_id, voter, choice, cast_at)
}

#[wasm_bindgen]
pub fn compute_tally_hash_wasm(tally_js: JsValue) -> Result<String, JsValue> {
    let tally: VoteTally = serde_wasm_bindgen::from_value(tally_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse tally: {}", e)))?;
    Ok(ids::compute_tally_hash(&tally))
}

#[wasm_bindgen]
pub fn compute_delegation_id_wasm(
    delegator: &str,
    delegate: &str,
    dao_id: &str,
    cast_at: u64,
) -> String {
    ids::compute_delegation_id(delegator, delegate, dao_id, cast_at)
}

#[wasm_bindgen]
pub fn compute_snapshot_hash_wasm(
    dao_id: &str,
    frozen_at: u64,
    entries_js: JsValue,
) -> Result<String, JsValue> {
    let entries: Vec<serde_json::Value> = serde_wasm_bindgen::from_value(entries_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse entries: {}", e)))?;
    let owned: Vec<(String, f64)> = entries
        .iter()
        .map(|e| {
            let member_id = e["memberId"].as_str().unwrap_or("").to_string();
            let weight = e["weight"].as_f64().unwrap_or(0.0);
            (member_id, weight)
        })
        .collect();
    let refs: Vec<(&str, f64)> = owned.iter().map(|(s, f)| (s.as_str(), *f)).collect();
    Ok(ids::compute_snapshot_hash(dao_id, frozen_at, &refs))
}

#[wasm_bindgen]
pub fn compute_outcome_id_wasm(
    proposal_id: &str,
    tally_hash: &str,
    determined_at: u64,
) -> String {
    ids::compute_outcome_id(proposal_id, tally_hash, determined_at)
}

// ─── config ──────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn create_governance_config_wasm(params_js: JsValue) -> Result<JsValue, JsValue> {
    let params: config::CreateGovernanceConfigParams = serde_wasm_bindgen::from_value(params_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse params: {}", e)))?;
    let config = config::create_governance_config(params);
    serde_wasm_bindgen::to_value(&config)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize config: {}", e)))
}

#[wasm_bindgen]
pub fn validate_governance_config_wasm(config_js: JsValue) -> Result<JsValue, JsValue> {
    let config: GovernanceConfig = serde_wasm_bindgen::from_value(config_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse config: {}", e)))?;
    let errors = config::validate_governance_config(&config);
    serde_wasm_bindgen::to_value(&errors)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize errors: {}", e)))
}

// ─── snapshot ────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn freeze_membership_snapshot_wasm(
    dao_id: &str,
    entries_js: JsValue,
    frozen_at: Option<u64>,
) -> Result<JsValue, JsValue> {
    let entries: Vec<MembershipEntry> = serde_wasm_bindgen::from_value(entries_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse entries: {}", e)))?;
    let snapshot = snapshot::freeze_membership_snapshot(dao_id, &entries, frozen_at);
    serde_wasm_bindgen::to_value(&snapshot)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize snapshot: {}", e)))
}

#[wasm_bindgen]
pub fn verify_membership_snapshot_wasm(snapshot_js: JsValue) -> Result<bool, JsValue> {
    let snap: MembershipSnapshot = serde_wasm_bindgen::from_value(snapshot_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse snapshot: {}", e)))?;
    Ok(snapshot::verify_membership_snapshot(&snap))
}

#[wasm_bindgen]
pub fn get_member_weight_wasm(snapshot_js: JsValue, member_id: &str) -> Result<f64, JsValue> {
    let snap: MembershipSnapshot = serde_wasm_bindgen::from_value(snapshot_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse snapshot: {}", e)))?;
    Ok(snapshot::get_member_weight(&snap, member_id))
}

#[wasm_bindgen]
pub fn get_total_weight_wasm(snapshot_js: JsValue) -> Result<f64, JsValue> {
    let snap: MembershipSnapshot = serde_wasm_bindgen::from_value(snapshot_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse snapshot: {}", e)))?;
    Ok(snapshot::get_total_weight(&snap))
}

// ─── proposal ────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn create_proposal_wasm(params_js: JsValue) -> Result<JsValue, JsValue> {
    let params: proposal::CreateProposalParams = serde_wasm_bindgen::from_value(params_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse params: {}", e)))?;
    match proposal::create_proposal(params) {
        Ok(p) => serde_wasm_bindgen::to_value(&p)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize proposal: {}", e))),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn activate_proposal_wasm(proposal_js: JsValue) -> Result<JsValue, JsValue> {
    let p: Proposal = serde_wasm_bindgen::from_value(proposal_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse proposal: {}", e)))?;
    match proposal::activate_proposal(&p) {
        Ok(activated) => serde_wasm_bindgen::to_value(&activated)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize proposal: {}", e))),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn cancel_proposal_wasm(proposal_js: JsValue) -> Result<JsValue, JsValue> {
    let p: Proposal = serde_wasm_bindgen::from_value(proposal_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse proposal: {}", e)))?;
    match proposal::cancel_proposal(&p) {
        Ok(cancelled) => serde_wasm_bindgen::to_value(&cancelled)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize proposal: {}", e))),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

// ─── delegation ──────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn create_delegation_wasm(params_js: JsValue) -> Result<JsValue, JsValue> {
    let params: delegation::CreateDelegationParams = serde_wasm_bindgen::from_value(params_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse params: {}", e)))?;
    let d = delegation::create_delegation(params);
    serde_wasm_bindgen::to_value(&d)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize delegation: {}", e)))
}

#[wasm_bindgen]
pub fn recall_delegation_wasm(
    delegation_js: JsValue,
    revoked_at: Option<u64>,
) -> Result<JsValue, JsValue> {
    let d: Delegation = serde_wasm_bindgen::from_value(delegation_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse delegation: {}", e)))?;
    let recalled = delegation::recall_delegation(&d, revoked_at);
    serde_wasm_bindgen::to_value(&recalled)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize delegation: {}", e)))
}

#[wasm_bindgen]
pub fn get_active_delegations_wasm(
    delegations_js: JsValue,
    dao_id: &str,
    now: Option<u64>,
) -> Result<JsValue, JsValue> {
    let delegations: Vec<Delegation> = serde_wasm_bindgen::from_value(delegations_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse delegations: {}", e)))?;
    let active = delegation::get_active_delegations(&delegations, dao_id, now);
    serde_wasm_bindgen::to_value(&active)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize delegations: {}", e)))
}

#[wasm_bindgen]
pub fn get_weight_to_delegate_wasm(
    member_id: &str,
    snapshot_js: JsValue,
    delegations_js: JsValue,
    dao_id: &str,
) -> Result<f64, JsValue> {
    let snap: MembershipSnapshot = serde_wasm_bindgen::from_value(snapshot_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse snapshot: {}", e)))?;
    let delegations: Vec<Delegation> = serde_wasm_bindgen::from_value(delegations_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse delegations: {}", e)))?;
    Ok(delegation::get_weight_to_delegate(member_id, &snap, &delegations, dao_id))
}

#[wasm_bindgen]
pub fn resolve_delegation_wasm(
    member_id: &str,
    dao_id: &str,
    snapshot_js: JsValue,
    delegations_js: JsValue,
    max_depth: Option<u32>,
    proposal_id: Option<String>,
) -> Result<JsValue, JsValue> {
    let snap: MembershipSnapshot = serde_wasm_bindgen::from_value(snapshot_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse snapshot: {}", e)))?;
    let delegations: Vec<Delegation> = serde_wasm_bindgen::from_value(delegations_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse delegations: {}", e)))?;
    let result = delegation::resolve_delegation(member_id, dao_id, &snap, &delegations, max_depth, proposal_id.as_deref());
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

#[wasm_bindgen]
pub fn resolve_voting_power_wasm(
    member_id: &str,
    dao_id: &str,
    snapshot_js: JsValue,
    delegations_js: JsValue,
    max_depth: Option<u32>,
    proposal_id: Option<String>,
) -> Result<JsValue, JsValue> {
    let snap: MembershipSnapshot = serde_wasm_bindgen::from_value(snapshot_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse snapshot: {}", e)))?;
    let delegations: Vec<Delegation> = serde_wasm_bindgen::from_value(delegations_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse delegations: {}", e)))?;
    let result = delegation::resolve_voting_power(member_id, dao_id, &snap, &delegations, max_depth, proposal_id.as_deref());
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

// ─── voting ──────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn create_vote_wasm(params_js: JsValue) -> Result<JsValue, JsValue> {
    let params: voting::CreateVoteParams = serde_wasm_bindgen::from_value(params_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse params: {}", e)))?;
    match voting::create_vote(params) {
        Ok(v) => serde_wasm_bindgen::to_value(&v)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize vote: {}", e))),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn create_quadratic_vote_wasm(params_js: JsValue) -> Result<JsValue, JsValue> {
    let params: voting::CreateQuadraticVoteParams = serde_wasm_bindgen::from_value(params_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse params: {}", e)))?;
    match voting::create_quadratic_vote(params) {
        Ok(votes) => serde_wasm_bindgen::to_value(&votes)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize votes: {}", e))),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn create_delegated_vote_wasm(params_js: JsValue) -> Result<JsValue, JsValue> {
    let params: voting::CreateDelegatedVoteParams = serde_wasm_bindgen::from_value(params_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse params: {}", e)))?;
    match voting::create_delegated_vote(params) {
        Ok(votes) => serde_wasm_bindgen::to_value(&votes)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize votes: {}", e))),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

// ─── tally ───────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn tally_votes_wasm(params_js: JsValue) -> Result<JsValue, JsValue> {
    let params: tally::TallyVotesParams = serde_wasm_bindgen::from_value(params_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse params: {}", e)))?;
    match tally::tally_votes(params) {
        Ok(t) => serde_wasm_bindgen::to_value(&t)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize tally: {}", e))),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn finalize_proposal_wasm(proposal_js: JsValue, tally_js: JsValue) -> Result<JsValue, JsValue> {
    let p: Proposal = serde_wasm_bindgen::from_value(proposal_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse proposal: {}", e)))?;
    let t: VoteTally = serde_wasm_bindgen::from_value(tally_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse tally: {}", e)))?;
    let finalized = tally::finalize_proposal(&p, &t);
    serde_wasm_bindgen::to_value(&finalized)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize proposal: {}", e)))
}

#[wasm_bindgen]
pub fn compute_tally_proof_hash_wasm(tally_js: JsValue) -> Result<String, JsValue> {
    let t: VoteTally = serde_wasm_bindgen::from_value(tally_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse tally: {}", e)))?;
    Ok(tally::compute_tally_proof_hash(&t))
}

// ─── outcome ─────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn create_outcome_wasm(params_js: JsValue) -> Result<JsValue, JsValue> {
    let params: outcome::CreateOutcomeParams = serde_wasm_bindgen::from_value(params_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse params: {}", e)))?;
    let o = outcome::create_outcome(params);
    serde_wasm_bindgen::to_value(&o)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize outcome: {}", e)))
}

#[wasm_bindgen]
pub fn create_governed_mandate_wasm(params_js: JsValue) -> Result<JsValue, JsValue> {
    let params: outcome::CreateGovernedMandateParams = serde_wasm_bindgen::from_value(params_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse params: {}", e)))?;
    let m = outcome::create_governed_mandate(params);
    serde_wasm_bindgen::to_value(&m)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize mandate: {}", e)))
}

#[wasm_bindgen]
pub fn finalize_proposal_execution_wasm(
    proposal_js: JsValue,
    outcome_proof_signed_js: JsValue,
    tx_id: &str,
) -> Result<JsValue, JsValue> {
    let p: Proposal = serde_wasm_bindgen::from_value(proposal_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse proposal: {}", e)))?;
    let signed: serde_json::Value = serde_wasm_bindgen::from_value(outcome_proof_signed_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse signed proof: {}", e)))?;
    let finalized = outcome::finalize_proposal_execution(&p, &signed, tx_id);
    serde_wasm_bindgen::to_value(&finalized)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize proposal: {}", e)))
}

// ─── execution ───────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn execute_proposal_wasm(
    proposal_js: JsValue,
    tally_js: JsValue,
    outcome_proof_id: &str,
    governance_identity: &str,
    executor: &str,
) -> Result<JsValue, JsValue> {
    let p: Proposal = serde_wasm_bindgen::from_value(proposal_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse proposal: {}", e)))?;
    let t: VoteTally = serde_wasm_bindgen::from_value(tally_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse tally: {}", e)))?;
    let results = execution::execute_proposal(&p, &t, outcome_proof_id, governance_identity, executor);
    serde_wasm_bindgen::to_value(&results)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize results: {}", e)))
}

#[wasm_bindgen]
pub fn is_execution_ready_wasm(
    proposal_js: JsValue,
    config_js: Option<JsValue>,
) -> Result<bool, JsValue> {
    let p: Proposal = serde_wasm_bindgen::from_value(proposal_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse proposal: {}", e)))?;
    let config: Option<GovernanceConfig> = if let Some(cjs) = config_js {
        Some(serde_wasm_bindgen::from_value(cjs)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse config: {}", e)))?)
    } else {
        None
    };
    Ok(execution::is_execution_ready(&p, config.as_ref()))
}

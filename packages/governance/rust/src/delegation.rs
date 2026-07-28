use serde::Deserialize;
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::ids::compute_delegation_id;
use crate::snapshot::get_member_weight;
use crate::types::{Delegation, DelegationResolution, MembershipSnapshot, VotingPowerResult, DelegatedWeight};

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[derive(Deserialize)]
pub struct CreateDelegationParams {
    pub dao_id: String,
    pub delegator: String,
    pub delegate: String,
    pub weight: Option<f64>,
    pub scope: Option<String>,
    pub expires_at: Option<u64>,
    pub cast_at: Option<u64>,
    pub previous_delegation_id: Option<String>,
}

pub fn create_delegation(params: CreateDelegationParams) -> Delegation {
    let now = params.cast_at.unwrap_or_else(now_ms);
    Delegation {
        id: compute_delegation_id(&params.delegator, &params.delegate, &params.dao_id, now),
        dao_id: params.dao_id,
        delegator: params.delegator,
        delegate: params.delegate,
        weight: params.weight.unwrap_or(0.0),
        scope: params.scope,
        expires_at: params.expires_at,
        cast_at: now,
        revoked_at: None,
        previous_delegation_id: params.previous_delegation_id,
    }
}

pub fn recall_delegation(delegation: &Delegation, revoked_at: Option<u64>) -> Delegation {
    let mut d = delegation.clone();
    d.revoked_at = Some(revoked_at.unwrap_or_else(now_ms));
    d
}

pub fn get_active_delegations(delegations: &[Delegation], dao_id: &str, now: Option<u64>) -> Vec<Delegation> {
    let t = now.unwrap_or_else(now_ms);
    delegations
        .iter()
        .filter(|d| {
            d.dao_id == dao_id
                && d.revoked_at.is_none()
                && (d.expires_at.is_none() || t <= d.expires_at.unwrap())
        })
        .cloned()
        .collect()
}

pub fn get_weight_to_delegate(
    member_id: &str,
    snapshot: &MembershipSnapshot,
    delegations: &[Delegation],
    dao_id: &str,
) -> f64 {
    let active = get_active_delegations(delegations, dao_id, None);
    let member_delegations: Vec<&Delegation> = active.iter().filter(|d| d.delegator == member_id).collect();
    if member_delegations.is_empty() {
        return 0.0;
    }

    let total_weight = get_member_weight(snapshot, member_id);
    let mut delegated_away = 0.0;
    for d in &member_delegations {
        if d.weight <= 0.0 {
            delegated_away += total_weight;
        } else {
            delegated_away += d.weight.min(total_weight);
        }
    }
    delegated_away.min(total_weight)
}

pub fn resolve_delegation(
    member_id: &str,
    dao_id: &str,
    snapshot: &MembershipSnapshot,
    delegations: &[Delegation],
    max_depth: Option<u32>,
    proposal_id: Option<&str>,
) -> DelegationResolution {
    let max_depth = max_depth.unwrap_or(5);
    let active_delegations = get_active_delegations(delegations, dao_id, None);

    let mut visited: HashSet<String> = HashSet::new();
    let mut chain: Vec<String> = Vec::new();
    let weight = get_member_weight(snapshot, member_id);
    let mut current = member_id.to_string();
    let mut depth: u32 = 0;

    while depth < max_depth {
        if visited.contains(&current) {
            break;
        }
        visited.insert(current.clone());

        let out_delegations: Vec<&Delegation> = active_delegations
            .iter()
            .filter(|d| d.delegator == current)
            .filter(|d| {
                if let Some(pid) = proposal_id {
                    if let Some(ref scope) = d.scope {
                        if scope != "all" && scope != pid {
                            return false;
                        }
                    }
                }
                true
            })
            .collect();

        if out_delegations.is_empty() {
            break;
        }

        let primary = out_delegations[0];
        chain.push(current.clone());
        current = primary.delegate.clone();
        depth += 1;

        if depth >= max_depth {
            break;
        }
    }

    DelegationResolution {
        final_voter: current,
        weight,
        chain,
        depth,
    }
}

fn resolve_delegation_chain(
    start: &str,
    _dao_id: &str,
    _snapshot: &MembershipSnapshot,
    active_delegations: &[Delegation],
    max_depth: u32,
    proposal_id: Option<&str>,
    stop_at: Option<&str>,
) -> (Vec<String>, String) {
    let mut visited: HashSet<String> = HashSet::new();
    let mut chain: Vec<String> = Vec::new();
    let mut current = start.to_string();
    let mut depth: u32 = 0;

    while depth < max_depth {
        if visited.contains(&current) {
            break;
        }
        visited.insert(current.clone());

        if let Some(stop) = stop_at {
            if current == stop {
                break;
            }
        }

        let out_delegations: Vec<&Delegation> = active_delegations
            .iter()
            .filter(|d| d.delegator == current)
            .filter(|d| {
                if let Some(pid) = proposal_id {
                    if let Some(ref scope) = d.scope {
                        if scope != "all" && scope != pid {
                            return false;
                        }
                    }
                }
                true
            })
            .collect();

        if out_delegations.is_empty() {
            break;
        }

        let primary = out_delegations[0];
        chain.push(primary.delegate.clone());
        current = primary.delegate.clone();
        depth += 1;
    }

    (chain, current)
}

pub fn resolve_voting_power(
    member_id: &str,
    dao_id: &str,
    snapshot: &MembershipSnapshot,
    delegations: &[Delegation],
    max_depth: Option<u32>,
    proposal_id: Option<&str>,
) -> VotingPowerResult {
    let max_depth = max_depth.unwrap_or(5);
    let active_delegations = get_active_delegations(delegations, dao_id, None);

    let direct_weight = get_member_weight(snapshot, member_id);

    let inbound_delegations: Vec<&Delegation> = active_delegations
        .iter()
        .filter(|d| d.delegate == member_id)
        .collect();

    let mut delegated_from: Vec<DelegatedWeight> = Vec::new();

    for del in &inbound_delegations {
        let del_weight = get_member_weight(snapshot, &del.delegator);
        if del_weight <= 0.0 {
            continue;
        }

        let effective_weight = if del.weight > 0.0 {
            del.weight.min(del_weight)
        } else {
            del_weight
        };

        let (resolved_chain, final_delegate) = resolve_delegation_chain(
            &del.delegator,
            dao_id,
            snapshot,
            &active_delegations,
            max_depth,
            proposal_id,
            Some(member_id),
        );

        if final_delegate != member_id {
            continue;
        }

        delegated_from.push(DelegatedWeight {
            member_id: del.delegator.clone(),
            weight: effective_weight,
            chain: resolved_chain,
        });
    }

    let total_delegated_in: f64 = delegated_from.iter().map(|d| d.weight).sum();
    let total_weight = direct_weight + total_delegated_in;

    VotingPowerResult {
        direct_weight,
        delegated_from,
        total_weight,
    }
}

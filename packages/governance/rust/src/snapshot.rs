use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::ids::compute_snapshot_hash;
use crate::types::{MembershipEntry, MembershipSnapshot};

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn freeze_membership_snapshot(
    dao_id: &str,
    entries: &[MembershipEntry],
    frozen_at: Option<u64>,
) -> MembershipSnapshot {
    let at = frozen_at.unwrap_or_else(now_ms);
    let mut map: HashMap<String, MembershipEntry> = HashMap::new();

    for entry in entries {
        if entry.member_id.is_empty() {
            continue;
        }
        if let Some(existing) = map.get(&entry.member_id) {
            if entry.added_at < existing.added_at {
                continue;
            }
        }
        map.insert(entry.member_id.clone(), entry.clone());
    }

    let snapshot_entries: Vec<(&str, f64)> = map
        .iter()
        .map(|(id, e)| (id.as_str(), e.weight))
        .collect();

    let hash = compute_snapshot_hash(dao_id, at, &snapshot_entries);

    MembershipSnapshot {
        dao_id: dao_id.to_string(),
        frozen_at: at,
        entries: map,
        hash,
    }
}

pub fn verify_membership_snapshot(snapshot: &MembershipSnapshot) -> bool {
    let entries: Vec<(&str, f64)> = snapshot
        .entries
        .iter()
        .map(|(id, e)| (id.as_str(), e.weight))
        .collect();
    let expected_hash = compute_snapshot_hash(&snapshot.dao_id, snapshot.frozen_at, &entries);
    expected_hash == snapshot.hash
}

pub fn get_member_weight(snapshot: &MembershipSnapshot, member_id: &str) -> f64 {
    match snapshot.entries.get(member_id) {
        Some(entry) => {
            if let Some(expires_at) = entry.expires_at {
                if now_ms() > expires_at {
                    return 0.0;
                }
            }
            entry.weight
        }
        None => 0.0,
    }
}

pub fn get_total_weight(snapshot: &MembershipSnapshot) -> f64 {
    let now = now_ms();
    snapshot
        .entries
        .values()
        .filter(|entry| {
            if let Some(expires_at) = entry.expires_at {
                now <= expires_at
            } else {
                true
            }
        })
        .map(|entry| entry.weight)
        .sum()
}

pub fn get_member_weight_at(
    snapshot: &MembershipSnapshot,
    member_id: &str,
    at: u64,
) -> f64 {
    match snapshot.entries.get(member_id) {
        Some(entry) => {
            if let Some(expires_at) = entry.expires_at {
                if at > expires_at {
                    return 0.0;
                }
            }
            entry.weight
        }
        None => 0.0,
    }
}

pub fn get_total_weight_at(snapshot: &MembershipSnapshot, at: u64) -> f64 {
    snapshot
        .entries
        .values()
        .filter(|entry| {
            if let Some(expires_at) = entry.expires_at {
                at <= expires_at
            } else {
                true
            }
        })
        .map(|entry| entry.weight)
        .sum()
}

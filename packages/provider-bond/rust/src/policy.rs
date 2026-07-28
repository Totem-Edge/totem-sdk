use crate::scoring::compute_recommendation;
use crate::types::*;

pub fn filter_providers_by_policy(
    provider: &ProviderBondManifest,
    policy: &ProviderPolicy,
    score: Option<&ProviderScore>,
    probes: &[ProbeResult],
    incidents: &[IncidentRecord],
) -> PolicyMatch {
    let now = policy.now.unwrap_or(0);
    let mut reasons: Vec<String> = Vec::new();
    let mut failures: Vec<String> = Vec::new();

    if let Some(ref min_score) = policy.min_score {
        if let Some(s) = score {
            if s.score < *min_score {
                failures.push(format!("Score {} is below minimum {}", s.score, min_score));
            } else {
                reasons.push(format!("Score {} meets minimum {}", s.score, min_score));
            }
        }
    }

    if policy.require_identity.unwrap_or(false) {
        if provider.provider_bond.bond_owner_address.is_none() {
            failures.push("Identity not declared".to_string());
        } else {
            reasons.push("Identity declared".to_string());
        }
    }

    if policy.require_active_bond.unwrap_or(false) {
        let has_active = provider.provider_bond.bond_stack.as_ref().map_or(false, |s| {
            s.iter().any(|d| d.status == "active")
        });
        if !has_active {
            failures.push("No active bond".to_string());
        } else {
            reasons.push("Active bond present".to_string());
        }
    }

    if policy.require_minima_hard_collateral.unwrap_or(false) {
        let has_minima = provider.provider_bond.bond_stack.as_ref().map_or(false, |s| {
            s.iter().any(|d| d.asset == "MINIMA" && d.purpose == "hard-collateral" && d.status == "active")
        });
        if !has_minima {
            failures.push("No active MINIMA hard-collateral bond".to_string());
        } else {
            reasons.push("MINIMA hard-collateral bond present".to_string());
        }
    }

    if let Some(ref min_amount) = policy.min_bond_amount {
        let total: u128 = provider.provider_bond.bond_stack.as_ref().map_or(0, |s| {
            s.iter().filter_map(|d| d.amount.parse::<u128>().ok()).sum()
        });
        let min: u128 = min_amount.parse().unwrap_or(0);
        if total < min {
            failures.push(format!("Total bond {} is below minimum {}", total, min));
        } else {
            reasons.push(format!("Total bond {} meets minimum {}", total, min));
        }
    }

    if let Some(ref accepted_assets) = policy.accepted_assets {
        if !accepted_assets.is_empty() {
            let bond_assets: std::collections::HashSet<&str> = provider.provider_bond.bond_stack.as_ref().map_or(
                std::collections::HashSet::new(),
                |s| s.iter().map(|d| d.asset.as_str()).collect(),
            );
            let has_accepted = accepted_assets.iter().any(|a| bond_assets.contains(a.as_str()));
            if !has_accepted {
                failures.push("No bond in accepted assets".to_string());
            } else {
                reasons.push("Bond asset accepted".to_string());
            }
        }
    }

    if let Some(ref accepted_purposes) = policy.accepted_purposes {
        if !accepted_purposes.is_empty() {
            let bond_purposes: std::collections::HashSet<&str> = provider.provider_bond.bond_stack.as_ref().map_or(
                std::collections::HashSet::new(),
                |s| s.iter().map(|d| d.purpose.as_str()).collect(),
            );
            let has_accepted = accepted_purposes.iter().any(|p| bond_purposes.contains(p.as_str()));
            if !has_accepted {
                failures.push("No bond with accepted purpose".to_string());
            } else {
                reasons.push("Bond purpose accepted".to_string());
            }
        }
    }

    if let Some(ref max_severity) = policy.max_incident_severity {
        let max_seen = incidents.iter().map(|i| severity_value(&i.severity)).max().unwrap_or(0);
        let policy_max = severity_value(max_severity);
        if max_seen > policy_max {
            failures.push("Incident severity exceeds policy maximum".to_string());
        } else {
            reasons.push("Incident severity within policy limits".to_string());
        }
    }

    if let Some(max_age) = policy.max_heartbeat_age_ms {
        let heartbeats: Vec<&ProbeResult> = probes.iter().filter(|p| p.probe_type == "heartbeat").collect();
        let last_heartbeat = heartbeats.iter().map(|h| h.observed_at).max().unwrap_or(0);
        if now > 0 && last_heartbeat > 0 && now - last_heartbeat > max_age {
            failures.push(format!("Last heartbeat too old ({}ms > {}ms)", now - last_heartbeat, max_age));
        } else if last_heartbeat > 0 {
            reasons.push("Heartbeat is recent".to_string());
        }
    }

    PolicyMatch {
        provider_id: provider.provider_bond.provider_id.clone(),
        matched: failures.is_empty(),
        reasons,
        failures,
    }
}

fn severity_value(severity: &str) -> u32 {
    match severity {
        "low" => 0,
        "medium" => 1,
        "high" => 2,
        "critical" => 3,
        _ => 0,
    }
}

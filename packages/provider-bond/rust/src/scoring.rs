use crate::types::*;

const MAX_HEARTBEAT_AGE_MS_DEFAULT: u64 = 120_000;

const SEVERITY_ORDER: [(&str, u32); 4] = [
    ("low", 0),
    ("medium", 1),
    ("high", 2),
    ("critical", 3),
];

fn severity_value(severity: &str) -> u32 {
    SEVERITY_ORDER.iter().find(|(s, _)| *s == severity).map(|(_, v)| *v).unwrap_or(0)
}

pub fn compute_provider_score(
    provider: &ProviderBondManifest,
    probes: &[ProbeResult],
    incidents: &[IncidentRecord],
    now: u64,
    weights: &ScoringWeights,
) -> ProviderScore {
    let mut reasons: Vec<String> = Vec::new();

    let identity_score: u32 = if provider.provider_bond.bond_owner_address.is_some() {
        reasons.push("Identity address declared".to_string());
        100
    } else {
        reasons.push("No identity address declared".to_string());
        0
    };

    let has_bond = provider.provider_bond.bond_stack.as_ref().map_or(false, |s| !s.is_empty());
    let has_minima_bond = provider.provider_bond.bond_stack.as_ref().map_or(false, |s| {
        s.iter().any(|d| d.asset == "MINIMA" && d.purpose == "hard-collateral" && d.status == "active")
    });

    let bond_score: u32 = if has_minima_bond {
        reasons.push("Active MINIMA hard-collateral bond with proof".to_string());
        100
    } else if has_bond {
        reasons.push("Bond declared but not MINIMA hard-collateral".to_string());
        40
    } else {
        reasons.push("No bond declared".to_string());
        0
    };

    let mut reliability_score: u32 = 50;
    if !probes.is_empty() {
        let recent: Vec<&ProbeResult> = probes.iter().filter(|p| now - p.observed_at < MAX_HEARTBEAT_AGE_MS_DEFAULT).collect();
        if !recent.is_empty() {
            let success_rate = recent.iter().filter(|p| p.ok).count() as f64 / recent.len() as f64;
            let avg_latency: f64 = recent.iter().map(|p| p.latency_ms.unwrap_or(0) as f64).sum::<f64>() / recent.len() as f64;

            reliability_score = (success_rate * 100.0) as u32;
            if avg_latency > 1000.0 { reliability_score = reliability_score.saturating_sub(20); }
            else if avg_latency > 500.0 { reliability_score = reliability_score.saturating_sub(10); }

            reasons.push(format!("Probe success rate: {:.0}%", success_rate * 100.0));
        } else {
            reliability_score = 0;
            reasons.push("No recent probes (offline)".to_string());
        }
    } else {
        reasons.push("No probe data".to_string());
    }

    let mut incident_score: u32 = 100;
    if !incidents.is_empty() {
        let open_count = incidents.iter().filter(|i| i.status == "open").count() as u32;
        let critical_count = incidents.iter().filter(|i| i.severity == "critical").count() as u32;
        let high_count = incidents.iter().filter(|i| i.severity == "high").count() as u32;

        incident_score = 100u32.saturating_sub(open_count * 10).saturating_sub(critical_count * 20).saturating_sub(high_count * 10);

        if critical_count > 0 { reasons.push(format!("{} critical incident(s)", critical_count)); }
        if high_count > 0 { reasons.push(format!("{} high-severity incident(s)", high_count)); }
        if open_count > 0 { reasons.push(format!("{} open incident(s)", open_count)); }
    } else {
        reasons.push("No incidents".to_string());
    }

    let total_score = (
        identity_score as f64 * weights.identity +
        bond_score as f64 * weights.bond +
        reliability_score as f64 * weights.reliability +
        incident_score as f64 * weights.incidents
    ).round() as u32;

    let recommendation = compute_recommendation(total_score);

    ProviderScore {
        provider_id: provider.provider_bond.provider_id.clone(),
        score: total_score,
        recommendation,
        bond_score,
        identity_score,
        reliability_score,
        incident_score,
        computed_at: now,
        reasons,
    }
}

pub fn compute_recommendation(score: u32) -> String {
    (if score >= 80 { "recommended" }
    else if score >= 60 { "acceptable" }
    else if score >= 40 { "risky" }
    else if score >= 20 { "avoid" }
    else if score > 0 { "unbonded" }
    else { "offline" }).to_string()
}

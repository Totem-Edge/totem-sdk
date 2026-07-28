use sha3::{Digest, Sha3_256};

use crate::types::{ActionIntent, AuthorityUsage, AuthorityUsageSnapshot, UsageLimit};

pub fn check_usage_limit(
    snapshot: &AuthorityUsageSnapshot,
    limit: &UsageLimit,
    now: u64,
    proposed_count: Option<u32>,
    proposed_amount: Option<&str>,
) -> bool {
    if let (Some(window_ms), Some(window_start)) = (limit.window_ms, snapshot.window_start) {
        if now > window_start + window_ms {
            return true;
        }
    }

    if let Some(max_count) = limit.max_count {
        let pc = proposed_count.unwrap_or(0);
        if snapshot.total_count + pc > max_count {
            return false;
        }
    }

    if let Some(ref max_total) = limit.max_total {
        let current: u128 = snapshot.total_amount.as_deref().unwrap_or("0").parse().unwrap_or(0);
        let proposed: u128 = proposed_amount.unwrap_or("0").parse().unwrap_or(0);
        let max: u128 = max_total.parse().unwrap_or(0);
        if current + proposed > max {
            return false;
        }
    }

    true
}

pub fn calculate_usage_delta(action: &ActionIntent) -> (u32, Option<String>) {
    let count = 1;
    let amount = action
        .constraints
        .as_ref()
        .and_then(|c| c.get("amount"))
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .or_else(|| {
            action
                .constraints
                .as_ref()
                .and_then(|c| c.get("amount"))
                .and_then(|v| v.as_f64().map(|f| f.to_string()))
        });
    (count, amount)
}

const DOMAIN_USAGE_ROOT: &str = "TOTEM_AUTHORITY_USAGE_ROOT_V1";

pub fn compute_usage_root(receipts: &[AuthorityUsage]) -> String {
    let mut inputs: Vec<serde_json::Value> = receipts
        .iter()
        .map(|r| {
            serde_json::json!({
                "usageId": r.usage_id,
                "mandateProofId": r.mandate_proof_id,
                "intentId": r.intent_id,
                "usedAt": r.used_at,
                "count": r.counts_toward.as_ref().and_then(|c| c.count).unwrap_or(1),
                "amount": r.counts_toward.as_ref().and_then(|c| c.amount.clone()),
            })
        })
        .collect();
    inputs.sort_by(|a, b| {
        a["usageId"].as_str().unwrap_or("").cmp(b["usageId"].as_str().unwrap_or(""))
    });

    let input = format!("{}{}", DOMAIN_USAGE_ROOT, serde_json::to_string(&inputs).unwrap_or_default());
    let mut hasher = Sha3_256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn snapshot_from_usage(usages: &[AuthorityUsage], _now: u64, limit: Option<&UsageLimit>) -> AuthorityUsageSnapshot {
    let mut window_start: Option<u64> = None;
    let mut window_end: Option<u64> = None;

    if let Some(limit) = limit {
        if limit.window_ms.is_some() && !usages.is_empty() {
            let mut sorted: Vec<&AuthorityUsage> = usages.iter().collect();
            sorted.sort_by_key(|u| u.used_at);
            window_start = Some(sorted[0].used_at);
            window_end = window_start.map(|ws| ws + limit.window_ms.unwrap_or(0));
        }
    }

    let mut total_count: u32 = 0;
    let mut total_amount: Option<String> = None;

    for u in usages {
        if let (Some(ws), Some(wms)) = (window_start, limit.and_then(|l| l.window_ms)) {
            if u.used_at < ws || u.used_at > ws + wms {
                continue;
            }
        }

        total_count += u.counts_toward.as_ref().and_then(|c| c.count).unwrap_or(1);

        if let Some(ref amount) = u.counts_toward.as_ref().and_then(|c| c.amount.as_ref()) {
            let current: u128 = total_amount.as_deref().unwrap_or("0").parse().unwrap_or(0);
            let add: u128 = amount.parse().unwrap_or(0);
            total_amount = Some((current + add).to_string());
        }
    }

    AuthorityUsageSnapshot {
        mandate_proof_id: usages.first().map(|u| u.mandate_proof_id.clone()).unwrap_or_default(),
        total_count,
        total_amount,
        window_start,
        window_end,
    }
}

use sha3::{Digest, Sha3_256};

use crate::types::{ActionIntent, AuthorityUsage, AuthorityUsageSnapshot, UsageLimit};

pub fn check_usage_limit(
    snapshot: &AuthorityUsageSnapshot,
    limit: &UsageLimit,
    _now: u64,
    proposed_count: Option<u32>,
    proposed_amount: Option<&str>,
) -> bool {
    // No "window expired => allow" shortcut (AUD-018). The snapshot is always
    // built for the window containing `now` (see snapshot_from_usage), and the
    // proposed delta is ALWAYS validated against the cap: a new window resets
    // the accumulated totals, it never disables the limit.
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

pub fn snapshot_from_usage(usages: &[AuthorityUsage], now: u64, limit: Option<&UsageLimit>) -> AuthorityUsageSnapshot {
    let mut window_start: Option<u64> = None;
    let mut window_end: Option<u64> = None;

    if let Some(limit) = limit {
        if let Some(window_ms) = limit.window_ms {
            if window_ms > 0 {
                // Anchor to the window containing `now` (AUD-018). Never to the
                // earliest historical receipt: that anchored the window in the
                // past, filtered out current usage, and retired the limit as
                // soon as the first window passed.
                let ws = (now / window_ms) * window_ms;
                window_start = Some(ws);
                window_end = Some(ws + window_ms);
            }
        }
    }

    let mut total_count: u32 = 0;
    let mut total_amount: Option<String> = None;

    for u in usages {
        if let (Some(ws), Some(we)) = (window_start, window_end) {
            if u.used_at < ws || u.used_at >= we {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::UsageCounts;

    fn usage(usage_id: &str, used_at: u64, counts: Option<(u32, Option<&str>)>) -> AuthorityUsage {
        AuthorityUsage {
            usage_id: usage_id.to_string(),
            mandate_proof_id: "m1".to_string(),
            intent_id: "i1".to_string(),
            used_at,
            counts_toward: counts.map(|(count, amount)| UsageCounts {
                count: Some(count),
                amount: amount.map(|a| a.to_string()),
            }),
        }
    }

    // Mirrors packages/authority/src/__tests__/usage.test.ts:62-69
    #[test]
    fn does_not_fail_open_when_a_prior_window_has_expired() {
        let snapshot = AuthorityUsageSnapshot {
            mandate_proof_id: "m1".to_string(),
            total_count: 5,
            total_amount: None,
            window_start: Some(1000),
            window_end: Some(5000),
        };
        let limit = UsageLimit {
            max_count: Some(3),
            max_total: None,
            window_ms: Some(2000),
        };
        assert!(!check_usage_limit(&snapshot, &limit, 4000, None, None));
    }

    // Mirrors packages/authority/src/__tests__/usage.test.ts:126-137
    #[test]
    fn applies_window_ms_filter_to_the_window_containing_now() {
        let usages = vec![usage("u1", 1000, None), usage("u2", 5000, None)];
        let limit = UsageLimit {
            max_count: None,
            max_total: None,
            window_ms: Some(2000),
        };
        let snapshot = snapshot_from_usage(&usages, 5000, Some(&limit));
        assert_eq!(snapshot.window_start, Some(4000));
        assert_eq!(snapshot.window_end, Some(6000));
        assert_eq!(snapshot.total_count, 1);
    }

    // Mirrors packages/authority/src/__tests__/usage.test.ts:139-149
    #[test]
    fn does_not_retire_the_cap_when_the_earliest_receipt_is_in_a_past_window() {
        let usages = vec![
            usage("u1", 0, Some((1, Some("10")))),
            usage("u2", 190, Some((1, Some("100")))),
        ];
        let limit = UsageLimit {
            max_count: Some(1),
            max_total: Some("10".to_string()),
            window_ms: Some(100),
        };
        let snapshot = snapshot_from_usage(&usages, 200, Some(&limit));
        assert_eq!(snapshot.total_count, 0);
        assert_eq!(snapshot.total_amount, None);
        assert!(!check_usage_limit(&snapshot, &limit, 200, Some(99), Some("1000000")));
    }
}

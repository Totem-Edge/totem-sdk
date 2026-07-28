use crate::types::{LiquidityFeeRecord, LiquidityPosition, PositionRiskScore, PoolUtilisation};

pub fn apply_liquidity_haircut(amount: &str, haircut_bps: Option<u32>) -> String {
    let amt: u128 = amount.parse().unwrap_or(0);
    let bps = haircut_bps.unwrap_or(0);
    if bps >= 10000 {
        return "0".to_string();
    }
    let haircut = (amt * bps as u128) / 10000;
    (amt - haircut).to_string()
}

pub fn compute_position_risk_score(position: &LiquidityPosition, now: u64) -> PositionRiskScore {
    let mut score: i32 = 100;
    let mut reasons: Vec<String> = Vec::new();

    match position.status.as_str() {
        "depleted" | "invalid" | "expired" => {
            return PositionRiskScore { score: 0, reasons: vec![format!("status is {}", position.status)] };
        }
        "quiescing" => {
            score -= 30;
            reasons.push("quiescing".to_string());
        }
        "withdrawal-requested" => {
            score -= 20;
            reasons.push("withdrawal requested".to_string());
        }
        _ => {}
    }

    if let Some(expires_at) = position.expires_at {
        let remaining = if expires_at > now { expires_at - now } else { 0 };
        if remaining < 3600_000 {
            score -= 20;
            reasons.push("expiring within 1 hour".to_string());
        } else if remaining < 86400_000 {
            score -= 10;
            reasons.push("expiring within 24 hours".to_string());
        }
    }

    if score < 0 { score = 0; }
    PositionRiskScore { score: score as u32, reasons }
}

pub fn compute_pool_utilisation(total_allocated: &str, total_capacity: &str) -> PoolUtilisation {
    let allocated: u128 = total_allocated.parse().unwrap_or(0);
    let capacity: u128 = total_capacity.parse().unwrap_or(1);
    let percentage = if capacity > 0 {
        (allocated as f64 * 10000.0 / capacity as f64) / 100.0
    } else {
        0.0
    };
    PoolUtilisation {
        percentage,
        total_allocated: total_allocated.to_string(),
        total_capacity: total_capacity.to_string(),
    }
}

pub fn detect_double_counted_liquidity(positions: &[LiquidityPosition]) -> Vec<String> {
    use std::collections::HashSet;
    let mut warnings: Vec<String> = Vec::new();

    let fields: Vec<(&str, Box<dyn Fn(&LiquidityPosition) -> Option<&str>>)> = vec![
        ("omniaChannelId", Box::new(|p: &LiquidityPosition| p.omnia_channel_id.as_deref())),
        ("factoryId", Box::new(|p: &LiquidityPosition| p.factory_id.as_deref())),
        ("routerId", Box::new(|p: &LiquidityPosition| p.router_id.as_deref())),
        ("vtxoPoolId", Box::new(|p: &LiquidityPosition| p.vtxo_pool_id.as_deref())),
        ("statechainId", Box::new(|p: &LiquidityPosition| p.statechain_id.as_deref())),
        ("rfqInventoryId", Box::new(|p: &LiquidityPosition| p.rfq_inventory_id.as_deref())),
        ("merchantSettlementId", Box::new(|p: &LiquidityPosition| p.merchant_settlement_id.as_deref())),
    ];

    for (field_name, getter) in &fields {
        let mut seen: HashSet<&str> = HashSet::new();
        for pos in positions {
            if let Some(val) = getter(pos) {
                if !val.is_empty() && !seen.insert(val) {
                    warnings.push(format!("duplicate {}: {} across positions", field_name, val));
                }
            }
        }
    }

    warnings
}

pub fn sum_fees_for_position(records: &[LiquidityFeeRecord], position_id: &str) -> String {
    let total: u128 = records
        .iter()
        .filter(|r| r.position_id == position_id)
        .filter_map(|r| r.gross_fee_amount.parse::<u128>().ok())
        .sum();
    total.to_string()
}

pub fn sum_lp_fees_for_position(records: &[LiquidityFeeRecord], position_id: &str) -> String {
    let total: u128 = records
        .iter()
        .filter(|r| r.position_id == position_id)
        .filter_map(|r| r.lp_fee_amount.parse::<u128>().ok())
        .sum();
    total.to_string()
}

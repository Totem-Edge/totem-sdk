use crate::types::{LiquidityPosition, LiquidityRiskPolicy, PolicyValidationResult};

pub fn validate_liquidity_against_policy(
    position: &LiquidityPosition,
    policy: &LiquidityRiskPolicy,
) -> PolicyValidationResult {
    if let Some(ref accepted_assets) = policy.accepted_assets {
        if !accepted_assets.is_empty() && !accepted_assets.contains(&position.asset) {
            return PolicyValidationResult {
                valid: false,
                reason: Some(format!("asset '{}' not in accepted assets", position.asset)),
            };
        }
    }

    if let Some(ref accepted_purposes) = policy.accepted_purposes {
        if !accepted_purposes.is_empty() && !accepted_purposes.contains(&position.purpose) {
            return PolicyValidationResult {
                valid: false,
                reason: Some(format!("purpose '{}' not in accepted purposes", position.purpose)),
            };
        }
    }

    match position.status.as_str() {
        "depleted" => {
            return PolicyValidationResult { valid: false, reason: Some("position is depleted".to_string()) };
        }
        "invalid" => {
            return PolicyValidationResult { valid: false, reason: Some("position is invalid".to_string()) };
        }
        "expired" => {
            return PolicyValidationResult { valid: false, reason: Some("position has expired".to_string()) };
        }
        _ => {}
    }

    PolicyValidationResult { valid: true, reason: None }
}

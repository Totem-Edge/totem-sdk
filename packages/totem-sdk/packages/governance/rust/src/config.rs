use serde::Deserialize;

use crate::types::{
    DelegationConfig, GovernanceConfig, MembershipConfig, QuadraticConfig,
    VotingConfig,
};

#[derive(Deserialize)]
pub struct CreateGovernanceConfigParams {
    pub dao_id: String,
    pub name: String,
    pub algorithm: String,
    pub quorum_bps: u32,
    pub pass_threshold_bps: u32,
    pub voting_period_ms: u64,
    pub delay_before_voting_ms: Option<u64>,
    pub execution_delay_ms: Option<u64>,
    pub allow_abstain: Option<bool>,
    pub quadratic: Option<QuadraticConfig>,
    pub delegation: Option<DelegationConfig>,
    pub default_weight: Option<f64>,
    pub min_weight_to_propose: Option<f64>,
    pub authority_scope: String,
    pub authority_resolver: String,
}

pub fn create_governance_config(params: CreateGovernanceConfigParams) -> GovernanceConfig {
    GovernanceConfig {
        dao_id: params.dao_id,
        name: params.name,
        voting: VotingConfig {
            algorithm: params.algorithm,
            quorum_bps: params.quorum_bps,
            pass_threshold_bps: params.pass_threshold_bps,
            voting_period_ms: params.voting_period_ms,
            delay_before_voting_ms: params.delay_before_voting_ms.unwrap_or(0),
            execution_delay_ms: params.execution_delay_ms.unwrap_or(0),
            allow_abstain: params.allow_abstain.unwrap_or(true),
            quadratic: params.quadratic,
            delegation: params.delegation,
        },
        membership: MembershipConfig {
            default_weight: params.default_weight.unwrap_or(1.0),
            min_weight_to_propose: params.min_weight_to_propose.unwrap_or(1.0),
        },
        authority_scope: params.authority_scope,
        authority_resolver: params.authority_resolver,
    }
}

pub fn validate_governance_config(config: &GovernanceConfig) -> Vec<String> {
    let mut errors: Vec<String> = Vec::new();

    if config.dao_id.is_empty() {
        errors.push("daoId is required".to_string());
    }
    if config.name.is_empty() {
        errors.push("name is required".to_string());
    }

    if config.voting.quorum_bps > 10000 {
        errors.push("quorumBps must be between 0 and 10000".to_string());
    }
    if config.voting.pass_threshold_bps > 10000 {
        errors.push("passThresholdBps must be between 0 and 10000".to_string());
    }
    if config.voting.voting_period_ms == 0 {
        errors.push("votingPeriodMs must be positive".to_string());
    }

    if config.voting.algorithm == "quadratic" {
        if config.voting.quadratic.is_none() {
            errors.push("quadratic config required when algorithm is quadratic".to_string());
        } else if let Some(ref q) = config.voting.quadratic {
            if q.credit_source == "fixed" {
                match q.max_credits_per_member {
                    Some(v) if v <= 0.0 => {
                        errors.push("maxCreditsPerMember required and must be positive for fixed credit source".to_string());
                    }
                    None => {
                        errors.push("maxCreditsPerMember required and must be positive for fixed credit source".to_string());
                    }
                    _ => {}
                }
            }
        }
    }

    if config.voting.algorithm == "liquid" {
        if config.voting.delegation.is_none() {
            errors.push("delegation config required when algorithm is liquid".to_string());
        } else if let Some(ref d) = config.voting.delegation {
            if d.max_chain_depth < 1 {
                errors.push("maxChainDepth must be at least 1".to_string());
            }
            if d.allow_recall {
                if let Some(rbps) = d.recall_threshold_bps {
                    if rbps > 10000 {
                        errors.push("recallThresholdBps must be between 0 and 10000".to_string());
                    }
                }
            }
        }
    }

    if config.membership.default_weight < 1.0 {
        errors.push("defaultWeight must be at least 1".to_string());
    }
    if config.membership.min_weight_to_propose < 1.0 {
        errors.push("minWeightToPropose must be at least 1".to_string());
    }

    if config.authority_scope.is_empty() {
        errors.push("authorityScope is required".to_string());
    }
    if config.authority_resolver.is_empty() {
        errors.push("authorityResolver is required".to_string());
    }

    errors
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiquidityPosition {
    #[serde(rename = "positionId")]
    pub position_id: String,
    #[serde(rename = "poolId")]
    pub pool_id: String,
    #[serde(rename = "lpAddress")]
    pub lp_address: String,
    pub amount: String,
    #[serde(rename = "effectiveAmount")]
    pub effective_amount: String,
    #[serde(rename = "allocatedAmount")]
    pub allocated_amount: String,
    #[serde(rename = "reservedAmount")]
    pub reserved_amount: String,
    #[serde(rename = "availableAmount")]
    pub available_amount: String,
    pub status: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<u64>,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    pub asset: String,
    pub purpose: String,
    #[serde(rename = "omniaChannelId")]
    pub omnia_channel_id: Option<String>,
    #[serde(rename = "factoryId")]
    pub factory_id: Option<String>,
    #[serde(rename = "routerId")]
    pub router_id: Option<String>,
    #[serde(rename = "vtxoPoolId")]
    pub vtxo_pool_id: Option<String>,
    #[serde(rename = "statechainId")]
    pub statechain_id: Option<String>,
    #[serde(rename = "rfqInventoryId")]
    pub rfq_inventory_id: Option<String>,
    #[serde(rename = "merchantSettlementId")]
    pub merchant_settlement_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiquidityRiskPolicy {
    #[serde(rename = "haircutBps")]
    pub haircut_bps: Option<u32>,
    #[serde(rename = "maxAllocationBps")]
    pub max_allocation_bps: Option<u32>,
    #[serde(rename = "allowProviderScoreBelow")]
    pub allow_provider_score_below: Option<u32>,
    #[serde(rename = "requireProviderBond")]
    pub require_provider_bond: Option<bool>,
    #[serde(rename = "requireIdentity")]
    pub require_identity: Option<bool>,
    #[serde(rename = "acceptedAssets")]
    pub accepted_assets: Option<Vec<String>>,
    #[serde(rename = "acceptedPurposes")]
    pub accepted_purposes: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiquidityFeeRecord {
    #[serde(rename = "feeRecordId")]
    pub fee_record_id: String,
    #[serde(rename = "positionId")]
    pub position_id: String,
    #[serde(rename = "grossFeeAmount")]
    pub gross_fee_amount: String,
    #[serde(rename = "lpFeeAmount")]
    pub lp_fee_amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionRiskScore {
    pub score: u32,
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolUtilisation {
    pub percentage: f64,
    #[serde(rename = "totalAllocated")]
    pub total_allocated: String,
    #[serde(rename = "totalCapacity")]
    pub total_capacity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyValidationResult {
    pub valid: bool,
    pub reason: Option<String>,
}

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpliceParams {
    #[serde(rename = "type")]
    pub splice_type: String,
    #[serde(rename = "newTotalValue")]
    pub new_total_value: String,
    #[serde(rename = "newBalances")]
    pub new_balances: HashMap<String, String>,
    #[serde(rename = "additionalCoinId")]
    pub additional_coin_id: Option<String>,
    #[serde(rename = "additionalAmount")]
    pub additional_amount: Option<String>,
    #[serde(rename = "withdrawAmount")]
    pub withdraw_amount: Option<String>,
    #[serde(rename = "withdrawAddress")]
    pub withdraw_address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpliceTxInput {
    #[serde(rename = "coinId")]
    pub coin_id: String,
    pub address: String,
    pub amount: String,
    #[serde(rename = "tokenId")]
    pub token_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpliceTxOutput {
    pub address: String,
    pub amount: String,
    #[serde(rename = "tokenId")]
    pub token_id: String,
    #[serde(rename = "storeState")]
    pub store_state: bool,
    #[serde(rename = "stateVarSettlement")]
    pub state_var_settlement: bool,
    #[serde(rename = "stateVarSequence")]
    pub state_var_sequence: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpliceTxDraft {
    pub inputs: Vec<SpliceTxInput>,
    pub outputs: Vec<SpliceTxOutput>,
    #[serde(rename = "channelId")]
    pub channel_id: String,
    pub params: SpliceParams,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub reason: Option<String>,
}

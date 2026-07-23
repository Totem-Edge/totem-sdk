use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpendableCoin {
    #[serde(rename = "coinId")]
    pub coin_id: String,
    pub address: String,
    pub amount: String,
    pub tokenid: String,
    pub created: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinSelectionResult {
    #[serde(rename = "selectedCoins")]
    pub selected_coins: Vec<SpendableCoin>,
    #[serde(rename = "totalSelected")]
    pub total_selected: String,
    pub change: String,
    #[serde(rename = "insufficientFunds")]
    pub insufficient_funds: bool,
    #[serde(rename = "fromAddresses")]
    pub from_addresses: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinSelectionOptions {
    pub mode: String,
    #[serde(rename = "targetAmount")]
    pub target_amount: String,
    #[serde(rename = "tokenId")]
    pub token_id: Option<String>,
    #[serde(rename = "focusedAddress")]
    pub focused_address: Option<String>,
    #[serde(rename = "excludedAddresses")]
    pub excluded_addresses: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultisigConfig {
    #[serde(rename = "type")]
    pub config_type: String,
    pub threshold: u32,
    #[serde(rename = "publicKeys")]
    pub public_keys: Vec<String>,
    #[serde(rename = "ownPublicKey")]
    pub own_public_key: String,
    pub address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultisigAddressResult {
    pub address: String,
    #[serde(rename = "scriptHash")]
    pub script_hash: String,
}

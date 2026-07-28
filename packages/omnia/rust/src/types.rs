use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type PartyId = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ChannelStatus {
    #[serde(rename = "opening")]
    Opening,
    #[serde(rename = "funding_pending")]
    FundingPending,
    #[serde(rename = "active")]
    Active,
    #[serde(rename = "closing_mutual")]
    ClosingMutual,
    #[serde(rename = "closing_unilateral")]
    ClosingUnilateral,
    #[serde(rename = "disputing")]
    Disputing,
    #[serde(rename = "closed")]
    Closed,
    #[serde(rename = "spliced")]
    Spliced,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelParticipant {
    #[serde(rename = "partyId")]
    pub party_id: String,
    #[serde(rename = "publicKeyDigest")]
    pub public_key_digest: String,
    #[serde(rename = "addressIndex")]
    pub address_index: u32,
    #[serde(rename = "settlementAddress")]
    pub settlement_address: Option<String>,
    #[serde(rename = "relayEndpoint")]
    pub relay_endpoint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HTLCRecord {
    #[serde(rename = "htlcId")]
    pub htlc_id: String,
    pub amount: String,
    pub hashlock: String,
    #[serde(rename = "timeoutBlock")]
    pub timeout_block: String,
    pub direction: String,
    pub status: String,
    #[serde(rename = "htlcAddress")]
    pub htlc_address: String,
    #[serde(rename = "senderPublicKeyDigest")]
    pub sender_public_key_digest: String,
    #[serde(rename = "recipientPublicKeyDigest")]
    pub recipient_public_key_digest: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateValue {
    pub port: u32,
    pub value: serde_json::Value,
    #[serde(rename = "type")]
    pub value_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SigningIndices {
    #[serde(rename = "addressIndex")]
    pub address_index: u32,
    pub l1: u32,
    pub l2: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedChannelState {
    pub sequence: u32,
    pub balances: HashMap<String, String>,
    #[serde(rename = "pendingHTLCs")]
    pub pending_htlcs: Vec<HTLCRecord>,
    #[serde(rename = "stateVariables")]
    pub state_variables: Vec<StateValue>,
    #[serde(rename = "transactionHex")]
    pub transaction_hex: String,
    pub signatures: HashMap<String, String>,
    #[serde(rename = "signingIndices")]
    pub signing_indices: HashMap<String, SigningIndices>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelLogEntry {
    pub sequence: u32,
    pub timestamp: u64,
    pub balances: HashMap<String, String>,
    #[serde(rename = "htlcCount")]
    pub htlc_count: u32,
    pub event: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelWatermark {
    #[serde(rename = "channelId")]
    pub channel_id: String,
    #[serde(rename = "addressIndex")]
    pub address_index: u32,
    #[serde(rename = "nextL1")]
    pub next_l1: u32,
    #[serde(rename = "nextL2")]
    pub next_l2: u32,
    #[serde(rename = "totalUsed")]
    pub total_used: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OmniaChannel {
    #[serde(rename = "channelId")]
    pub channel_id: String,
    #[serde(rename = "fundingTxId")]
    pub funding_tx_id: String,
    #[serde(rename = "fundingCoinId")]
    pub funding_coin_id: String,
    #[serde(rename = "fundingScript")]
    pub funding_script: String,
    #[serde(rename = "fundingAddress")]
    pub funding_address: String,
    #[serde(rename = "tokenId")]
    pub token_id: String,
    #[serde(rename = "tokenScale")]
    pub token_scale: u32,
    #[serde(rename = "totalValue")]
    pub total_value: String,
    pub parties: Vec<ChannelParticipant>,
    pub balances: HashMap<String, String>,
    #[serde(rename = "pendingHTLCs")]
    pub pending_htlcs: Vec<HTLCRecord>,
    #[serde(rename = "currentSequence")]
    pub current_sequence: u32,
    #[serde(rename = "latestState")]
    pub latest_state: Option<SignedChannelState>,
    #[serde(rename = "stateLog")]
    pub state_log: Vec<ChannelLogEntry>,
    pub status: ChannelStatus,
    #[serde(rename = "channelType")]
    pub channel_type: String,
    #[serde(rename = "factoryRef")]
    pub factory_ref: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    #[serde(rename = "updatedAt")]
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelReceipt {
    #[serde(rename = "channelId")]
    pub channel_id: String,
    pub sequence: u32,
    pub balances: HashMap<String, String>,
    #[serde(rename = "capacityWarning")]
    pub capacity_warning: Option<String>,
    #[serde(rename = "capacityUsed")]
    pub capacity_used: u32,
    #[serde(rename = "capacityTotal")]
    pub capacity_total: u32,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementPayload {
    #[serde(rename = "channelId")]
    pub channel_id: String,
    pub sequence: u32,
    #[serde(rename = "settlementTxHex")]
    pub settlement_tx_hex: String,
    pub balances: HashMap<String, String>,
    #[serde(rename = "htlcOutputs")]
    pub htlc_outputs: Vec<HTLCOutputRecord>,
    #[serde(rename = "txpowId")]
    pub txpow_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HTLCOutputRecord {
    #[serde(rename = "htlcId")]
    pub htlc_id: String,
    pub amount: String,
    #[serde(rename = "htlcTxHex")]
    pub htlc_tx_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisputePayload {
    #[serde(rename = "channelId")]
    pub channel_id: String,
    #[serde(rename = "latestSequence")]
    pub latest_sequence: u32,
    #[serde(rename = "updateTxHex")]
    pub update_tx_hex: String,
    #[serde(rename = "stateLog")]
    pub state_log: Vec<ChannelLogEntry>,
    pub evidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyStateResult {
    pub valid: bool,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapacityAssessment {
    pub warning: Option<String>,
    #[serde(rename = "nearExhaustion")]
    pub near_exhaustion: bool,
}

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
    #[serde(rename = "closePackage")]
    pub close_package: Option<SignedClosePackage>,
    #[serde(rename = "programTransition")]
    pub program_transition: Option<ProgramTransition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClosePackageArtifact {
    #[serde(rename = "txHex")]
    pub tx_hex: String,
    #[serde(rename = "txDigest")]
    pub tx_digest: String,
    pub signatures: HashMap<String, String>,
    #[serde(rename = "signingIndices")]
    pub signing_indices: HashMap<String, SigningIndices>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedClosePackage {
    pub version: u32,
    #[serde(rename = "channelId")]
    pub channel_id: String,
    pub sequence: u32,
    #[serde(rename = "stateCommitmentV2")]
    pub state_commitment_v2: String,
    pub update: ClosePackageArtifact,
    pub settlement: ClosePackageArtifact,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgramTransition {
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inputs: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub witness: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
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
pub struct PendingProposal {
    pub sequence: u32,
    #[serde(rename = "payloadHash")]
    pub payload_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UnilateralCloseStatus {
    #[serde(rename = "update_broadcast")]
    UpdateBroadcast,
    #[serde(rename = "settlement_broadcast")]
    SettlementBroadcast,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnilateralCloseState {
    #[serde(rename = "channelId")]
    pub channel_id: String,
    pub sequence: u32,
    #[serde(rename = "updateTxHex")]
    pub update_tx_hex: String,
    #[serde(rename = "settlementTxHex")]
    pub settlement_tx_hex: String,
    #[serde(rename = "contestStartBlock")]
    pub contest_start_block: u64,
    #[serde(rename = "contestDeadlineBlock")]
    pub contest_deadline_block: u64,
    pub status: UnilateralCloseStatus,
    #[serde(rename = "updateTxpowId")]
    pub update_txpow_id: Option<String>,
    #[serde(rename = "settlementTxpowId")]
    pub settlement_txpow_id: Option<String>,
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
    #[serde(rename = "programId")]
    pub program_id: String,
    #[serde(rename = "programVersion")]
    pub program_version: u32,
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
    #[serde(rename = "pendingProposal")]
    pub pending_proposal: Option<PendingProposal>,
    #[serde(rename = "latestCoinId")]
    pub latest_coin_id: Option<String>,
    #[serde(rename = "unilateralClose")]
    pub unilateral_close: Option<UnilateralCloseState>,
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn deserializes_programmable_recoverable_channel_fields() {
        let channel_json = json!({
            "channelId": "0xabc",
            "fundingTxId": "0xfunding",
            "fundingCoinId": "0xcoin",
            "fundingScript": "RETURN TRUE",
            "programId": "counter",
            "programVersion": 1,
            "fundingAddress": "0xaddress",
            "tokenId": "0x00",
            "tokenScale": 0,
            "totalValue": "1000",
            "parties": [
                { "partyId": "alice", "publicKeyDigest": "0xaaaa", "addressIndex": 0 },
                { "partyId": "bob", "publicKeyDigest": "0xbbbb", "addressIndex": 1 }
            ],
            "balances": { "alice": "600", "bob": "400" },
            "pendingHTLCs": [],
            "currentSequence": 7,
            "latestState": {
                "sequence": 7,
                "balances": { "alice": "600", "bob": "400" },
                "pendingHTLCs": [],
                "stateVariables": [
                    { "port": 120, "value": "42", "type": "number" },
                    { "port": 121, "value": "3", "type": "number" }
                ],
                "transactionHex": "0xupdate",
                "signatures": { "alice": "0x01", "bob": "0x02" },
                "signingIndices": {
                    "alice": { "addressIndex": 0, "l1": 7, "l2": 0 },
                    "bob": { "addressIndex": 1, "l1": 7, "l2": 0 }
                },
                "programTransition": {
                    "action": "set",
                    "inputs": { "value": "42" },
                    "witness": { "source": "test" },
                    "metadata": { "requestId": "req-1" }
                },
                "closePackage": {
                    "version": 1,
                    "channelId": "0xabc",
                    "sequence": 7,
                    "stateCommitmentV2": "0xcommitment",
                    "update": {
                        "txHex": "0xupdate",
                        "txDigest": "0xupdatedigest",
                        "signatures": { "alice": "0x01", "bob": "0x02" },
                        "signingIndices": {
                            "alice": { "addressIndex": 0, "l1": 7, "l2": 0 },
                            "bob": { "addressIndex": 1, "l1": 7, "l2": 0 }
                        }
                    },
                    "settlement": {
                        "txHex": "0xsettlement",
                        "txDigest": "0xsettlementdigest",
                        "signatures": { "alice": "0x03", "bob": "0x04" },
                        "signingIndices": {
                            "alice": { "addressIndex": 0, "l1": 8, "l2": 0 },
                            "bob": { "addressIndex": 1, "l1": 8, "l2": 0 }
                        }
                    }
                }
            },
            "stateLog": [],
            "status": "closing_unilateral",
            "channelType": "direct",
            "pendingProposal": { "sequence": 8, "payloadHash": "0xpayload" },
            "latestCoinId": "0xlatest",
            "unilateralClose": {
                "channelId": "0xabc",
                "sequence": 7,
                "updateTxHex": "0xupdate",
                "settlementTxHex": "0xsettlement",
                "contestStartBlock": 100,
                "contestDeadlineBlock": 356,
                "status": "update_broadcast",
                "updateTxpowId": "0xtxpow"
            },
            "createdAt": 1000,
            "updatedAt": 2000
        });

        let channel: OmniaChannel = serde_json::from_value(channel_json).expect("channel parses");
        assert_eq!(channel.program_id, "counter");
        assert_eq!(channel.program_version, 1);
        assert_eq!(channel.pending_proposal.unwrap().payload_hash, "0xpayload");
        assert_eq!(channel.latest_coin_id.as_deref(), Some("0xlatest"));

        let close = channel.unilateral_close.expect("unilateral close parses");
        assert_eq!(close.status, UnilateralCloseStatus::UpdateBroadcast);
        assert_eq!(close.update_txpow_id.as_deref(), Some("0xtxpow"));
        assert!(close.settlement_txpow_id.is_none());

        let latest = channel.latest_state.expect("latest state parses");
        let transition = latest
            .program_transition
            .expect("program transition parses");
        assert_eq!(transition.action, "set");
        assert_eq!(transition.inputs.unwrap()["value"], "42");

        let close_package = latest.close_package.expect("close package parses");
        assert_eq!(close_package.version, 1);
        assert_eq!(close_package.update.tx_digest, "0xupdatedigest");
        assert_eq!(close_package.settlement.signing_indices["bob"].l1, 8);
    }

    #[test]
    fn optional_recovery_fields_can_be_absent() {
        let state_json = json!({
            "sequence": 1,
            "balances": { "alice": "1", "bob": "1" },
            "pendingHTLCs": [],
            "stateVariables": [],
            "transactionHex": "0xupdate",
            "signatures": { "alice": "0x01", "bob": "0x02" },
            "signingIndices": {
                "alice": { "addressIndex": 0, "l1": 1, "l2": 0 },
                "bob": { "addressIndex": 1, "l1": 1, "l2": 0 }
            }
        });

        let state: SignedChannelState = serde_json::from_value(state_json).expect("state parses");
        assert!(state.close_package.is_none());
        assert!(state.program_transition.is_none());
    }
}

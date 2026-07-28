use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SigningIndices {
    #[serde(rename = "addressIndex")]
    pub address_index: u32,
    pub l1: u32,
    pub l2: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeWatermark {
    #[serde(rename = "treeId")]
    pub tree_id: String,
    #[serde(rename = "deviceId")]
    pub device_id: Option<String>,
    #[serde(rename = "branchId")]
    pub branch_id: Option<String>,
    #[serde(rename = "addressCursor")]
    pub address_cursor: u32,
    #[serde(rename = "l1Cursor")]
    pub l1_cursor: u32,
    #[serde(rename = "l2Cursor")]
    pub l2_cursor: u32,
    pub unavailable: HashMap<u32, String>,
    #[serde(rename = "lastSyncTimestamp")]
    pub last_sync_timestamp: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WotsWatermarkState {
    pub version: u32,
    pub trees: HashMap<String, TreeWatermark>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalWatermark {
    #[serde(rename = "treeId")]
    pub tree_id: String,
    #[serde(rename = "addressCursor")]
    pub address_cursor: u32,
    #[serde(rename = "l1Cursor")]
    pub l1_cursor: u32,
    #[serde(rename = "l2Cursor")]
    pub l2_cursor: u32,
    #[serde(rename = "unavailableCount")]
    pub unavailable_count: u32,
    pub capacity: u32,
    #[serde(rename = "lastSyncTimestamp")]
    pub last_sync_timestamp: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceKeyRange {
    #[serde(rename = "deviceId")]
    pub device_id: String,
    #[serde(rename = "startAddressIndex")]
    pub start_address_index: u32,
    #[serde(rename = "endAddressIndex")]
    pub end_address_index: u32,
    #[serde(rename = "addressCount")]
    pub address_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseReservation {
    #[serde(rename = "reservationId")]
    pub reservation_id: String,
    pub indices: SigningIndices,
    #[serde(rename = "expiresAt")]
    pub expires_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub synced: bool,
    pub conflicts: Vec<ConflictRecord>,
    #[serde(rename = "advancedTo")]
    pub advanced_to: Option<SigningIndices>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictRecord {
    #[serde(rename = "treeId")]
    pub tree_id: String,
    #[serde(rename = "localIndex")]
    pub local_index: u32,
    #[serde(rename = "remoteIndex")]
    pub remote_index: u32,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEntry {
    #[serde(rename = "treeId")]
    pub tree_id: String,
    #[serde(rename = "branchId")]
    pub branch_id: String,
    #[serde(rename = "wotsIndex")]
    pub wots_index: u32,
    pub indices: SigningIndices,
    pub status: String,
    #[serde(rename = "reservationId")]
    pub reservation_id: Option<String>,
    #[serde(rename = "payloadHash")]
    pub payload_hash: Option<String>,
    #[serde(rename = "txId")]
    pub tx_id: Option<String>,
    pub timestamp: u64,
    #[serde(rename = "deviceId")]
    pub device_id: String,
    #[serde(rename = "previousHash")]
    pub previous_hash: Option<String>,
    pub hash: Option<String>,
}

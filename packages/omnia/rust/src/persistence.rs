use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::program::{COUNTER_PROGRAM_ID, ELTOO_PAYMENT_PROGRAM_ID, METER_PROGRAM_ID};
use crate::types::{ChannelStatus, ClosePackageArtifact, OmniaChannel, SignedChannelState};

pub const SNAPSHOT_VERSION: u32 = 1;
const BIGINT_TAG: &str = "__omniaBigInt";
const BYTES_TAG: &str = "__omniaBytes";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OmniaChannelSnapshot {
    pub version: u32,
    #[serde(rename = "savedAt")]
    pub saved_at: u64,
    pub channel: OmniaChannel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelRecoveryResult {
    pub channel: OmniaChannel,
    pub warnings: Vec<String>,
    #[serde(rename = "latestSignedState")]
    pub latest_signed_state: Option<SignedChannelState>,
}

fn now_ms() -> u64 {
    if cfg!(target_arch = "wasm32") {
        js_sys::Date::now() as u64
    } else {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or(0)
    }
}

fn normalize_tags(value: Value) -> Value {
    match value {
        Value::Array(values) => Value::Array(values.into_iter().map(normalize_tags).collect()),
        Value::Object(mut obj) => {
            if obj.len() == 1 {
                if let Some(Value::String(value)) = obj.remove(BIGINT_TAG) {
                    return Value::String(value);
                }
                if let Some(Value::String(value)) = obj.remove(BYTES_TAG) {
                    return Value::String(value);
                }
            }

            Value::Object(
                obj.into_iter()
                    .map(|(key, value)| (key, normalize_tags(value)))
                    .collect(),
            )
        }
        other => other,
    }
}

fn latest_state_sequence(channel: &Map<String, Value>) -> Option<u64> {
    channel
        .get("latestState")?
        .as_object()?
        .get("sequence")?
        .as_u64()
}

fn normalize_channel_value(channel: &mut Value) -> Result<(), String> {
    let Value::Object(obj) = channel else {
        return Err("Invalid Omnia channel snapshot: missing channel".to_string());
    };

    obj.remove("localSigner");
    obj.entry("programId".to_string())
        .or_insert_with(|| Value::String(ELTOO_PAYMENT_PROGRAM_ID.to_string()));
    obj.entry("programVersion".to_string())
        .or_insert_with(|| Value::Number(SNAPSHOT_VERSION.into()));
    obj.entry("tokenScale".to_string())
        .or_insert_with(|| Value::Number(0.into()));
    obj.entry("pendingHTLCs".to_string())
        .or_insert_with(|| Value::Array(vec![]));
    obj.entry("stateLog".to_string())
        .or_insert_with(|| Value::Array(vec![]));

    if !obj.contains_key("currentSequence") {
        let sequence = latest_state_sequence(obj).unwrap_or(0);
        obj.insert(
            "currentSequence".to_string(),
            Value::Number(sequence.into()),
        );
    }

    Ok(())
}

pub fn deserialize_channel_snapshot_value(
    mut value: Value,
) -> Result<OmniaChannelSnapshot, String> {
    value = normalize_tags(value);
    let is_snapshot = value
        .as_object()
        .map(|obj| obj.contains_key("version") && obj.contains_key("channel"))
        .unwrap_or(false);

    let mut snapshot_value = if is_snapshot {
        value
    } else {
        serde_json::json!({
            "version": SNAPSHOT_VERSION,
            "savedAt": now_ms(),
            "channel": value,
        })
    };

    let obj = snapshot_value
        .as_object_mut()
        .ok_or_else(|| "Invalid Omnia channel snapshot: expected object".to_string())?;
    let version = obj
        .get("version")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Unsupported Omnia channel snapshot version: missing".to_string())?;
    if version != SNAPSHOT_VERSION as u64 {
        return Err(format!(
            "Unsupported Omnia channel snapshot version: {}",
            version
        ));
    }

    let channel = obj
        .get_mut("channel")
        .ok_or_else(|| "Invalid Omnia channel snapshot: missing channel".to_string())?;
    normalize_channel_value(channel)?;

    let snapshot: OmniaChannelSnapshot =
        serde_json::from_value(snapshot_value).map_err(|e| e.to_string())?;
    assert_channel_shape(&snapshot.channel)?;
    Ok(snapshot)
}

fn parse_i128(value: &str, label: &str) -> Result<i128, String> {
    value
        .parse::<i128>()
        .map_err(|_| format!("Invalid Omnia channel snapshot: invalid {}", label))
}

fn assert_known_program(channel: &OmniaChannel) -> Result<(), String> {
    if channel.program_version != 1 {
        return Err(format!(
            "Unknown ChannelProgram: {}@{}",
            channel.program_id, channel.program_version
        ));
    }
    match channel.program_id.as_str() {
        ELTOO_PAYMENT_PROGRAM_ID | COUNTER_PROGRAM_ID | METER_PROGRAM_ID => Ok(()),
        _ => Err(format!(
            "Unknown ChannelProgram: {}@{}",
            channel.program_id, channel.program_version
        )),
    }
}

fn assert_artifact_shape(
    name: &str,
    artifact: &ClosePackageArtifact,
    party_ids: &HashSet<&String>,
) -> Result<(), String> {
    if artifact.tx_hex.is_empty() {
        return Err(format!(
            "Invalid Omnia channel snapshot: closePackage {} missing txHex",
            name
        ));
    }
    if artifact.tx_digest.is_empty() {
        return Err(format!(
            "Invalid Omnia channel snapshot: closePackage {} missing txDigest",
            name
        ));
    }
    for party_id in artifact.signatures.keys() {
        if !party_ids.contains(party_id) {
            return Err(format!(
                "Invalid Omnia channel snapshot: closePackage {} signature party '{}' not found in channel parties",
                name, party_id
            ));
        }
    }
    for party_id in artifact.signing_indices.keys() {
        if !party_ids.contains(party_id) {
            return Err(format!(
                "Invalid Omnia channel snapshot: closePackage {} signing index party '{}' not found in channel parties",
                name, party_id
            ));
        }
    }
    Ok(())
}

fn assert_close_package_shape(
    channel: &OmniaChannel,
    state: &SignedChannelState,
) -> Result<(), String> {
    let Some(close_package) = &state.close_package else {
        return Ok(());
    };
    if close_package.version != 1 {
        return Err(format!(
            "Invalid Omnia channel snapshot: unsupported closePackage version {}",
            close_package.version
        ));
    }
    if close_package.channel_id != channel.channel_id {
        return Err("Invalid Omnia channel snapshot: closePackage channelId mismatch".to_string());
    }
    if close_package.sequence != state.sequence {
        return Err("Invalid Omnia channel snapshot: closePackage sequence mismatch".to_string());
    }
    if close_package.state_commitment_v2.is_empty() {
        return Err(
            "Invalid Omnia channel snapshot: closePackage missing stateCommitmentV2".to_string(),
        );
    }

    let party_ids: HashSet<&String> = channel
        .parties
        .iter()
        .map(|party| &party.party_id)
        .collect();
    assert_artifact_shape("update", &close_package.update, &party_ids)?;
    assert_artifact_shape("settlement", &close_package.settlement, &party_ids)?;
    Ok(())
}

pub fn assert_channel_shape(channel: &OmniaChannel) -> Result<(), String> {
    if channel.channel_id.is_empty() {
        return Err("Invalid Omnia channel snapshot: missing channelId".to_string());
    }
    if channel.parties.len() < 2 {
        return Err(
            "Invalid Omnia channel snapshot: expected at least two channel parties".to_string(),
        );
    }
    assert_known_program(channel)?;

    let mut balance_sum = 0i128;
    for balance in channel.balances.values() {
        balance_sum += parse_i128(balance, "balance")?;
    }
    let mut htlc_sum = 0i128;
    for htlc in channel
        .pending_htlcs
        .iter()
        .filter(|htlc| htlc.status == "pending")
    {
        htlc_sum += parse_i128(&htlc.amount, "HTLC amount")?;
    }
    let total_value = parse_i128(&channel.total_value, "totalValue")?;
    if total_value != balance_sum + htlc_sum {
        return Err("Invalid Omnia channel snapshot: balance conservation failed".to_string());
    }

    if let Some(latest_state) = &channel.latest_state {
        if latest_state.sequence > channel.current_sequence {
            return Err(format!(
                "Invalid Omnia channel snapshot: latest state sequence {} exceeds channel sequence {}",
                latest_state.sequence, channel.current_sequence
            ));
        }
        assert_close_package_shape(channel, latest_state)?;
    }
    if let Some(pending_proposal) = &channel.pending_proposal {
        if pending_proposal.sequence < channel.current_sequence {
            return Err(format!(
                "Invalid Omnia channel snapshot: pending proposal sequence {} is behind channel sequence {}",
                pending_proposal.sequence, channel.current_sequence
            ));
        }
    }

    Ok(())
}

pub fn recovery_warnings(channel: &OmniaChannel) -> Vec<String> {
    let mut warnings = vec![];
    if channel.latest_state.is_none() && channel.current_sequence > 0 {
        warnings.push("channel has advanced sequence but no complete latestState; only pendingProposal can prevent retrying a conflicting in-flight update".to_string());
    }
    if channel
        .latest_state
        .as_ref()
        .map(|state| state.close_package.is_none())
        .unwrap_or(false)
    {
        warnings.push(
            "latestState has no signed closePackage; unilateral close recovery is unavailable for this state"
                .to_string(),
        );
    }
    if matches!(
        channel.status,
        ChannelStatus::ClosingUnilateral | ChannelStatus::Disputing
    ) && channel.unilateral_close.is_none()
    {
        let status = match channel.status {
            ChannelStatus::ClosingUnilateral => "closing_unilateral",
            ChannelStatus::Disputing => "disputing",
            _ => unreachable!(),
        };
        warnings.push(format!(
            "channel status is {} but unilateralClose state is missing",
            status
        ));
    }
    warnings
}

pub fn snapshot_channel(channel: &OmniaChannel, saved_at: u64) -> OmniaChannelSnapshot {
    OmniaChannelSnapshot {
        version: SNAPSHOT_VERSION,
        saved_at,
        channel: channel.clone(),
    }
}

pub fn serialize_channel_snapshot(snapshot: &OmniaChannelSnapshot) -> Result<String, String> {
    serde_json::to_string(snapshot).map_err(|e| e.to_string())
}

pub fn deserialize_channel_snapshot(json: &str) -> Result<OmniaChannelSnapshot, String> {
    let value: Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
    deserialize_channel_snapshot_value(value)
}

pub fn recover_channel_snapshot_from_json(json: &str) -> Result<ChannelRecoveryResult, String> {
    recover_channel_snapshot(deserialize_channel_snapshot(json)?)
}

pub fn recover_channel_snapshot(
    snapshot: OmniaChannelSnapshot,
) -> Result<ChannelRecoveryResult, String> {
    if snapshot.version != SNAPSHOT_VERSION {
        return Err(format!(
            "Unsupported Omnia channel snapshot version: {}",
            snapshot.version
        ));
    }
    assert_channel_shape(&snapshot.channel)?;
    Ok(ChannelRecoveryResult {
        latest_signed_state: snapshot.channel.latest_state.clone(),
        warnings: recovery_warnings(&snapshot.channel),
        channel: snapshot.channel,
    })
}

pub fn recover_channel(json_or_snapshot: &str) -> Result<OmniaChannel, String> {
    recover_channel_snapshot_from_json(json_or_snapshot).map(|result| result.channel)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn snapshot_value() -> Value {
        json!({
            "version": 1,
            "savedAt": 1234,
            "channel": {
                "channelId": "0xabc",
                "fundingTxId": "0xfunding",
                "fundingCoinId": "0xcoin",
                "fundingScript": "RETURN TRUE",
                "programId": "counter",
                "programVersion": 1,
                "fundingAddress": "0xaddress",
                "tokenId": "0x00",
                "tokenScale": 0,
                "totalValue": { "__omniaBigInt": "1000" },
                "parties": [
                    { "partyId": "alice", "publicKeyDigest": "0xaaaa", "addressIndex": 0 },
                    { "partyId": "bob", "publicKeyDigest": "0xbbbb", "addressIndex": 1 }
                ],
                "balances": {
                    "alice": { "__omniaBigInt": "600" },
                    "bob": { "__omniaBigInt": "400" }
                },
                "pendingHTLCs": [],
                "currentSequence": 7,
                "latestState": {
                    "sequence": 7,
                    "balances": { "alice": { "__omniaBigInt": "600" }, "bob": { "__omniaBigInt": "400" } },
                    "pendingHTLCs": [],
                    "stateVariables": [
                        { "port": 120, "value": { "__omniaBigInt": "42" }, "type": "number" }
                    ],
                    "transactionHex": "0xupdate",
                    "signatures": { "alice": { "__omniaBytes": "0102" }, "bob": { "__omniaBytes": "0304" } },
                    "signingIndices": {
                        "alice": { "addressIndex": 0, "l1": 7, "l2": 0 },
                        "bob": { "addressIndex": 1, "l1": 7, "l2": 0 }
                    },
                    "closePackage": {
                        "version": 1,
                        "channelId": "0xabc",
                        "sequence": 7,
                        "stateCommitmentV2": "0xcommitment",
                        "update": {
                            "txHex": "0xupdate",
                            "txDigest": "0xupdatedigest",
                            "signatures": { "alice": { "__omniaBytes": "0102" } },
                            "signingIndices": { "alice": { "addressIndex": 0, "l1": 7, "l2": 0 } }
                        },
                        "settlement": {
                            "txHex": "0xsettlement",
                            "txDigest": "0xsettlementdigest",
                            "signatures": { "bob": { "__omniaBytes": "0304" } },
                            "signingIndices": { "bob": { "addressIndex": 1, "l1": 7, "l2": 0 } }
                        }
                    }
                },
                "stateLog": [],
                "status": "active",
                "channelType": "direct",
                "pendingProposal": { "sequence": 8, "payloadHash": "0xpayload" },
                "createdAt": 1000,
                "updatedAt": 2000
            }
        })
    }

    #[test]
    fn deserializes_typescript_tagged_snapshot() {
        let json = serde_json::to_string(&snapshot_value()).unwrap();
        let snapshot = deserialize_channel_snapshot(&json).unwrap();
        assert_eq!(snapshot.version, 1);
        assert_eq!(snapshot.channel.total_value, "1000");
        assert_eq!(snapshot.channel.balances["alice"], "600");
        let latest = snapshot.channel.latest_state.as_ref().unwrap();
        assert_eq!(latest.signatures["alice"], "0102");
        assert_eq!(latest.state_variables[0].value, json!("42"));
    }

    #[test]
    fn recovers_snapshot_with_warnings() {
        let mut value = snapshot_value();
        value["channel"]["latestState"] = Value::Null;
        value["channel"]["status"] = json!("closing_unilateral");
        let json = serde_json::to_string(&value).unwrap();

        let result = recover_channel_snapshot_from_json(&json).unwrap();
        assert_eq!(result.channel.channel_id, "0xabc");
        assert_eq!(result.warnings.len(), 2);
        assert!(result.latest_signed_state.is_none());
    }

    #[test]
    fn recovers_legacy_raw_channel_with_defaults() {
        let mut raw = snapshot_value()["channel"].clone();
        raw.as_object_mut().unwrap().remove("programId");
        raw.as_object_mut().unwrap().remove("programVersion");
        raw.as_object_mut().unwrap().remove("tokenScale");
        raw.as_object_mut().unwrap().remove("pendingHTLCs");
        raw.as_object_mut().unwrap().remove("stateLog");
        raw.as_object_mut().unwrap().remove("currentSequence");

        let json = serde_json::to_string(&raw).unwrap();
        let snapshot = deserialize_channel_snapshot(&json).unwrap();
        assert_eq!(snapshot.channel.program_id, ELTOO_PAYMENT_PROGRAM_ID);
        assert_eq!(snapshot.channel.program_version, 1);
        assert_eq!(snapshot.channel.token_scale, 0);
        assert_eq!(snapshot.channel.current_sequence, 7);
    }

    #[test]
    fn rejects_invalid_balance_conservation() {
        let mut value = snapshot_value();
        value["channel"]["balances"]["bob"] = json!({ "__omniaBigInt": "399" });
        let json = serde_json::to_string(&value).unwrap();

        assert_eq!(
            deserialize_channel_snapshot(&json).unwrap_err(),
            "Invalid Omnia channel snapshot: balance conservation failed"
        );
    }

    #[test]
    fn rejects_pending_proposal_behind_current_sequence() {
        let mut value = snapshot_value();
        value["channel"]["pendingProposal"]["sequence"] = json!(6);
        let json = serde_json::to_string(&value).unwrap();

        assert_eq!(
            deserialize_channel_snapshot(&json).unwrap_err(),
            "Invalid Omnia channel snapshot: pending proposal sequence 6 is behind channel sequence 7"
        );
    }

    #[test]
    fn rejects_invalid_close_package_shape() {
        let mut value = snapshot_value();
        value["channel"]["latestState"]["closePackage"]["settlement"]["txDigest"] = json!("");
        let json = serde_json::to_string(&value).unwrap();

        assert_eq!(
            deserialize_channel_snapshot(&json).unwrap_err(),
            "Invalid Omnia channel snapshot: closePackage settlement missing txDigest"
        );
    }

    #[test]
    fn rejects_close_package_sequence_mismatch() {
        let mut value = snapshot_value();
        value["channel"]["latestState"]["closePackage"]["sequence"] = json!(6);
        let json = serde_json::to_string(&value).unwrap();

        assert_eq!(
            deserialize_channel_snapshot(&json).unwrap_err(),
            "Invalid Omnia channel snapshot: closePackage sequence mismatch"
        );
    }
}

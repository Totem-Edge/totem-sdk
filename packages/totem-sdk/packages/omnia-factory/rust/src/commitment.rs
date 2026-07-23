use sha3::{Digest, Sha3_256};
use std::collections::HashMap;

pub fn compute_factory_state_commitment(
    factory_id: &str,
    sequence: u32,
    pending_allocations: &HashMap<String, String>,
    virtual_channel_ids: &[String],
) -> Vec<u8> {
    let mut sorted_allocations: Vec<(&String, &String)> = pending_allocations.iter().collect();
    sorted_allocations.sort_by(|a, b| a.0.cmp(b.0));
    let alloc_map: HashMap<&str, &str> = sorted_allocations.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();

    let mut sorted_vc_ids = virtual_channel_ids.to_vec();
    sorted_vc_ids.sort();

    let canonical = serde_json::json!({
        "factoryId": factory_id,
        "sequence": sequence,
        "allocations": alloc_map,
        "virtualChannelIds": sorted_vc_ids,
    });

    let input = serde_json::to_string(&canonical).unwrap_or_default();
    let mut hasher = Sha3_256::new();
    hasher.update(input.as_bytes());
    hasher.finalize().to_vec()
}

pub fn enforce_conservation(
    total_value: &str,
    allocations: &HashMap<String, String>,
    virtual_channel_total: &str,
) -> Result<(), String> {
    let tv: u128 = total_value.parse().map_err(|_| "invalid totalValue".to_string())?;
    let alloc_sum: u128 = allocations.values().filter_map(|v| v.parse::<u128>().ok()).sum();
    let vc_sum: u128 = virtual_channel_total.parse().unwrap_or(0);

    if alloc_sum + vc_sum != tv {
        return Err(format!(
            "Balance conservation violated: allocations({}) + virtualChannels({}) != totalValue({})",
            alloc_sum, vc_sum, tv
        ));
    }
    Ok(())
}

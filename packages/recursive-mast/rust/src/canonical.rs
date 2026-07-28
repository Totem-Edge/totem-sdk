use sha3::{Digest, Sha3_256};
use std::collections::HashMap;

pub const CANONICAL_ENCODING_VERSION: u16 = 1;

fn encode_version(version: u16) -> [u8; 2] {
    [(version >> 8) as u8, version as u8]
}

fn encode_domain(domain: &str) -> Vec<u8> {
    domain.as_bytes().to_vec()
}

fn deep_sort_keys(value: &serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Array(arr) => {
            serde_json::Value::Array(arr.iter().map(deep_sort_keys).collect())
        }
        serde_json::Value::Object(obj) => {
            let mut keys: Vec<&String> = obj.keys().collect();
            keys.sort();
            let mut sorted = serde_json::Map::new();
            for key in keys {
                if let Some(val) = obj.get(key) {
                    if !val.is_null() {
                        sorted.insert(key.clone(), deep_sort_keys(val));
                    }
                }
            }
            serde_json::Value::Object(sorted)
        }
        other => other.clone(),
    }
}

pub fn canonical_serialize(
    domain: &str,
    payload: &HashMap<String, serde_json::Value>,
    version: u16,
) -> Vec<u8> {
    let sorted = deep_sort_keys(&serde_json::Value::Object(
        payload.iter().map(|(k, v)| (k.clone(), v.clone())).collect(),
    ));
    let json = serde_json::to_string(&sorted).unwrap_or_default();
    let json_bytes = json.as_bytes();

    let version_bytes = encode_version(version);
    let domain_bytes = encode_domain(domain);

    let mut result = Vec::with_capacity(2 + domain_bytes.len() + json_bytes.len());
    result.extend_from_slice(&version_bytes);
    result.extend_from_slice(&domain_bytes);
    result.extend_from_slice(json_bytes);
    result
}

pub fn canonical_hash(
    domain: &str,
    payload: &HashMap<String, serde_json::Value>,
    version: u16,
) -> String {
    let serialized = canonical_serialize(domain, payload, version);
    let mut hasher = Sha3_256::new();
    hasher.update(&serialized);
    hex::encode(hasher.finalize())
}

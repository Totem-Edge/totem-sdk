use sha3::{Digest, Sha3_256};

use crate::canonical::to_hex;

pub fn compute_manifest_id(manifest: &serde_json::Value) -> Result<String, String> {
    let manifest_type = manifest["type"].as_str().unwrap_or("");
    let stable_key = match manifest_type {
        "app" => {
            let author = manifest["authorAddress"].as_str().unwrap_or("");
            let pear = manifest["pearTopicKey"].as_str().unwrap_or("");
            format!("app\0{}\0{}", author, pear)
        }
        "capability" => {
            let agent = manifest["agentAddress"].as_str().unwrap_or("");
            let name = manifest["capabilityName"].as_str().unwrap_or("");
            format!("capability\0{}\0{}", agent, name)
        }
        "dapp" => {
            let author = manifest["authorAddress"].as_str().unwrap_or("");
            let hash = manifest["contractHash"].as_str().unwrap_or("");
            format!("dapp\0{}\0{}", author, hash)
        }
        "edge-service" => {
            let operator = manifest["operatorAddress"].as_str().unwrap_or("");
            let svc_type = manifest["serviceType"].as_str().unwrap_or("");
            let name = manifest["name"].as_str().unwrap_or("");
            format!("edge-service\0{}\0{}\0{}", operator, svc_type, name)
        }
        other => return Err(format!("unknown manifest type: {}", other)),
    };

    let mut hasher = Sha3_256::new();
    hasher.update(stable_key.as_bytes());
    Ok(to_hex(&hasher.finalize()))
}

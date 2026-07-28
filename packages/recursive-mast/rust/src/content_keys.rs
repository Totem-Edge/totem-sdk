use sha3::{Digest, Sha3_256};

use crate::types::ContentKey;

pub const KEY_PREFIX_POLICY_MANIFEST: &str = "policy";
pub const KEY_PREFIX_MANIFEST_DIGEST: &str = "manifest";
pub const KEY_PREFIX_SCRIPT: &str = "script";
pub const KEY_PREFIX_PROOF: &str = "proof";
pub const KEY_PREFIX_BUNDLE: &str = "bundle";

pub fn policy_manifest_key(policy_id: &str, version: u32) -> ContentKey {
    let parts = vec![
        KEY_PREFIX_POLICY_MANIFEST.to_string(),
        policy_id.to_string(),
        "manifest".to_string(),
        version.to_string(),
    ];
    ContentKey {
        prefix: KEY_PREFIX_POLICY_MANIFEST.to_string(),
        key: parts.join(":"),
        parts,
    }
}

pub fn manifest_digest_key(digest: &str) -> ContentKey {
    let parts = vec![
        KEY_PREFIX_MANIFEST_DIGEST.to_string(),
        digest.to_string(),
    ];
    ContentKey {
        prefix: KEY_PREFIX_MANIFEST_DIGEST.to_string(),
        key: parts.join(":"),
        parts,
    }
}

pub fn script_key(script_hash: &str) -> ContentKey {
    let parts = vec![KEY_PREFIX_SCRIPT.to_string(), script_hash.to_string()];
    ContentKey {
        prefix: KEY_PREFIX_SCRIPT.to_string(),
        key: parts.join(":"),
        parts,
    }
}

pub fn proof_key(policy_root: &str, script_hash: &str) -> ContentKey {
    let parts = vec![
        KEY_PREFIX_PROOF.to_string(),
        policy_root.to_string(),
        script_hash.to_string(),
    ];
    ContentKey {
        prefix: KEY_PREFIX_PROOF.to_string(),
        key: parts.join(":"),
        parts,
    }
}

pub fn bundle_key(bundle_hash: &str) -> ContentKey {
    let parts = vec![KEY_PREFIX_BUNDLE.to_string(), bundle_hash.to_string()];
    ContentKey {
        prefix: KEY_PREFIX_BUNDLE.to_string(),
        key: parts.join(":"),
        parts,
    }
}

pub fn parse_content_key(key: &str) -> Option<ContentKey> {
    let parts: Vec<String> = key.split(':').map(|s| s.to_string()).collect();
    if parts.len() < 2 {
        return None;
    }
    let valid_prefixes = [
        KEY_PREFIX_POLICY_MANIFEST,
        KEY_PREFIX_MANIFEST_DIGEST,
        KEY_PREFIX_SCRIPT,
        KEY_PREFIX_PROOF,
        KEY_PREFIX_BUNDLE,
    ];
    if !valid_prefixes.contains(&parts[0].as_str()) {
        return None;
    }
    Some(ContentKey {
        prefix: parts[0].clone(),
        key: key.to_string(),
        parts,
    })
}

pub fn compute_manifest_digest(manifest_bytes: &[u8]) -> String {
    let mut hasher = Sha3_256::new();
    hasher.update(manifest_bytes);
    hex::encode(hasher.finalize())
}

pub fn compute_bundle_hash(manifest: &[u8], branches: &[Vec<u8>]) -> String {
    let total_len: usize = manifest.len() + branches.iter().map(|b| b.len()).sum::<usize>();
    let mut combined = Vec::with_capacity(total_len);
    combined.extend_from_slice(manifest);
    for branch in branches {
        combined.extend_from_slice(branch);
    }
    let mut hasher = Sha3_256::new();
    hasher.update(&combined);
    hex::encode(hasher.finalize())
}

pub fn compute_script_hash(script: &str) -> String {
    let mut hasher = Sha3_256::new();
    hasher.update(script.as_bytes());
    hex::encode(hasher.finalize())
}

use sha3::{Digest, Sha3_256};

pub fn sha3_hex(data: &[u8]) -> String {
    let mut hasher = Sha3_256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

pub fn hash_pair(left: &[u8], right: &[u8]) -> Vec<u8> {
    let mut hasher = Sha3_256::new();
    if left <= right {
        hasher.update(left);
        hasher.update(right);
    } else {
        hasher.update(right);
        hasher.update(left);
    }
    hasher.finalize().to_vec()
}

pub fn compute_vtxo_leaf(
    pool_id: &str,
    owner: &str,
    amount: &str,
    token_id: &str,
    nonce: &str,
    epoch: u64,
) -> Vec<u8> {
    let input = format!("{}:{}:{}:{}:{}:{}", pool_id, owner, amount, token_id, nonce, epoch);
    let mut hasher = Sha3_256::new();
    hasher.update(input.as_bytes());
    hasher.finalize().to_vec()
}

pub fn compute_vtxo_id(pool_id: &str, owner: &str, amount: &str, token_id: &str, nonce: &str) -> String {
    let input = format!("{}:{}:{}:{}:{}", pool_id, owner, amount, token_id, nonce);
    sha3_hex(input.as_bytes())
}

pub fn compute_pool_id(operator: &str, token_id: &str, nonce: &str) -> String {
    let input = format!("{}:{}:{}", operator, token_id, nonce);
    sha3_hex(input.as_bytes())
}

pub fn compute_commitment_root(leaves: &[Vec<u8>]) -> String {
    if leaves.is_empty() {
        return "0000000000000000000000000000000000000000000000000000000000000000".to_string();
    }

    let mut padded = leaves.to_vec();
    let target = padded.len().next_power_of_two();
    let empty = vec![0u8; 32];
    while padded.len() < target {
        padded.push(empty.clone());
    }

    let mut level = padded;
    while level.len() > 1 {
        let mut next = Vec::with_capacity(level.len() / 2);
        for i in (0..level.len()).step_by(2) {
            next.push(hash_pair(&level[i], &level[i + 1]));
        }
        level = next;
    }
    hex::encode(&level[0])
}

pub fn verify_merkle_proof(leaf: &[u8], proof: &[Vec<u8>], root: &str, leaf_index: usize) -> bool {
    let mut current = leaf.to_vec();
    let mut idx = leaf_index;

    for sibling in proof {
        let (left, right) = if idx % 2 == 0 {
            (&current, sibling)
        } else {
            (sibling, &current)
        };
        current = hash_pair(left, right);
        idx /= 2;
    }

    hex::encode(&current) == root
}

pub fn compute_receipt_id(pool_id: &str, vtxo_id: &str, operation: &str, timestamp: u64) -> String {
    let input = format!("{}:{}:{}:{}", pool_id, vtxo_id, operation, timestamp);
    sha3_hex(input.as_bytes())
}

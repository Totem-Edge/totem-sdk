/// TreeKey/TreeKeyNode implementation matching Minima's TreeKey.java and TreeKeyNode.java.
///
/// Hierarchical key tree structure:
/// - Each TreeKeyNode contains 64 Winternitz keys
/// - The node's PUBLIC KEY = MMR root of all 64 Winternitz public key DIGESTS
/// - Signatures include the Winternitz leaf pubkey digest + signature + MMR proof
///
/// Default structure: 3 levels × 64 keys = 64^3 = 262,144 one-time signatures

use std::collections::HashMap;
use std::cell::RefCell;
use sha3::{Digest, Sha3_256};
use crate::wots;
use crate::java_streamables;
use crate::mmr::{MMRTree, MMRProof, create_mmr_data_leaf_node, calculate_proof_root};

fn sha3(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha3_256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

pub const DEFAULT_KEYS_PER_LEVEL: usize = 64;
pub const DEFAULT_LEVELS: usize = 3;

// ---------------------------------------------------------------------------
// SignatureProof — matches Minima's SignatureProof.java
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SignatureProof {
    #[serde(rename = "leafPubkey")]
    pub leaf_pubkey: Vec<u8>,
    pub signature: Vec<u8>,
    #[serde(rename = "mmrProof")]
    pub mmr_proof: MMRProof,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TreeSignature {
    pub proofs: Vec<SignatureProof>,
}

pub fn get_root_public_key(proof: &SignatureProof) -> Vec<u8> {
    let leaf_data = create_mmr_data_leaf_node(&proof.leaf_pubkey, 0);
    calculate_proof_root(&leaf_data, &proof.mmr_proof)
}

// ---------------------------------------------------------------------------
// TreeKeyNode
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub struct TreeKeyNode {
    seed: Vec<u8>,
    child_seed: Vec<u8>,
    keys_per_level: usize,
    public_key_digests: Vec<Vec<u8>>,
    mmr_tree: MMRTree,
    root_pubkey: Vec<u8>,
    child_cache: RefCell<HashMap<usize, Box<TreeKeyNode>>>,
}

impl Clone for TreeKeyNode {
    fn clone(&self) -> Self {
        TreeKeyNode {
            seed: self.seed.clone(),
            child_seed: self.child_seed.clone(),
            keys_per_level: self.keys_per_level,
            public_key_digests: self.public_key_digests.clone(),
            mmr_tree: MMRTree::from_public_keys(&self.public_key_digests),
            root_pubkey: self.root_pubkey.clone(),
            child_cache: RefCell::new(HashMap::new()),
        }
    }
}

impl TreeKeyNode {
    pub fn new(private_seed: &[u8], keys_per_level: usize) -> Result<Self, String> {
        if private_seed.len() != 32 {
            return Err("Private seed must be 32 bytes".to_string());
        }

        let child_seed = sha3(private_seed);

        let mut public_key_digests = Vec::with_capacity(keys_per_level);
        for i in 0..keys_per_level {
            let pk_digest = wots::derive_pk_digest(private_seed, i as u32);
            public_key_digests.push(pk_digest);
        }

        let mmr_tree = MMRTree::from_public_keys(&public_key_digests);
        let root = mmr_tree.get_root().ok_or("Failed to compute MMR root")?;
        let root_pubkey = root.data;

        Ok(TreeKeyNode {
            seed: private_seed.to_vec(),
            child_seed,
            keys_per_level,
            public_key_digests,
            mmr_tree,
            root_pubkey,
            child_cache: RefCell::new(HashMap::new()),
        })
    }

    pub fn get_public_key(&self) -> &[u8] {
        &self.root_pubkey
    }

    pub fn get_wots_public_key_digest(&self, index: usize) -> Result<&[u8], String> {
        if index >= self.keys_per_level {
            return Err(format!("Key index {} out of range [0, {})", index, self.keys_per_level));
        }
        Ok(&self.public_key_digests[index])
    }

    pub fn get_proof(&self, key_index: usize) -> Result<MMRProof, String> {
        if key_index >= self.keys_per_level {
            return Err(format!("Key index {} out of range [0, {})", key_index, self.keys_per_level));
        }
        Ok(self.mmr_tree.get_proof(key_index as u32))
    }

    pub fn sign(&self, key_index: usize, data: &[u8]) -> Result<SignatureProof, String> {
        if key_index >= self.keys_per_level {
            return Err(format!("Key index {} out of range [0, {})", key_index, self.keys_per_level));
        }

        let leaf_pubkey = self.public_key_digests[key_index].clone();
        let signature = wots::wots_sign(&self.seed, key_index as u32, data);
        let mmr_proof = self.get_proof(key_index)?;

        Ok(SignatureProof { leaf_pubkey, signature, mmr_proof })
    }

    pub fn get_child(&self, child_index: usize) -> Result<Box<TreeKeyNode>, String> {
        if child_index >= self.keys_per_level {
            return Err(format!("Child index {} out of range [0, {})", child_index, self.keys_per_level));
        }

        {
            let cache = self.child_cache.borrow();
            if let Some(child) = cache.get(&child_index) {
                return Ok(child.clone());
            }
        }

        let child_seed = java_streamables::derive_chain_seed_java(&self.child_seed, child_index as u32);
        let child = TreeKeyNode::new(&child_seed, self.keys_per_level)?;
        let boxed = Box::new(child);
        self.child_cache.borrow_mut().insert(child_index, boxed.clone());
        Ok(boxed)
    }
}

// ---------------------------------------------------------------------------
// TreeKey
// ---------------------------------------------------------------------------

pub struct TreeKey {
    levels: usize,
    keys_per_level: usize,
    root: TreeKeyNode,
    public_key: Vec<u8>,
    uses: u64,
    parent_child_sig_cache: HashMap<String, SignatureProof>,
}

impl TreeKey {
    pub fn new(private_seed: &[u8], keys_per_level: usize, levels: usize) -> Result<Self, String> {
        if private_seed.len() != 32 {
            return Err("Private seed must be 32 bytes".to_string());
        }

        let root = TreeKeyNode::new(private_seed, keys_per_level)?;
        let public_key = root.get_public_key().to_vec();

        Ok(TreeKey {
            levels,
            keys_per_level,
            root,
            public_key,
            uses: 0,
            parent_child_sig_cache: HashMap::new(),
        })
    }

    pub fn get_public_key(&self) -> &[u8] { &self.public_key }
    pub fn get_max_uses(&self) -> u64 { (self.keys_per_level as u64).pow(self.levels as u32) }
    pub fn get_uses(&self) -> u64 { self.uses }
    pub fn set_uses(&mut self, uses: u64) { self.uses = uses; }

    pub fn has_parent_child_sig(&self, path: &[usize]) -> bool {
        let key = path.iter().map(|i| i.to_string()).collect::<Vec<_>>().join(",");
        self.parent_child_sig_cache.contains_key(&key)
    }

    pub fn get_parent_child_sig(&self, path: &[usize]) -> Option<&SignatureProof> {
        let key = path.iter().map(|i| i.to_string()).collect::<Vec<_>>().join(",");
        self.parent_child_sig_cache.get(&key)
    }

    pub fn set_parent_child_sig(&mut self, path: &[usize], sig: SignatureProof) {
        let key = path.iter().map(|i| i.to_string()).collect::<Vec<_>>().join(",");
        self.parent_child_sig_cache.insert(key, sig);
    }

    pub fn get_cached_signatures(&self) -> &HashMap<String, SignatureProof> {
        &self.parent_child_sig_cache
    }

    pub fn restore_cached_signatures(&mut self, cache: HashMap<String, SignatureProof>) {
        self.parent_child_sig_cache = cache;
    }

    fn base_conversion(&self, num: u64) -> Vec<usize> {
        let mut result = Vec::new();
        let mut counter = num;
        let kp = self.keys_per_level as u64;

        while counter != 0 {
            let div = counter / kp;
            let remain = counter - (div * kp);
            result.push(remain as usize);
            counter = div;
        }

        while result.len() < self.levels {
            result.push(0);
        }

        result.reverse();
        result
    }

    fn navigate_to_node(&self, path: &[usize], depth: usize) -> Result<TreeKeyNode, String> {
        if depth == 0 {
            return Ok(self.root.clone());
        }
        let mut current = self.root.get_child(path[0])?;
        for i in 1..depth {
            current = current.get_child(path[i])?;
        }
        Ok(*current)
    }

    pub fn sign(&mut self, data: &[u8]) -> Result<TreeSignature, String> {
        if self.uses >= self.get_max_uses() {
            return Err("No more keys available (tree exhausted)".to_string());
        }

        let path = self.base_conversion(self.uses);
        let mut proofs: Vec<Option<SignatureProof>> = vec![None; self.levels];

        let leaf_depth = self.levels - 1;
        let leaf_node = self.navigate_to_node(&path, leaf_depth)?;
        let leaf_key_index = path[leaf_depth];
        let leaf_proof = leaf_node.sign(leaf_key_index, data)?;
        proofs[leaf_depth] = Some(leaf_proof);

        for depth in (0..self.levels - 1).rev() {
            let parent_node = self.navigate_to_node(&path, depth)?;
            let key_index = path[depth];
            let child_proof = proofs[depth + 1].as_ref().unwrap();
            let child_root = get_root_public_key(child_proof);

            let cache_path: Vec<usize> = path[..=depth + 1].to_vec();
            let sig_proof = if let Some(cached) = self.get_parent_child_sig(&cache_path) {
                cached.clone()
            } else {
                let sig = parent_node.sign(key_index, &child_root)?;
                self.set_parent_child_sig(&cache_path, sig.clone());
                sig
            };

            proofs[depth] = Some(sig_proof);
        }

        self.uses += 1;

        Ok(TreeSignature {
            proofs: proofs.into_iter().map(|p| p.unwrap()).collect(),
        })
    }

    pub fn get_address_public_key(&self, l1: usize) -> Result<Vec<u8>, String> {
        let level1_node = self.root.get_child(l1)?;
        Ok(level1_node.get_public_key().to_vec())
    }

    pub fn get_signing_node_public_key(&self, l1: usize, l2: usize) -> Result<Vec<u8>, String> {
        let level1_node = self.root.get_child(l1)?;
        let level2_node = level1_node.get_child(l2)?;
        Ok(level2_node.get_public_key().to_vec())
    }
}

// ---------------------------------------------------------------------------
// Tree signature verification
// ---------------------------------------------------------------------------

pub fn verify_tree_signature(
    expected_pubkey: &[u8],
    data: &[u8],
    signature: &TreeSignature,
) -> bool {
    let proofs = &signature.proofs;
    if proofs.is_empty() {
        return false;
    }

    for depth in 0..proofs.len() {
        let proof = &proofs[depth];
        let root_pubkey = get_root_public_key(proof);

        if depth == 0 {
            if !crate::verify::timing_safe_equal(&root_pubkey, expected_pubkey) {
                return false;
            }
        }

        let signed_data = if depth == proofs.len() - 1 {
            data.to_vec()
        } else {
            get_root_public_key(&proofs[depth + 1])
        };

        if !wots::wots_verify_digest(&proof.signature, &signed_data, &proof.leaf_pubkey) {
            return false;
        }
    }

    true
}

// ---------------------------------------------------------------------------
// Unified TreeKey factory functions
// ---------------------------------------------------------------------------

pub fn create_unified_child_tree_key(base_seed: &[u8], index: u32) -> Result<TreeKey, String> {
    let child_seed = java_streamables::derive_unified_child_seed(base_seed, 0, index);
    TreeKey::new(&child_seed, 64, 3)
}

pub fn create_unified_root_tree_key(base_seed: &[u8]) -> Result<TreeKey, String> {
    let root_priv_seed = java_streamables::derive_root_priv_seed(base_seed);
    TreeKey::new(&root_priv_seed, 64, 3)
}

pub fn derive_unified_address_public_key(base_seed: &[u8], index: u32) -> Result<Vec<u8>, String> {
    let tree_key = create_unified_child_tree_key(base_seed, index)?;
    Ok(tree_key.get_public_key().to_vec())
}

pub fn create_per_address_tree_key(base_seed: &[u8], address_index: u32) -> Result<TreeKey, String> {
    let per_address_seed = java_streamables::derive_per_address_seed(base_seed, address_index);
    TreeKey::new(&per_address_seed, 64, 3)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::params::WOTS_L;

    #[test]
    fn test_tree_key_node_creation() {
        let seed = [42u8; 32];
        let node = TreeKeyNode::new(&seed, 64).unwrap();
        assert_eq!(node.get_public_key().len(), 32);
    }

    #[test]
    fn test_tree_key_node_sign() {
        let seed = [42u8; 32];
        let node = TreeKeyNode::new(&seed, 64).unwrap();
        let data = [99u8; 32];
        let proof = node.sign(0, &data).unwrap();
        assert_eq!(proof.leaf_pubkey.len(), 32);
        assert_eq!(proof.signature.len(), WOTS_L * 32);
        assert!(!proof.mmr_proof.chunks.is_empty());
    }

    #[test]
    fn test_tree_key_creation() {
        let seed = [42u8; 32];
        let tree = TreeKey::new(&seed, 64, 3).unwrap();
        assert_eq!(tree.get_max_uses(), 262144);
        assert_eq!(tree.get_uses(), 0);
    }

    #[test]
    fn test_tree_key_sign_and_verify() {
        let seed = [42u8; 32];
        // Use small tree for fast tests: 4 keys × 2 levels = 16 signatures
        let mut tree = TreeKey::new(&seed, 4, 2).unwrap();
        let pubkey = tree.get_public_key().to_vec();
        let data = [99u8; 32];

        let sig = tree.sign(&data).unwrap();
        assert_eq!(sig.proofs.len(), 2);
        assert_eq!(tree.get_uses(), 1);

        assert!(verify_tree_signature(&pubkey, &data, &sig));
    }

    #[test]
    fn test_tree_key_sign_wrong_data_fails_verification() {
        let seed = [42u8; 32];
        let mut tree = TreeKey::new(&seed, 4, 2).unwrap();
        let pubkey = tree.get_public_key().to_vec();
        let data = [99u8; 32];
        let wrong_data = [100u8; 32];

        let sig = tree.sign(&data).unwrap();
        assert!(!verify_tree_signature(&pubkey, &wrong_data, &sig));
    }

    #[test]
    fn test_tree_key_multiple_signs() {
        let seed = [42u8; 32];
        let mut tree = TreeKey::new(&seed, 4, 2).unwrap();
        let pubkey = tree.get_public_key().to_vec();

        for i in 0..3 {
            let data = [i as u8; 32];
            let sig = tree.sign(&data).unwrap();
            assert!(verify_tree_signature(&pubkey, &data, &sig));
        }
        assert_eq!(tree.get_uses(), 3);
    }

    #[test]
    fn test_tree_key_exhaustion() {
        let seed = [42u8; 32];
        let mut tree = TreeKey::new(&seed, 2, 2).unwrap();
        assert_eq!(tree.get_max_uses(), 4);

        for i in 0..4 {
            tree.sign(&[i as u8; 32]).unwrap();
        }
        assert!(tree.sign(&[99u8; 32]).is_err());
    }

    #[test]
    fn test_base_conversion() {
        let seed = [42u8; 32];
        let tree = TreeKey::new(&seed, 64, 3).unwrap();

        assert_eq!(tree.base_conversion(0), vec![0, 0, 0]);
        assert_eq!(tree.base_conversion(1), vec![0, 0, 1]);
        assert_eq!(tree.base_conversion(63), vec![0, 0, 63]);
        assert_eq!(tree.base_conversion(64), vec![0, 1, 0]);
        assert_eq!(tree.base_conversion(4095), vec![0, 63, 63]);
        assert_eq!(tree.base_conversion(4096), vec![1, 0, 0]);
    }

    #[test]
    fn test_parent_child_sig_cache() {
        let seed = [42u8; 32];
        let mut tree = TreeKey::new(&seed, 4, 2).unwrap();
        let data = [99u8; 32];

        let sig1 = tree.sign(&data).unwrap();
        assert_eq!(tree.get_uses(), 1);

        let sig2 = tree.sign(&data).unwrap();
        assert_eq!(tree.get_uses(), 2);

        let pubkey = tree.get_public_key().to_vec();
        assert!(verify_tree_signature(&pubkey, &data, &sig1));
        assert!(verify_tree_signature(&pubkey, &data, &sig2));
    }

    #[test]
    fn test_unified_child_tree_key() {
        let base_seed = [42u8; 32];
        // Use small tree for fast tests
        let child_seed = java_streamables::derive_unified_child_seed(&base_seed, 0, 0);
        let tree = TreeKey::new(&child_seed, 4, 2).unwrap();
        assert_eq!(tree.get_max_uses(), 16);
    }

    #[test]
    fn test_unified_root_tree_key() {
        let base_seed = [42u8; 32];
        let root_priv_seed = java_streamables::derive_root_priv_seed(&base_seed);
        let tree = TreeKey::new(&root_priv_seed, 4, 2).unwrap();
        assert_eq!(tree.get_max_uses(), 16);
    }

    #[test]
    fn test_different_addresses_different_keys() {
        let base_seed = [42u8; 32];
        let child_seed0 = java_streamables::derive_unified_child_seed(&base_seed, 0, 0);
        let child_seed1 = java_streamables::derive_unified_child_seed(&base_seed, 0, 1);
        let tree0 = TreeKey::new(&child_seed0, 4, 2).unwrap();
        let tree1 = TreeKey::new(&child_seed1, 4, 2).unwrap();
        assert_ne!(tree0.get_public_key(), tree1.get_public_key());
    }
}

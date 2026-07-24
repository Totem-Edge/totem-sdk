/// Stateful TreeKey held in WASM linear memory.
///
/// Instead of serializing/deserializing the tree for every operation,
/// this keeps the TreeKey alive in WASM and exposes operations as
/// single calls. Eliminates the JS↔WASM boundary crossings for
/// multi-step operations like sign (which needs 3 WOTS signs + 3 MMR proofs).

use crate::treekey::{TreeKey, SignatureProof};

pub struct WasmTreeKey {
    tree: TreeKey,
}

impl WasmTreeKey {
    pub fn new(seed: &[u8], keys_per_level: usize, levels: usize) -> Result<Self, String> {
        let tree = TreeKey::new(seed, keys_per_level, levels)?;
        Ok(WasmTreeKey { tree })
    }

    pub fn sign(&mut self, data: &[u8]) -> Result<String, String> {
        let sig = self.tree.sign(data)?;
        serde_json::to_string(&sig).map_err(|e| format!("Serialization error: {}", e))
    }

    pub fn get_public_key(&self) -> Vec<u8> {
        self.tree.get_public_key().to_vec()
    }

    pub fn get_uses(&self) -> u64 {
        self.tree.get_uses()
    }

    pub fn set_uses(&mut self, uses: u64) {
        self.tree.set_uses(uses);
    }

    pub fn get_max_uses(&self) -> u64 {
        self.tree.get_max_uses()
    }

    pub fn get_address_public_key(&self, l1: usize) -> Result<Vec<u8>, String> {
        self.tree.get_address_public_key(l1)
    }

    pub fn restore_cache(&mut self, cache_json: &str) -> Result<(), String> {
        let cache: std::collections::HashMap<String, SignatureProof> =
            serde_json::from_str(cache_json).map_err(|e| format!("Invalid cache JSON: {}", e))?;
        self.tree.restore_cached_signatures(cache);
        Ok(())
    }

    pub fn get_cache(&self) -> Result<String, String> {
        let cache = self.tree.get_cached_signatures();
        serde_json::to_string(cache).map_err(|e| format!("Serialization error: {}", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::treekey::{TreeSignature, verify_tree_signature};

    #[test]
    fn test_wasm_tree_key_lifecycle() {
        let seed = [42u8; 32];
        let mut tree = WasmTreeKey::new(&seed, 4, 2).unwrap();

        assert_eq!(tree.get_uses(), 0);
        assert_eq!(tree.get_max_uses(), 16);
        assert_eq!(tree.get_public_key().len(), 32);

        let data = [99u8; 32];
        let sig_json = tree.sign(&data).unwrap();
        assert!(sig_json.contains("proofs"));
        assert_eq!(tree.get_uses(), 1);

        let sig: TreeSignature = serde_json::from_str(&sig_json).unwrap();
        let pk = tree.get_public_key();
        assert!(verify_tree_signature(&pk, &data, &sig));
    }

    #[test]
    fn test_wasm_tree_key_cache() {
        let seed = [42u8; 32];
        let mut tree = WasmTreeKey::new(&seed, 4, 2).unwrap();

        tree.sign(&[1u8; 32]).unwrap();
        tree.sign(&[2u8; 32]).unwrap();

        let cache_json = tree.get_cache().unwrap();
        assert!(!cache_json.is_empty());

        let mut tree2 = WasmTreeKey::new(&seed, 4, 2).unwrap();
        tree2.restore_cache(&cache_json).unwrap();
        tree2.set_uses(2);
        let sig = tree2.sign(&[3u8; 32]).unwrap();
        let sig_parsed: TreeSignature = serde_json::from_str(&sig).unwrap();
        let pk = tree2.get_public_key();
        assert!(verify_tree_signature(&pk, &[3u8; 32], &sig_parsed));
    }
}

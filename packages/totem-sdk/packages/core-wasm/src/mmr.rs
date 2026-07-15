/// Merkle Mountain Range implementation matching Minima's MMR.java and MMRData.java.
///
/// Used by TreeKeyNode for computing wallet public key from 64 Winternitz keys.
/// All serialization is byte-exact compatible with the Java implementation.

use sha3::{Digest, Sha3_256};
use crate::streamable::{write_mini_number, write_mini_data};

fn sha3(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha3_256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

fn concat(parts: &[&[u8]]) -> Vec<u8> {
    let total: usize = parts.iter().map(|p| p.len()).sum();
    let mut out = Vec::with_capacity(total);
    for p in parts {
        out.extend_from_slice(p);
    }
    out
}

/// MMRData — a node in the MMR tree containing a hash and a sum value.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct MMRData {
    pub data: Vec<u8>,   // 32-byte hash
    pub value: u64,      // Sum value (always 0 for TreeKeyNode)
}

/// MMRProofChunk — one step in the proof path.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MMRProofChunk {
    #[serde(rename = "isLeft")]
    pub is_left: bool,   // Is this sibling on the left?
    #[serde(rename = "mmrData")]
    pub mmr_data: MMRData,
}

/// MMRProof — proof of leaf membership in the tree.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MMRProof {
    pub chunks: Vec<MMRProofChunk>,
}

/// Create MMRData leaf node matching Minima's MMRData.CreateMMRDataLeafNode.
///
/// From MMRData.java:
///   MiniData hash = Crypto.getInstance().hashAllObjects(
///     MiniNumber.ZERO, zData, zSumValue
///   );
///
/// Serialization order:
/// 1. MiniNumber.ZERO: [0x00, 0x01, 0x00]
/// 2. MiniData (pubkey): [4-byte length] + [bytes]
/// 3. MiniNumber.ZERO: [0x00, 0x01, 0x00]
pub fn create_mmr_data_leaf_node(pubkey: &[u8], sum_value: u64) -> MMRData {
    let zero = vec![0x00, 0x01, 0x00]; // MiniNumber.ZERO
    let pubkey_serialized = write_mini_data(pubkey);

    let sum_serialized = if sum_value == 0 {
        vec![0x00, 0x01, 0x00] // MiniNumber.ZERO
    } else {
        write_mini_number(sum_value as i64, 0)
    };

    let hash = sha3(&concat(&[&zero, &pubkey_serialized, &sum_serialized]));
    MMRData { data: hash, value: sum_value }
}

/// Create MMRData parent node matching Minima's MMRData.CreateMMRDataParentNode.
///
/// From MMRData.java:
///   MiniNumber sumvalue = zLeft.getValue().add(zRight.getValue());
///   MiniData combinedhash = Crypto.getInstance().hashAllObjects(
///     MiniNumber.ONE, zLeft.getData(), zRight.getData(), sumvalue);
///
/// Serialization order:
/// 1. MiniNumber.ONE: [0x00, 0x01, 0x01]
/// 2. MiniData (left.data): [4-byte length] + [bytes]
/// 3. MiniData (right.data): [4-byte length] + [bytes]
/// 4. MiniNumber (sumvalue): serialized MiniNumber
pub fn create_mmr_data_parent_node(left: &MMRData, right: &MMRData) -> MMRData {
    let sum_value = left.value + right.value;

    let one = vec![0x00, 0x01, 0x01]; // MiniNumber.ONE
    let left_serialized = write_mini_data(&left.data);
    let right_serialized = write_mini_data(&right.data);

    let sum_serialized = if sum_value == 0 {
        vec![0x00, 0x01, 0x00]
    } else {
        write_mini_number(sum_value as i64, 0)
    };

    let hash = sha3(&concat(&[&one, &left_serialized, &right_serialized, &sum_serialized]));
    MMRData { data: hash, value: sum_value }
}

/// MMR Tree — builds a perfect binary tree from N entries (N must be power of 2).
///
/// Matches TreeKeyNode.java which always uses 64 leaves (2^6).
pub struct MMRTree {
    entries: std::collections::HashMap<(u32, u64), MMRData>,
    leaf_count: u32,
    max_row: u32,
}

impl std::fmt::Debug for MMRTree {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("MMRTree")
            .field("leaf_count", &self.leaf_count)
            .field("max_row", &self.max_row)
            .finish()
    }
}

impl MMRTree {
    pub fn new() -> Self {
        MMRTree {
            entries: std::collections::HashMap::new(),
            leaf_count: 0,
            max_row: 0,
        }
    }

    fn set_entry(&mut self, row: u32, entry_number: u64, data: MMRData) {
        if row > self.max_row {
            self.max_row = row;
        }
        self.entries.insert((row, entry_number), data);
    }

    fn get_entry(&self, row: u32, entry_number: u64) -> Option<&MMRData> {
        self.entries.get(&(row, entry_number))
    }

    /// Add a leaf entry to the MMR. Matches MMR.java addEntry().
    pub fn add_leaf(&mut self, data: MMRData) {
        let entry_number = self.leaf_count as u64;
        self.set_entry(0, entry_number, data);
        self.leaf_count += 1;

        // Propagate up the tree
        let mut current_row = 0u32;
        let mut current_entry = entry_number;

        while current_entry % 2 == 1 {
            // Is right child — find sibling and create parent
            let sibling_number = current_entry - 1;
            let sibling = match self.get_entry(current_row, sibling_number) {
                Some(s) => s.clone(),
                None => break,
            };
            let current = self.get_entry(current_row, current_entry).unwrap().clone();

            let parent_data = create_mmr_data_parent_node(&sibling, &current);
            let parent_row = current_row + 1;
            let parent_entry = current_entry / 2;
            self.set_entry(parent_row, parent_entry, parent_data);

            current_row = parent_row;
            current_entry = parent_entry;
        }
    }

    /// Build tree from array of Winternitz public key digests.
    pub fn from_public_keys(pubkeys: &[Vec<u8>]) -> Self {
        let mut tree = MMRTree::new();
        for pk in pubkeys {
            let leaf_data = create_mmr_data_leaf_node(pk, 0);
            tree.add_leaf(leaf_data);
        }
        tree
    }

    /// Get the root of the tree.
    pub fn get_root(&self) -> Option<MMRData> {
        if self.leaf_count == 0 {
            return None;
        }
        let top_row = (self.leaf_count as f64).log2().floor() as u32;
        self.get_entry(top_row, 0).cloned()
    }

    /// Get proof for a leaf at given index.
    pub fn get_proof(&self, leaf_index: u32) -> MMRProof {
        let mut chunks = Vec::new();
        let mut row = 0u32;
        let mut entry_number = leaf_index as u64;

        while row < self.max_row {
            let sibling_number = if entry_number % 2 == 0 {
                entry_number + 1  // Current is left, sibling is right
            } else {
                entry_number - 1  // Current is right, sibling is left
            };

            let sibling = match self.get_entry(row, sibling_number) {
                Some(s) => s,
                None => break,
            };

            let is_left = sibling_number < entry_number;
            chunks.push(MMRProofChunk {
                is_left,
                mmr_data: sibling.clone(),
            });

            row += 1;
            entry_number /= 2;
        }

        MMRProof { chunks }
    }

    /// Get the leaf MMRData at a specific index.
    pub fn get_leaf(&self, index: u32) -> Option<MMRData> {
        self.get_entry(0, index as u64).cloned()
    }
}

/// Calculate root from leaf data and proof.
///
/// Matches SignatureProof.getRootPublicKey() in Java:
///   MMRData pubentry = MMRData.CreateMMRDataLeafNode(mPublicKey, MiniNumber.ZERO);
///   return mProof.calculateProof(pubentry).getData();
pub fn calculate_proof_root(leaf_data: &MMRData, proof: &MMRProof) -> Vec<u8> {
    let mut current = leaf_data.clone();

    for chunk in &proof.chunks {
        if chunk.is_left {
            // Sibling is on the left, current is on the right
            current = create_mmr_data_parent_node(&chunk.mmr_data, &current);
        } else {
            // Sibling is on the right, current is on the left
            current = create_mmr_data_parent_node(&current, &chunk.mmr_data);
        }
    }

    current.data
}

/// Verify a proof: check that leaf + proof computes to expected root.
pub fn verify_mmr_proof(leaf_pubkey: &[u8], proof: &MMRProof, expected_root: &[u8]) -> bool {
    let leaf_data = create_mmr_data_leaf_node(leaf_pubkey, 0);
    let computed_root = calculate_proof_root(&leaf_data, proof);

    // Constant-time comparison
    if computed_root.len() != expected_root.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for i in 0..computed_root.len() {
        diff |= computed_root[i] ^ expected_root[i];
    }
    diff == 0
}

/// Parse MMRProof from hex bytes matching Minima's MMRProof.readDataStream().
///
/// Format:
///   1. blockTime (MiniNumber)
///   2. chain length (MiniNumber)
///   3. Each chunk: isLeft (1 byte) + MMRData (hash with 4-byte length prefix + value MiniNumber)
pub fn parse_mmr_proof_from_hex(data: &[u8]) -> Result<(MMRProof, u64, usize), String> {
    let mut offset = 0usize;

    // Read blockTime as MiniNumber
    let (block_time, bt_read) = read_mini_number(data, offset)?;
    offset += bt_read;

    // Read chain length as MiniNumber
    let (num_chunks, nc_read) = read_mini_number(data, offset)?;
    offset += nc_read;

    let mut chunks = Vec::new();
    for _ in 0..num_chunks as usize {
        // isLeft flag (1 byte)
        if offset >= data.len() {
            return Err("Unexpected end of data reading isLeft".to_string());
        }
        let is_left = data[offset] == 1;
        offset += 1;

        // MMRData: hash (4-byte length prefix + hash bytes) + value (MiniNumber)
        if offset + 4 > data.len() {
            return Err("Unexpected end of data reading hash length".to_string());
        }
        let hash_length = u32::from_be_bytes([data[offset], data[offset+1], data[offset+2], data[offset+3]]) as usize;
        offset += 4;

        if offset + hash_length > data.len() {
            return Err("Unexpected end of data reading hash".to_string());
        }
        let hash_data = data[offset..offset + hash_length].to_vec();
        offset += hash_length;

        let (chunk_value, cv_read) = read_mini_number(data, offset)?;
        offset += cv_read;

        chunks.push(MMRProofChunk {
            is_left,
            mmr_data: MMRData { data: hash_data, value: chunk_value },
        });
    }

    Ok((MMRProof { chunks }, block_time, offset))
}

/// Read a MiniNumber from bytes at the given offset.
/// Format: [scale: 1 byte] [length: 1 byte] [data: N bytes]
fn read_mini_number(data: &[u8], offset: usize) -> Result<(u64, usize), String> {
    if offset + 2 > data.len() {
        return Err("Unexpected end of data reading MiniNumber header".to_string());
    }
    let _scale = data[offset];
    let length = data[offset + 1] as usize;

    if length == 0 {
        return Ok((0, 2));
    }

    if offset + 2 + length > data.len() {
        return Err("Unexpected end of data reading MiniNumber value".to_string());
    }

    let data_bytes = &data[offset + 2..offset + 2 + length];
    let mut value: u64 = 0;
    for &b in data_bytes {
        value = (value << 8) | b as u64;
    }

    Ok((value, 2 + length))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_leaf_node() {
        let pk = [42u8; 32];
        let leaf = create_mmr_data_leaf_node(&pk, 0);
        assert_eq!(leaf.data.len(), 32);
        assert_eq!(leaf.value, 0);
    }

    #[test]
    fn test_create_parent_node() {
        let pk1 = [1u8; 32];
        let pk2 = [2u8; 32];
        let left = create_mmr_data_leaf_node(&pk1, 0);
        let right = create_mmr_data_leaf_node(&pk2, 0);
        let parent = create_mmr_data_parent_node(&left, &right);
        assert_eq!(parent.data.len(), 32);
        assert_eq!(parent.value, 0);
    }

    #[test]
    fn test_mmr_tree_64_leaves() {
        let pks: Vec<Vec<u8>> = (0..64).map(|i| vec![i as u8; 32]).collect();
        let tree = MMRTree::from_public_keys(&pks);
        let root = tree.get_root().unwrap();
        assert_eq!(root.data.len(), 32);
    }

    #[test]
    fn test_proof_verification() {
        let pks: Vec<Vec<u8>> = (0..64).map(|i| vec![i as u8; 32]).collect();
        let tree = MMRTree::from_public_keys(&pks);
        let root = tree.get_root().unwrap();

        // Get proof for leaf 0
        let proof = tree.get_proof(0);
        let leaf = tree.get_leaf(0).unwrap();

        // Verify
        let computed = calculate_proof_root(&leaf, &proof);
        assert_eq!(computed, root.data);

        // Use verify_mmr_proof
        assert!(verify_mmr_proof(&pks[0], &proof, &root.data));
    }

    #[test]
    fn test_proof_verification_wrong_leaf_fails() {
        let pks: Vec<Vec<u8>> = (0..64).map(|i| vec![i as u8; 32]).collect();
        let tree = MMRTree::from_public_keys(&pks);
        let root = tree.get_root().unwrap();
        let proof = tree.get_proof(0);

        // Try to verify with wrong leaf
        let wrong_pk = vec![99u8; 32];
        assert!(!verify_mmr_proof(&wrong_pk, &proof, &root.data));
    }

    #[test]
    fn test_different_trees_different_roots() {
        let pks1: Vec<Vec<u8>> = (0..64).map(|i| vec![i as u8; 32]).collect();
        let pks2: Vec<Vec<u8>> = (0..64).map(|i| vec![(i + 1) as u8; 32]).collect();
        let tree1 = MMRTree::from_public_keys(&pks1);
        let tree2 = MMRTree::from_public_keys(&pks2);
        assert_ne!(tree1.get_root().unwrap().data, tree2.get_root().unwrap().data);
    }
}

/// Java-compatible seed derivation helpers.
///
/// Matches Minima's Crypto.getInstance().hashAllObjects() and
/// related seed derivation functions byte-for-byte.
///
/// These functions use the Streamable serialization format to
/// produce deterministic, Java-compatible outputs.

use sha3::{Digest, Sha3_256};
use crate::streamable::{write_mini_number, write_mini_data};

/// SHA3-256 hash function.
fn sha3_256(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha3_256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

/// Hash all objects together — matches Java's Crypto.hashAllObjects().
///
/// Serializes each object using Streamable format, concatenates,
/// and returns SHA3-256 of the result.
pub fn hash_all_objects(objects: &[&[u8]]) -> Vec<u8> {
    let mut buf = Vec::new();
    for obj in objects {
        buf.extend_from_slice(obj);
    }
    sha3_256(&buf)
}

/// Derive chain seed for a specific key index.
///
/// Matches Minima's TreeKeyNode.java:
///   MiniData seed = Crypto.getInstance().hashAllObjects(
///     new MiniNumber(i), zPrivateSeed
///   );
pub fn derive_chain_seed_java(seed: &[u8], key_index: u32) -> Vec<u8> {
    let mini_number = write_mini_number(key_index as i64, 0);
    let mini_data = write_mini_data(seed);
    hash_all_objects(&[&mini_number, &mini_data])
}

/// Derive child tree seed.
///
/// Matches Minima's TreeKey.java child derivation.
pub fn derive_child_tree_seed_java(parent_seed: &[u8], child_index: u32) -> Vec<u8> {
    let mini_number = write_mini_number(child_index as i64, 0);
    let mini_data = write_mini_data(parent_seed);
    hash_all_objects(&[&mini_number, &mini_data])
}

/// Derive per-address seed from root seed.
///
/// Matches Minima's address derivation:
///   seed = hashAllObjects(MiniNumber(addressIndex), rootSeed)
pub fn derive_per_address_seed(root_seed: &[u8], address_index: u32) -> Vec<u8> {
    let mini_number = write_mini_number(address_index as i64, 0);
    let mini_data = write_mini_data(root_seed);
    hash_all_objects(&[&mini_number, &mini_data])
}

/// Derive root private seed from BIP39 seed.
///
/// Matches Minima's root key derivation.
pub fn derive_root_priv_seed(bip39_seed: &[u8]) -> Vec<u8> {
    let mini_data = write_mini_data(bip39_seed);
    sha3_256(&mini_data)
}

/// Derive unified child seed.
///
/// Matches the unified TreeKey derivation path.
pub fn derive_unified_child_seed(parent_seed: &[u8], level: u32, index: u32) -> Vec<u8> {
    let level_bytes = write_mini_number(level as i64, 0);
    let index_bytes = write_mini_number(index as i64, 0);
    let seed_bytes = write_mini_data(parent_seed);
    hash_all_objects(&[&level_bytes, &index_bytes, &seed_bytes])
}

/// Precompute transaction coin ID.
///
/// Matches Java's TxPoWGenerator.precomputeTransactionCoinID().
/// The coin ID is computed BEFORE the transaction digest to ensure
/// deterministic output coin IDs.
pub fn precompute_transaction_coin_id(txid: &[u8], output_index: u32) -> Vec<u8> {
    let txid_data = write_mini_data(txid);
    let index_data = write_mini_number(output_index as i64, 0);
    hash_all_objects(&[&txid_data, &index_data])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_chain_seed_deterministic() {
        let seed = [42u8; 32];
        let r1 = derive_chain_seed_java(&seed, 0);
        let r2 = derive_chain_seed_java(&seed, 0);
        assert_eq!(r1, r2);
    }

    #[test]
    fn test_derive_chain_seed_different_index() {
        let seed = [42u8; 32];
        let r0 = derive_chain_seed_java(&seed, 0);
        let r1 = derive_chain_seed_java(&seed, 1);
        assert_ne!(r0, r1);
    }

    #[test]
    fn test_derive_chain_seed_length() {
        let seed = [42u8; 32];
        let result = derive_chain_seed_java(&seed, 0);
        assert_eq!(result.len(), 32);
    }

    #[test]
    fn test_derive_per_address_seed() {
        let root_seed = [42u8; 32];
        let addr0 = derive_per_address_seed(&root_seed, 0);
        let addr1 = derive_per_address_seed(&root_seed, 1);
        assert_eq!(addr0.len(), 32);
        assert_ne!(addr0, addr1);
    }
}

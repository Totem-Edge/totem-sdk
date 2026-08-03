/// Address derivation — script → MMR leaf → Mx address.
///
/// Matches Minima's Address.java constructor:
///   MMRData scriptdata = MMRData.CreateMMRDataLeafNode(mScript, MiniNumber.ZERO);
///   MMRProof proof = mmr.getProof(entry.getEntryNumber());
///   MMRData root = proof.calculateProof(scriptdata);
///   mAddressData = root.getData();
///
/// For a single-leaf MMR, the root equals the leaf commitment:
///   leaf = SHA3-256( MiniNumber.ZERO | MiniData(script) | MiniNumber.ZERO )

use sha3::{Digest, Sha3_256};
use crate::streamable::{write_mini_number, write_mini_data};

/// Convert a KISSVM script to a Minima address (32-byte root).
///
/// Matches Java's Address constructor: MMR leaf → MMR root → address data.
/// For a single-leaf MMR, root = leaf commitment.
pub fn script_to_address(script: &str) -> Vec<u8> {
    let zero = write_mini_number(0, 0); // MiniNumber.ZERO: [00 01 00]
    let script_data = write_mini_data(script.as_bytes()); // MiniData(script)
    let combined = [zero.as_slice(), script_data.as_slice(), zero.as_slice()].concat();

    let mut hasher = Sha3_256::new();
    hasher.update(&combined);
    hasher.finalize().to_vec()
}

/// Convert an Mx address to its 32-byte root.
///
/// This is the inverse of script_to_address for the common case
/// where the address is a direct hash of the script.
pub fn address_to_root(address: &str) -> Result<Vec<u8>, String> {
    crate::minima32::parse_mx_address(address)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_script_to_address_length() {
        let script = "RETURN SIGNEDBY(0xABCD)";
        let address = script_to_address(script);
        assert_eq!(address.len(), 32);
    }

    #[test]
    fn test_script_to_address_deterministic() {
        let script = "RETURN SIGNEDBY(0xABCD)";
        let a1 = script_to_address(script);
        let a2 = script_to_address(script);
        assert_eq!(a1, a2);
    }

    #[test]
    fn test_different_scripts_different_addresses() {
        let a1 = script_to_address("RETURN SIGNEDBY(0xAAAA)");
        let a2 = script_to_address("RETURN SIGNEDBY(0xBBBB)");
        assert_ne!(a1, a2);
    }
}

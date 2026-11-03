//! Deserialisation and verification of the SDK's serialized WOTS tree signatures.
//!
//! Port of `packages/core/src/treekey.ts` `deserializeTreeSignature` +
//! `parseMMRProofFromHex`, producing the `TreeSignature` shape that
//! `totemsdk_core_wasm::treekey::verify_tree_signature` verifies.

use totemsdk_core_wasm::mmr::{MMRData, MMRProof, MMRProofChunk};
use totemsdk_core_wasm::treekey::{verify_tree_signature, SignatureProof, TreeSignature};

use crate::serialize::hex_to_bytes;

struct Reader<'a> {
    data: &'a [u8],
    offset: usize,
}

impl<'a> Reader<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, offset: 0 }
    }

    fn byte(&mut self) -> Result<u8, String> {
        if self.offset >= self.data.len() {
            return Err("Malformed signature: unexpected end of data".to_string());
        }
        let value = self.data[self.offset];
        self.offset += 1;
        Ok(value)
    }

    fn take(&mut self, length: usize) -> Result<Vec<u8>, String> {
        if self.offset + length > self.data.len() {
            return Err("Malformed signature: field out of bounds".to_string());
        }
        let out = self.data[self.offset..self.offset + length].to_vec();
        self.offset += length;
        Ok(out)
    }

    /// MiniNumber: [scale: 1 byte][length: 1 byte][big-endian bytes].
    fn mini_number(&mut self) -> Result<u128, String> {
        let _scale = self.byte()?;
        let length = self.byte()? as usize;
        if length > 16 {
            return Err(format!("Malformed signature: MiniNumber length {length}"));
        }
        let bytes = self.take(length)?;
        let mut value: u128 = 0;
        for byte in bytes {
            value = (value << 8) | u128::from(byte);
        }
        Ok(value)
    }

    /// MiniData: [4-byte big-endian length][data].
    fn mini_data(&mut self) -> Result<Vec<u8>, String> {
        let length_bytes = self.take(4)?;
        let length = u32::from_be_bytes([
            length_bytes[0],
            length_bytes[1],
            length_bytes[2],
            length_bytes[3],
        ]) as usize;
        self.take(length)
    }
}

/// Deserialize the SDK's serialized tree signature bytes.
pub fn deserialize_tree_signature(bytes: &[u8]) -> Result<TreeSignature, String> {
    let mut reader = Reader::new(bytes);
    let count = reader.mini_number()?;
    if count < 1 || count > 8 {
        return Err(format!(
            "Malformed signature: impossible proof count ({count})"
        ));
    }

    let mut proofs = Vec::with_capacity(count as usize);
    for _ in 0..count {
        let leaf_pubkey = reader.mini_data()?;
        let signature = reader.mini_data()?;

        let _block_time = reader.mini_number()?;
        let chunk_count = reader.mini_number()?;
        if chunk_count > 1024 {
            return Err(format!(
                "Malformed signature: impossible chunk count ({chunk_count})"
            ));
        }

        let mut chunks = Vec::with_capacity(chunk_count as usize);
        for _ in 0..chunk_count {
            let is_left = reader.byte()? == 1;
            let data = reader.mini_data()?;
            let value = reader.mini_number()?;
            if value > u128::from(u64::MAX) {
                return Err("Malformed signature: MMR value out of range".to_string());
            }
            chunks.push(MMRProofChunk {
                is_left,
                mmr_data: MMRData {
                    data,
                    value: value as u64,
                },
            });
        }

        proofs.push(SignatureProof {
            leaf_pubkey,
            signature,
            mmr_proof: MMRProof { chunks },
        });
    }

    Ok(TreeSignature { proofs })
}

/// Verify a hex-encoded tree signature over `digest` against the party's root key.
pub fn verify_signature_hex(
    signature_hex: &str,
    digest: &[u8; 32],
    public_key_hex: &str,
) -> Result<bool, String> {
    let signature_bytes = hex_to_bytes(signature_hex)?;
    let public_key = hex_to_bytes(public_key_hex)?;
    if public_key.len() != 32 {
        return Ok(false);
    }
    let signature = deserialize_tree_signature(&signature_bytes)?;
    Ok(verify_tree_signature(&public_key, digest, &signature))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_and_truncated_signatures() {
        assert!(deserialize_tree_signature(&[]).is_err());
        assert!(deserialize_tree_signature(&[0, 1, 0]).is_err());
    }

    #[test]
    fn rejects_impossible_proof_counts() {
        // count = 0
        assert!(deserialize_tree_signature(&[0, 1, 0]).is_err());
        // count = 9
        assert!(deserialize_tree_signature(&[0, 1, 9]).is_err());
    }
}

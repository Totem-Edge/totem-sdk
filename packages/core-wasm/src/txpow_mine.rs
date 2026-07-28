/// TxPoW proof-of-work mining loop.
///
/// Matches Minima's TxPoWChecker.java:
///   txpowId = SHA3-256(serialize(TxHeader))
///   valid   = txpowId < mTxnDifficulty (big-endian 256-bit comparison)
///
/// The mining loop iterates the nonce in the TxHeader until a valid hash is found.
/// Moving this into WASM eliminates hundreds of JS↔WASM boundary crossings per chunk.

use sha3::{Digest, Sha3_256};
use crate::streamable::{write_mini_number, write_mini_data, write_hash_to_stream};

fn sha3_256(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha3_256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

/// Big-endian 256-bit comparison: true if a < b.
fn is_less_than(a: &[u8], b: &[u8]) -> bool {
    for i in 0..32 {
        if a[i] < b[i] { return true; }
        if a[i] > b[i] { return false; }
    }
    false
}

/// Returns the first nonce value that would require more bytes in its
/// MiniNumber encoding (the next boundary at 128, 32768, 8388608, ...).
fn next_nonce_boundary(nonce: u64) -> u64 {
    let nonce_bytes = write_mini_number(nonce as i64, 0);
    let nonce_value_len = nonce_bytes.len() - 2;
    if nonce_value_len == 0 { return 128; }
    2u64.pow((8 * nonce_value_len - 1) as u32)
}

/// Build the "header tail" — the part of TxHeader that follows mNonce.
fn build_header_tail(tx_body_hash: &[u8], time_milli: u64) -> Vec<u8> {
    let mut tail = Vec::new();

    // Chain ID (MiniData)
    tail.extend_from_slice(&write_mini_data(&[1u8])); // MAIN_NET_CHAIN_ID = 1

    // Time milli (MiniNumber)
    tail.extend_from_slice(&write_mini_number(time_milli as i64, 0));

    // Block number (MiniNumber::ZERO)
    tail.extend_from_slice(&write_mini_number(0, 0));

    // TxnDifficulty (MiniData of MAX_HASH)
    tail.extend_from_slice(&write_mini_data(&[0xffu8; 32]));

    // Cascade levels (1 byte)
    tail.push(4);

    // ZERO_HASH × 2
    tail.extend_from_slice(&write_hash_to_stream(&[0u8; 32]));
    tail.extend_from_slice(&write_hash_to_stream(&[0u8; 32]));

    // Magic number (MiniNumber::ZERO)
    tail.extend_from_slice(&write_mini_number(0, 0));

    // Magic bytes (serializeMagic)
    tail.extend_from_slice(b"MINIMA_TXPOW");

    // ZERO_HASH
    tail.extend_from_slice(&write_hash_to_stream(&[0u8; 32]));

    // TxBody hash
    tail.extend_from_slice(&write_hash_to_stream(tx_body_hash));

    tail
}

/// Mine a chunk of nonces within a fixed encoding boundary.
/// Returns the found nonce, or None if not found in this chunk.
fn mine_chunk(
    header_buf: &mut [u8],
    nonce_value_len: usize,
    target: &[u8],
    start_nonce: u64,
    end_nonce: u64,
) -> Option<u64> {
    let nonce_value_offset = 2;

    for nonce in start_nonce..end_nonce {
        // Write nonce in big-endian at offset 2
        let mut n = nonce;
        for i in (0..nonce_value_len).rev() {
            header_buf[nonce_value_offset + i] = (n & 0xff) as u8;
            n >>= 8;
        }

        let hash = sha3_256(header_buf);
        if is_less_than(&hash, target) {
            return Some(nonce);
        }
    }
    None
}

/// Result of a mining operation.
#[derive(Debug)]
pub struct MineResult {
    pub mined_header_bytes: Vec<u8>,
    pub txpow_id: Vec<u8>,
    pub nonce: u64,
    pub iterations: u64,
}

/// Mine a TxPoW by iterating the header nonce until
/// SHA3-256(TxHeader) < txnDifficulty.
///
/// @param tx_body_bytes  Pre-serialized TxBody bytes.
/// @param txn_difficulty 32-byte target.
/// @param time_milli     Timestamp in milliseconds (passed from JS — SystemTime not available in WASM).
/// @param max_iterations Maximum iterations before giving up (0 = unlimited).
pub fn mine_txpow(
    tx_body_bytes: &[u8],
    txn_difficulty: &[u8],
    time_milli: u64,
    max_iterations: u64,
) -> Result<MineResult, String> {
    let body_hash = sha3_256(tx_body_bytes);
    let header_tail = build_header_tail(&body_hash, time_milli);

    let mut total_iterations: u64 = 0;
    let mut nonce: u64 = 0;

    loop {
        if max_iterations > 0 && total_iterations >= max_iterations {
            return Err(format!(
                "Mining exhausted: {} iterations without finding a valid nonce",
                total_iterations
            ));
        }

        let boundary = next_nonce_boundary(nonce);
        let chunk_size: u64 = 10_000;
        let chunk_end = if nonce + chunk_size < boundary { nonce + chunk_size } else { boundary };

        let nonce_bytes = write_mini_number(nonce as i64, 0);
        let nonce_value_len = nonce_bytes.len() - 2;
        let mut header_buf = nonce_bytes;
        header_buf.extend_from_slice(&header_tail);

        if let Some(found) = mine_chunk(&mut header_buf, nonce_value_len, txn_difficulty, nonce, chunk_end) {
            let final_nonce_bytes = write_mini_number(found as i64, 0);
            let mut final_header = final_nonce_bytes;
            final_header.extend_from_slice(&header_tail);
            let txpow_id = sha3_256(&final_header);

            return Ok(MineResult {
                mined_header_bytes: final_header,
                txpow_id,
                nonce: found,
                iterations: total_iterations + (found - nonce),
            });
        }

        total_iterations += chunk_end - nonce;
        nonce = chunk_end;
    }
}

/// Mine a single chunk of nonces. Returns the found nonce or None.
/// Call this in a loop with yields between chunks for responsive UIs.
pub fn mine_txpow_chunk(
    tx_body_bytes: &[u8],
    txn_difficulty: &[u8],
    time_milli: u64,
    start_nonce: u64,
    chunk_size: u64,
) -> Option<u64> {
    let body_hash = sha3_256(tx_body_bytes);
    let header_tail = build_header_tail(&body_hash, time_milli);

    let boundary = next_nonce_boundary(start_nonce);
    let chunk_end = if start_nonce + chunk_size < boundary {
        start_nonce + chunk_size
    } else {
        boundary
    };

    let nonce_bytes = write_mini_number(start_nonce as i64, 0);
    let nonce_value_len = nonce_bytes.len() - 2;
    let mut header_buf = nonce_bytes;
    header_buf.extend_from_slice(&header_tail);

    mine_chunk(&mut header_buf, nonce_value_len, txn_difficulty, start_nonce, chunk_end)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_less_than() {
        let a = [0u8; 32];
        let b = [1u8; 32];
        assert!(is_less_than(&a, &b));
        assert!(!is_less_than(&b, &a));
        assert!(!is_less_than(&a, &a));
    }

    #[test]
    fn test_next_nonce_boundary() {
        assert_eq!(next_nonce_boundary(0), 128);
        assert_eq!(next_nonce_boundary(127), 128);
        assert_eq!(next_nonce_boundary(128), 32768);
    }

    #[test]
    fn test_mine_txpow_easy_target() {
        // Very easy target (all 0xFF) — should find a nonce quickly
        let tx_body = b"test transaction body";
        let target = [0xFFu8; 32];

        let result = mine_txpow(tx_body, &target, 0, 100_000).unwrap();
        assert!(result.iterations < 100_000);
        assert_eq!(result.txpow_id.len(), 32);

        // Verify: SHA3-256(header) < target
        let hash = sha3_256(&result.mined_header_bytes);
        assert!(is_less_than(&hash, &target));
    }

    #[test]
    fn test_mine_txpow_impossible_target() {
        // Impossible target (all zeros) — should exhaust
        let tx_body = b"test";
        let target = [0u8; 32];
        let result = mine_txpow(tx_body, &target, 0, 1000);
        assert!(result.is_err());
    }
}

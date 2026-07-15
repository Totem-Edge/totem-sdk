/// Minima "Mx" Base32 address encoding/decoding.
///
/// Matches Minima's org.minima.utils.BaseConverter.encode32/decode32:
///   BigInteger → radix-32 string → character swaps → uppercase → "Mx" prefix
///
/// Address format: [sentinel(1) + length(2) + data(32) + checksum(4)] = 39 bytes → Mx... string

use sha3::{Digest, Sha3_256};

/// Encode bytes to Minima Mx Base32 format using BigInteger radix-32.
///
/// Matches: bytesToBigInt(frame).toString(32) with i→w, l→y, o→z swaps.
pub fn encode_mx_radix32_frame(data: &[u8]) -> String {
    // Convert bytes to BigInt
    let mut x = num_bigint::BigUint::from_bytes_be(data);

    // Convert to radix-32 string
    let thirty_two = num_bigint::BigUint::from(32u32);
    let mut chars = Vec::new();
    while x > num_bigint::BigUint::ZERO {
        let rem = &x % &thirty_two;
        let digit: u32 = rem.try_into().unwrap_or(0);
        chars.push(std::char::from_digit(digit, 32).unwrap_or('0'));
        x /= &thirty_two;
    }
    chars.reverse();

    if chars.is_empty() {
        chars.push('0');
    }

    // Apply character swaps: i→w, l→y, o→z
    let s: String = chars.into_iter().map(|ch| match ch {
        'i' => 'w',
        'l' => 'y',
        'o' => 'z',
        _ => ch,
    }).collect();

    s.to_uppercase()
}

/// Decode Minima Mx Base32 string to bytes using BigInteger radix-32.
///
/// Matches: reverse swaps → parseInt(ch, 32) → BigInt → bytes.
fn decode_mx_radix32_frame(encoded: &str, _expected_len: usize) -> Result<Vec<u8>, String> {
    let s = encoded.to_lowercase();

    // Reverse character swaps: w→i, y→l, z→o
    let s: String = s.chars().map(|ch| match ch {
        'w' => 'i',
        'y' => 'l',
        'z' => 'o',
        _ => ch,
    }).collect();

    // Parse as base-32 BigInt
    let mut x = num_bigint::BigUint::ZERO;
    let thirty_two = num_bigint::BigUint::from(32u32);

    for ch in s.chars() {
        let digit = ch.to_digit(32)
            .ok_or_else(|| format!("Invalid Base32 character: {}", ch))?;
        x = x * &thirty_two + digit;
    }

    Ok(x.to_bytes_be())
}

/// Build a Minima Mx address from 32-byte root data.
///
/// Format: [sentinel(1) + length(2) + data(32) + checksum(4)] = 39 bytes
/// Then Base32 encoded with Mx prefix.
pub fn make_mx_address(root32: &[u8]) -> Result<String, String> {
    if root32.len() != 32 {
        return Err(format!("root32 must be exactly 32 bytes, got {}", root32.len()));
    }

    let mut frame = Vec::with_capacity(39);
    frame.push(0x01);  // Sentinel byte (matches TypeScript: 0x01)
    frame.push(0x00);  // Length high byte
    frame.push(32);    // Length low byte
    frame.extend_from_slice(root32);

    // Checksum: first 4 bytes of SHA3-256 of the raw 32 bytes (matches TypeScript)
    let checksum = {
        let mut hasher = Sha3_256::new();
        hasher.update(root32);
        let hash = hasher.finalize();
        hash[..4].to_vec()
    };
    frame.extend_from_slice(&checksum);

    let encoded = encode_mx_radix32_frame(&frame);
    Ok(format!("Mx{}", encoded))
}

/// Decode a Minima Mx address to raw bytes, validating frame and checksum.
pub fn parse_mx_address(address: &str) -> Result<Vec<u8>, String> {
    let address = address.trim();

    // Strip Mx prefix
    let encoded = if address.starts_with("Mx") || address.starts_with("mx") {
        &address[2..]
    } else {
        return Err("Address must start with 'Mx'".to_string());
    };

    let frame = decode_mx_radix32_frame(encoded, 39)?;

    if frame.len() < 7 {
        return Err("Decoded address too short".to_string());
    }

    // Validate sentinel byte (matches TypeScript: 0x01)
    if frame[0] != 0x01 {
        return Err(format!("Invalid sentinel byte: 0x{:02x}, expected 0x01", frame[0]));
    }

    let data_len = u16::from_be_bytes([frame[1], frame[2]]) as usize;
    if data_len != 32 {
        return Err(format!("Invalid length: {}, expected 32", data_len));
    }

    let root32 = &frame[3..35];
    let checksum = &frame[35..39];

    // Validate checksum: SHA3-256 of raw 32 bytes (matches TypeScript)
    let expected = {
        let mut hasher = Sha3_256::new();
        hasher.update(root32);
        let hash = hasher.finalize();
        hash[..4].to_vec()
    };

    if checksum != expected.as_slice() {
        return Err("Checksum mismatch".to_string());
    }

    Ok(root32.to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_make_and_parse_roundtrip() {
        let root = [42u8; 32];
        let address = make_mx_address(&root).unwrap();
        eprintln!("Address: {}", address);
        assert!(address.starts_with("Mx"));
        match parse_mx_address(&address) {
            Ok(parsed) => assert_eq!(parsed, root.to_vec()),
            Err(e) => panic!("Parse error: {}", e),
        }
    }

    #[test]
    fn test_make_mx_address_format() {
        let root = [0u8; 32];
        let address = make_mx_address(&root).unwrap();
        assert!(address.starts_with("Mx"));
        assert!(address.len() > 10);
    }

    #[test]
    fn test_parse_invalid_prefix() {
        assert!(parse_mx_address("0x1234").is_err());
    }

    #[test]
    fn test_parse_checksum_fails() {
        let root = [42u8; 32];
        let mut address = make_mx_address(&root).unwrap();
        address.replace_range(3..4, "X");
        assert!(parse_mx_address(&address).is_err());
    }

    #[test]
    fn test_roundtrip_various_values() {
        for val in 0..10u8 {
            let root = [val; 32];
            let address = make_mx_address(&root).unwrap();
            let parsed = parse_mx_address(&address).unwrap();
            assert_eq!(parsed, root.to_vec(), "Failed for val={}", val);
        }
    }
}

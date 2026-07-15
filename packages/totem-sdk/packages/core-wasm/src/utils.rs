/// Byte array utility functions — mirrors @totemsdk/core utils.ts

/// Convert bytes to uppercase hex string.
pub fn bytes_to_hex(bytes: &[u8]) -> String {
    hex::encode_upper(bytes)
}

/// Convert hex string to bytes.
pub fn hex_to_bytes(hex_str: &str) -> Result<Vec<u8>, String> {
    let hex_str = hex_str.strip_prefix("0x").unwrap_or(hex_str);
    hex::decode(hex_str).map_err(|e| format!("Invalid hex: {}", e))
}

/// Concatenate multiple byte slices.
pub fn concat_bytes(slices: &[&[u8]]) -> Vec<u8> {
    let total_len: usize = slices.iter().map(|s| s.len()).sum();
    let mut result = Vec::with_capacity(total_len);
    for slice in slices {
        result.extend_from_slice(slice);
    }
    result
}

/// Convert UTF-8 string to bytes.
pub fn utf8_to_bytes(s: &str) -> Vec<u8> {
    s.as_bytes().to_vec()
}

/// Convert bytes to UTF-8 string.
pub fn bytes_to_utf8(bytes: &[u8]) -> Result<String, String> {
    String::from_utf8(bytes.to_vec()).map_err(|e| format!("Invalid UTF-8: {}", e))
}

/// Zero a mutable byte slice (secure memory clearing).
pub fn zero_bytes(bytes: &mut [u8]) {
    bytes.fill(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bytes_to_hex() {
        assert_eq!(bytes_to_hex(&[0xab, 0xcd, 0xef]), "ABCDEF");
        assert_eq!(bytes_to_hex(&[]), "");
    }

    #[test]
    fn test_hex_to_bytes() {
        assert_eq!(hex_to_bytes("ABCDEF").unwrap(), vec![0xab, 0xcd, 0xef]);
        assert_eq!(hex_to_bytes("0xABCDEF").unwrap(), vec![0xab, 0xcd, 0xef]);
        assert!(hex_to_bytes("GHI").is_err());
    }

    #[test]
    fn test_concat_bytes() {
        let result = concat_bytes(&[&[1, 2], &[3, 4], &[5]]);
        assert_eq!(result, vec![1, 2, 3, 4, 5]);
    }

    #[test]
    fn test_zero_bytes() {
        let mut data = vec![1, 2, 3, 4];
        zero_bytes(&mut data);
        assert_eq!(data, vec![0, 0, 0, 0]);
    }
}

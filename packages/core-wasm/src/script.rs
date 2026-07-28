/// KISSVM script generation.
///
/// Generates Minima KISSVM scripts for WOTS public keys.

/// Generate a KISSVM script from a WOTS public key digest.
///
/// Produces: RETURN SIGNEDBY(0x<pkDigest>)
pub fn script_from_wots_pk(pk_digest: &[u8]) -> String {
    let hex_digest = crate::utils::bytes_to_hex(pk_digest);
    format!("RETURN SIGNEDBY(0x{})", hex_digest)
}

/// Derive a Minima Mx address from a WOTS keypair.
///
/// This is the standard pipeline:
///   seed + keyIndex → pkDigest → script → address root → Mx address
pub fn wots_address_from_keypair(seed: &[u8], key_index: u32) -> Result<String, String> {
    let pk_digest = crate::wots::derive_pk_digest(seed, key_index);
    let script = script_from_wots_pk(&pk_digest);
    let address_root = crate::derive::script_to_address(&script);
    crate::minima32::make_mx_address(&address_root)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_script_from_wots_pk_format() {
        let pk = [0xABu8; 32];
        let script = script_from_wots_pk(&pk);
        assert!(script.starts_with("RETURN SIGNEDBY(0x"));
        assert!(script.contains("ABABABAB"));
    }

    #[test]
    fn test_wots_address_from_keypair() {
        let seed = [42u8; 32];
        let address = wots_address_from_keypair(&seed, 0).unwrap();
        assert!(address.starts_with("Mx"));
    }
}

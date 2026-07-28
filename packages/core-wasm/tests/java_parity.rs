/// Parity tests against Java golden vectors from test-vectors.json.
///
/// These tests verify that the Rust WOTS implementation produces
/// byte-exact results matching the Minima Java node.

use totemsdk_core_wasm::wots;
use totemsdk_core_wasm::params::*;
use sha3::{Digest, Sha3_256};

fn sha3_256(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha3_256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

#[derive(serde::Deserialize)]
struct TestVectors {
    #[serde(rename = "sdkVersion")]
    _sdk_version: String,
    #[serde(rename = "hexConvention")]
    _hex_convention: String,
    #[serde(rename = "wotsParams")]
    wots_params: WotsParams,
    vectors: Vec<TestVector>,
}

#[derive(serde::Deserialize)]
struct WotsParams {
    w: u32,
    n: u32,
    #[serde(rename = "totalChains")]
    total_chains: u32,
}

#[derive(serde::Deserialize)]
struct TestVector {
    description: String,
    message: String,
    #[serde(rename = "publicKeyFullHex")]
    public_key_full_hex: String,
    #[serde(rename = "publicKeyDigestHex")]
    public_key_digest_hex: String,
    #[serde(rename = "signatureHex")]
    signature_hex: String,
    #[serde(rename = "digestHex")]
    digest_hex: String,
    #[serde(rename = "keyIndex")]
    key_index: u32,
    #[serde(rename = "shouldVerify")]
    should_verify: bool,
}

#[test]
fn test_java_golden_vectors() {
    // Read test vectors from the core package
    let vectors_path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../core/test-vectors.json"
    );

    let json_str = match std::fs::read_to_string(vectors_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Could not read test vectors at {}: {}", vectors_path, e);
            eprintln!("Skipping parity test — run from workspace root or set CARGO_MANIFEST_DIR");
            return;
        }
    };

    let test_vectors: TestVectors = serde_json::from_str(&json_str)
        .expect("Failed to parse test-vectors.json");

    // Verify WOTS parameters match (test vectors use bits, Rust uses bytes)
    assert_eq!(test_vectors.wots_params.w, WOTS_W as u32,
        "WOTS w parameter mismatch: Java={}, Rust={}", test_vectors.wots_params.w, WOTS_W);
    assert_eq!(test_vectors.wots_params.n, (WOTS_N * 8) as u32,
        "WOTS n parameter mismatch: Java={} bits, Rust={} bytes ({} bits)",
        test_vectors.wots_params.n, WOTS_N, WOTS_N * 8);
    assert_eq!(test_vectors.wots_params.total_chains, WOTS_L as u32,
        "WOTS L parameter mismatch: Java={}, Rust={}", test_vectors.wots_params.total_chains, WOTS_L);

    println!("\n=== Java Golden Vector Parity Tests ===");
    println!("WOTS params: w={}, n={}, L={}", WOTS_W, WOTS_N, WOTS_L);
    println!("Vectors: {}", test_vectors.vectors.len());

    for (i, vector) in test_vectors.vectors.iter().enumerate() {
        println!("\n--- Vector {}: {} ---", i + 1, vector.description);

        // 1. Verify SHA3-256(message) matches digestHex
        let message_bytes = vector.message.as_bytes();
        let computed_digest = sha3_256(message_bytes);
        let expected_digest = hex::decode(&vector.digest_hex)
            .expect("Invalid digest hex");

        assert_eq!(computed_digest, expected_digest,
            "Vector {}: SHA3-256(message) != digestHex\n  computed: {}\n  expected: {}",
            i + 1, hex::encode(&computed_digest), vector.digest_hex);

        println!("  ✓ SHA3-256(message) matches digestHex");

        // 2. Decode signature and public key
        let signature = hex::decode(&vector.signature_hex)
            .expect("Invalid signature hex");
        let public_key_full = hex::decode(&vector.public_key_full_hex)
            .expect("Invalid public key hex");

        assert_eq!(signature.len(), WOTS_L * 32,
            "Vector {}: signature length mismatch: {} != {}",
            i + 1, signature.len(), WOTS_L * 32);
        assert_eq!(public_key_full.len(), WOTS_L * 32,
            "Vector {}: public key length mismatch: {} != {}",
            i + 1, public_key_full.len(), WOTS_L * 32);

        // 3. Verify WOTS signature
        // The test vector _usage says: wotsVerify(signatureHex, digestHex, publicKeyFullHex)
        // Both wotsSign and wotsVerify hash internally. The signature was produced by
        // signing the digest (which gets hashed again = double-hash). So verification
        // must also pass the digest (which gets hashed again = same double-hash).
        let digest_bytes = hex::decode(&vector.digest_hex)
            .expect("Invalid digest hex");
        let verify_result = wots::wots_verify(&signature, &digest_bytes, &public_key_full);

        assert_eq!(verify_result, vector.should_verify,
            "Vector {}: wotsVerify returned {}, expected {}",
            i + 1, verify_result, vector.should_verify);

        if vector.should_verify {
            println!("  ✓ wotsVerify passed (signature is valid)");
        } else {
            println!("  ✓ wotsVerify correctly rejected (wrong public key)");
        }

        // 4. Verify public key digest (skip for negative test vectors with wrong keys)
        if vector.should_verify {
            let computed_pk_digest = {
                let mut hasher = Sha3_256::new();
                hasher.update(&public_key_full);
                hasher.finalize().to_vec()
            };
            let expected_pk_digest = hex::decode(&vector.public_key_digest_hex)
                .expect("Invalid pk digest hex");

            assert_eq!(computed_pk_digest, expected_pk_digest,
                "Vector {}: SHA3-256(pkFull) != publicKeyDigestHex\n  computed: {}\n  expected: {}",
                i + 1, hex::encode(&computed_pk_digest), vector.public_key_digest_hex);

            println!("  ✓ SHA3-256(pkFull) matches publicKeyDigestHex");
        }
    }

    println!("\n=== All {} golden vectors passed! ===", test_vectors.vectors.len());
}

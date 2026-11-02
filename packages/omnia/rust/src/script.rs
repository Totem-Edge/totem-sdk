use crate::types::ChannelParticipant;

pub const COINID_ELTOO: &str = "0x01";

/// Default eltoo contest window (blocks). Mirrors `ELTOO_CONTEST_DELAY_BLOCKS`.
pub const ELTOO_CONTEST_DELAY_BLOCKS: u64 = 256;

/// Largest contest delay accepted, matching the TS `Number.MAX_SAFE_INTEGER`
/// bound used by `buildEltooScript`.
const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

/// Node-canonical hex literal: lowercase `0x` prefix, uppercase digits.
fn kiss_hex(raw: &str) -> String {
    format!("0x{}", raw.to_uppercase())
}

/// Validate a channel party public-key digest and return the canonical literal.
///
/// The digest is interpolated directly into the `MULTISIG(2 …)` line, so it must
/// be exactly 64 hex characters. Anything else could inject KISSVM opcodes into
/// the script and change its meaning (the TS builder enforces the same rule).
fn validated_digest(parties: &[ChannelParticipant], index: usize) -> Result<String, String> {
    let raw = parties[index]
        .public_key_digest
        .strip_prefix("0x")
        .or_else(|| parties[index].public_key_digest.strip_prefix("0X"))
        .unwrap_or(&parties[index].public_key_digest);

    if raw.len() != 64 || !raw.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(format!(
            "parties[{}].publicKeyDigest must be exactly 64 hex characters, got {:?}",
            index, parties[index].public_key_digest
        ));
    }

    Ok(kiss_hex(raw))
}

/// Build the eltoo channel script.
///
/// This MUST be byte-identical to the TS `buildEltooScript` output for the same
/// parties and delay: the funding address is derived from this text and
/// `acceptChannel` compares the counterparty's script verbatim.
pub fn build_eltoo_script(
    parties: &[ChannelParticipant],
    contest_delay_blocks: u64,
) -> Result<String, String> {
    if parties.len() != 2 {
        return Err(format!(
            "v0.1.0 supports exactly 2 parties, got {}",
            parties.len()
        ));
    }

    // `u64` cannot represent the TS bound, so check the delay as f64 here as
    // well to keep the accepted range identical.
    if (contest_delay_blocks as f64) > MAX_SAFE_INTEGER {
        return Err(format!(
            "contestDelayBlocks must be a safe non-negative integer, got {}",
            contest_delay_blocks
        ));
    }

    let pk_a = validated_digest(parties, 0)?;
    let pk_b = validated_digest(parties, 1)?;
    if pk_a == pk_b {
        // MULTISIG(2 A A) is satisfiable by a single signature of A, which
        // silently collapses the 2-of-2 spend constraint to 1-of-1.
        return Err(
            "parties must have distinct publicKeyDigest values; a duplicate key collapses MULTISIG(2) to 1-of-1"
                .to_string(),
        );
    }

    // Node-canonical form: lowercase user variables, `0x` hex prefixes. This is
    // the exact text the TS `toNodeScript` pass produces.
    let script = [
        "LET settlement=STATE(100)".to_string(),
        "LET sequence=STATE(101)".to_string(),
        "LET prevsequence=PREVSTATE(101)".to_string(),
        format!("LET bothsigned=MULTISIG(2 {} {})", pk_a, pk_b),
        "IF settlement THEN".to_string(),
        "    ASSERT bothsigned".to_string(),
        "    ASSERT sequence EQ prevsequence".to_string(),
        format!("    ASSERT @COINAGE GTE {}", contest_delay_blocks),
        "    RETURN TRUE".to_string(),
        "ENDIF".to_string(),
        "ASSERT bothsigned".to_string(),
        "ASSERT sequence GT prevsequence".to_string(),
        "RETURN TRUE".to_string(),
    ]
    .join("\n");

    Ok(script)
}

pub fn normalize_script(script: &str) -> String {
    script.trim().to_uppercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn party(id: &str, digest: &str) -> ChannelParticipant {
        ChannelParticipant {
            party_id: id.to_string(),
            public_key_digest: digest.to_string(),
            address_index: 0,
            settlement_address: None,
            relay_endpoint: None,
        }
    }

    const A: &str = "1111111111111111111111111111111111111111111111111111111111111111";
    const B: &str = "2222222222222222222222222222222222222222222222222222222222222222";

    #[test]
    fn matches_the_ts_canonical_script() {
        let script = build_eltoo_script(&[party("a", A), party("b", B)], 256).unwrap();
        let expected = [
            "LET settlement=STATE(100)",
            "LET sequence=STATE(101)",
            "LET prevsequence=PREVSTATE(101)",
            &format!(
                "LET bothsigned=MULTISIG(2 {} {})",
                kiss_hex(A),
                kiss_hex(B)
            ),
            "IF settlement THEN",
            "    ASSERT bothsigned",
            "    ASSERT sequence EQ prevsequence",
            "    ASSERT @COINAGE GTE 256",
            "    RETURN TRUE",
            "ENDIF",
            "ASSERT bothsigned",
            "ASSERT sequence GT prevsequence",
            "RETURN TRUE",
        ]
        .join("\n");
        assert_eq!(script, expected);
    }

    #[test]
    fn interpolates_the_contest_delay() {
        let script = build_eltoo_script(&[party("a", A), party("b", B)], 12).unwrap();
        assert!(script.contains("ASSERT @COINAGE GTE 12"));
    }

    #[test]
    fn rejects_duplicate_keys() {
        let err = build_eltoo_script(&[party("a", A), party("b", A)], 256).unwrap_err();
        assert!(err.contains("distinct publicKeyDigest"), "{err}");
    }

    #[test]
    fn rejects_injected_digests() {
        let injected = format!("{A}\nASSERT TRUE");
        let err = build_eltoo_script(&[party("a", &injected), party("b", B)], 256).unwrap_err();
        assert!(err.contains("64 hex characters"), "{err}");
    }

    #[test]
    fn rejects_wrong_party_count() {
        assert!(build_eltoo_script(&[party("a", A)], 256).is_err());
        assert!(build_eltoo_script(&[party("a", A), party("b", B), party("c", A)], 256).is_err());
    }
}

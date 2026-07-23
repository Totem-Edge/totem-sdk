use crate::types::ChannelParticipant;

pub const COINID_ELTOO: &str = "0x01";

fn kiss_hex(h: &str) -> String {
    let raw = if h.starts_with("0x") || h.starts_with("0X") {
        &h[2..]
    } else {
        h
    };
    format!("0X{}", raw.to_uppercase())
}

pub fn build_eltoo_script(parties: &[ChannelParticipant]) -> Result<String, String> {
    if parties.len() != 2 {
        return Err(format!("v0.1.0 supports exactly 2 parties, got {}", parties.len()));
    }
    let pk_a = kiss_hex(&parties[0].public_key_digest);
    let pk_b = kiss_hex(&parties[1].public_key_digest);

    let script = vec![
        "LET SETTLEMENT=STATE(100)".to_string(),
        "LET SEQUENCE=STATE(101)".to_string(),
        "LET PREVSEQUENCE=PREVSTATE(101)".to_string(),
        format!("ASSERT MULTISIG(2 {} {})", pk_a, pk_b),
        "IF SETTLEMENT THEN".to_string(),
        "    IF SEQUENCE EQ PREVSEQUENCE AND @COINAGE GTE 256 THEN RETURN TRUE ENDIF".to_string(),
        "ELSE".to_string(),
        "    IF SEQUENCE GT PREVSEQUENCE THEN RETURN TRUE ENDIF".to_string(),
        "ENDIF".to_string(),
    ]
    .join("\n");

    Ok(script)
}

pub fn normalize_script(script: &str) -> String {
    script.trim().to_uppercase()
}

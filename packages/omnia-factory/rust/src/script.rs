use crate::types::FactoryParticipant;

fn kiss_hex(h: &str) -> String {
    let raw = if h.starts_with("0x") || h.starts_with("0X") { &h[2..] } else { h };
    format!("0X{}", raw.to_uppercase())
}

pub fn build_factory_script(participants: &[FactoryParticipant]) -> Result<String, String> {
    if participants.len() < 2 {
        return Err(format!("Factory requires at least 2 participants, got {}", participants.len()));
    }
    let n = participants.len();
    let pks: Vec<String> = participants.iter().map(|p| kiss_hex(&p.public_key_digest)).collect();
    let pk_str = pks.join(" ");

    Ok(vec![
        "LET SETTLEMENT=STATE(100)".to_string(),
        format!("ASSERT MULTISIG({} {})", n, pk_str),
        "IF SETTLEMENT THEN".to_string(),
        "    IF @COINAGE GTE 1 THEN RETURN TRUE ENDIF".to_string(),
        "ELSE".to_string(),
        "    RETURN TRUE".to_string(),
        "ENDIF".to_string(),
    ].join("\n"))
}

pub fn normalize_script(script: &str) -> String {
    script.trim().to_uppercase()
}

pub const RECLAIM_TIMELOCK: u64 = 256;

fn kiss_hex(h: &str) -> String {
    let raw = if h.starts_with("0x") || h.starts_with("0X") {
        &h[2..]
    } else {
        h
    };
    format!("0X{}", raw.to_uppercase())
}

pub fn build_statechain_script(se_pkd: &str) -> String {
    let lines = vec![
        "LET OWNER=STATE(0)".to_string(),
        format!("IF @COINAGE GTE {} THEN", RECLAIM_TIMELOCK),
        "  RETURN SIGNEDBY(OWNER)".to_string(),
        "ENDIF".to_string(),
        format!("ASSERT MULTISIG(2 OWNER {})", kiss_hex(se_pkd)),
        "RETURN TRUE".to_string(),
    ];
    lines.join("\n")
}

pub fn normalize_script(script: &str) -> String {
    script.trim().to_uppercase()
}

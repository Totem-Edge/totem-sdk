/// Fixed-point arithmetic for MachinePay — Rust/WASM port of the shared
/// _toScaled / _fromScaled logic from usage-meter.ts and credit-gate.ts.
///
/// Uses 10^8 scale (Minima max 8 decimal places). Eliminates the copy-pasted
/// BigInt arithmetic in both TypeScript files.

use wasm_bindgen::prelude::*;

const SCALE: i128 = 100_000_000; // 10^8

/// Convert a decimal string to scaled integer (10^8 scale).
/// "1.5" → 150_000_000
#[wasm_bindgen]
pub fn to_scaled(s: &str) -> String {
    let parts: Vec<&str> = s.split('.').collect();
    let integer = parts[0].parse::<i128>().unwrap_or(0);
    let frac_str = if parts.len() > 1 { parts[1] } else { "" };
    let frac_padded = format!("{:0<8}", frac_str);
    let frac = frac_padded[..8].parse::<i128>().unwrap_or(0);
    (integer * SCALE + frac).to_string()
}

/// Convert a scaled integer back to decimal string.
/// 150_000_000 → "1.5"
#[wasm_bindgen]
pub fn from_scaled(n_str: &str) -> String {
    let n: i128 = n_str.parse().unwrap_or(0);
    if n == 0 {
        return "0".to_string();
    }
    let int_part = n / SCALE;
    let frac_part = n % SCALE;
    if frac_part == 0 {
        return int_part.to_string();
    }
    let frac_str = format!("{:0>8}", frac_part).trim_end_matches('0').to_string();
    format!("{}.{}", int_part, frac_str)
}

/// Add two decimal strings using scaled arithmetic.
/// Returns the sum as a decimal string.
#[wasm_bindgen]
pub fn add_decimal(a: &str, b: &str) -> String {
    let a_scaled: i128 = to_scaled(a).parse().unwrap_or(0);
    let b_scaled: i128 = to_scaled(b).parse().unwrap_or(0);
    from_scaled(&(a_scaled + b_scaled).to_string())
}

/// Compare two decimal strings. Returns -1, 0, or 1.
#[wasm_bindgen]
pub fn compare_decimal(a: &str, b: &str) -> i32 {
    let a_scaled: i128 = to_scaled(a).parse().unwrap_or(0);
    let b_scaled: i128 = to_scaled(b).parse().unwrap_or(0);
    a_scaled.cmp(&b_scaled) as i32
}

/// Check if a exceeds a limit. Returns true if a > limit.
#[wasm_bindgen]
pub fn is_over_limit(usage: &str, limit: &str) -> bool {
    compare_decimal(usage, limit) > 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_scaled_whole_number() {
        assert_eq!(to_scaled("5"), "500000000");
    }

    #[test]
    fn test_to_scaled_decimal() {
        assert_eq!(to_scaled("1.5"), "150000000");
    }

    #[test]
    fn test_to_scaled_max_precision() {
        assert_eq!(to_scaled("0.12345678"), "12345678");
    }

    #[test]
    fn test_from_scaled_whole() {
        assert_eq!(from_scaled("500000000"), "5");
    }

    #[test]
    fn test_from_scaled_decimal() {
        assert_eq!(from_scaled("150000000"), "1.5");
    }

    #[test]
    fn test_from_scaled_zero() {
        assert_eq!(from_scaled("0"), "0");
    }

    #[test]
    fn test_roundtrip() {
        let cases = vec!["0", "1", "1.5", "0.00000001", "999999.99999999"];
        for case in cases {
            let scaled = to_scaled(case);
            let back = from_scaled(&scaled);
            assert_eq!(back, case, "Roundtrip failed for {}", case);
        }
    }

    #[test]
    fn test_add_decimal() {
        assert_eq!(add_decimal("1.5", "2.5"), "4");
        assert_eq!(add_decimal("0.1", "0.2"), "0.3");
    }

    #[test]
    fn test_compare_decimal() {
        assert_eq!(compare_decimal("1.5", "1.5"), 0);
        assert_eq!(compare_decimal("2", "1"), 1);
        assert_eq!(compare_decimal("1", "2"), -1);
    }

    #[test]
    fn test_is_over_limit() {
        assert!(is_over_limit("2", "1"));
        assert!(!is_over_limit("1", "2"));
        assert!(!is_over_limit("1", "1"));
    }
}

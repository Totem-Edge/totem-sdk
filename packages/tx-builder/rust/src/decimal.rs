use num_bigint::BigInt;
use num_traits::Zero;
use std::str::FromStr;

const MINIMA_DECIMALS: u32 = 44;

fn scale() -> BigInt {
    BigInt::from(10u64).pow(MINIMA_DECIMALS)
}

fn is_valid_decimal(s: &str) -> bool {
    let bytes = s.as_bytes();
    if bytes.is_empty() {
        return false;
    }

    let mut i = 0;

    if bytes[0] == b'-' {
        i = 1;
        if i >= bytes.len() {
            return false;
        }
    }

    if bytes[i] == b'0' {
        i += 1;
    } else if bytes[i] >= b'1' && bytes[i] <= b'9' {
        i += 1;
        while i < bytes.len() && bytes[i] >= b'0' && bytes[i] <= b'9' {
            i += 1;
        }
    } else {
        return false;
    }

    if i < bytes.len() && bytes[i] == b'.' {
        i += 1;
        let frac_start = i;
        while i < bytes.len() && bytes[i] >= b'0' && bytes[i] <= b'9' {
            i += 1;
        }
        let frac_len = i - frac_start;
        if frac_len == 0 || frac_len > MINIMA_DECIMALS as usize {
            return false;
        }
    }

    i == bytes.len()
}

pub fn parse_decimal_to_bigint(value: &str) -> Result<BigInt, String> {
    let clean = value.trim();
    if clean.is_empty() {
        return Ok(BigInt::zero());
    }
    if !is_valid_decimal(clean) {
        return Err(format!("Invalid decimal format: \"{}\"", value));
    }

    let is_negative = clean.starts_with('-');
    let abs = if is_negative { &clean[1..] } else { clean };

    let parts: Vec<&str> = abs.split('.').collect();
    let int_part = if parts[0].is_empty() { "0" } else { parts[0] };
    let frac_part = if parts.len() > 1 { parts[1] } else { "" };

    let frac_padded = format!("{:0<width$}", frac_part, width = MINIMA_DECIMALS as usize);

    let int_big = BigInt::from_str(int_part)
        .map_err(|e| format!("Invalid integer part: {}", e))?;
    let frac_big = BigInt::from_str(&frac_padded)
        .map_err(|e| format!("Invalid fractional part: {}", e))?;

    let result = int_big * scale() + frac_big;
    Ok(if is_negative { -result } else { result })
}

pub fn bigint_to_decimal_string(value: &BigInt) -> String {
    let is_negative = *value < BigInt::zero();
    let abs_value = if is_negative {
        -value.clone()
    } else {
        value.clone()
    };

    let s = scale();
    let int_part = &abs_value / &s;
    let frac_part = &abs_value % &s;

    let frac_str = format!("{:0>width$}", frac_part.to_string(), width = MINIMA_DECIMALS as usize);
    let frac_trimmed = frac_str.trim_end_matches('0');

    let sign = if is_negative { "-" } else { "" };
    if frac_trimmed.is_empty() {
        format!("{}{}", sign, int_part)
    } else {
        format!("{}{}.{}", sign, int_part, frac_trimmed)
    }
}

pub fn add_decimal_strings(a: &str, b: &str) -> Result<String, String> {
    let big_a = parse_decimal_to_bigint(a)?;
    let big_b = parse_decimal_to_bigint(b)?;
    Ok(bigint_to_decimal_string(&(big_a + big_b)))
}

pub fn subtract_decimal_strings(a: &str, b: &str) -> Result<String, String> {
    let big_a = parse_decimal_to_bigint(a)?;
    let big_b = parse_decimal_to_bigint(b)?;
    Ok(bigint_to_decimal_string(&(big_a - big_b)))
}

pub fn compare_decimal(a: &str, b: &str) -> Result<i32, String> {
    let big_a = parse_decimal_to_bigint(a)?;
    let big_b = parse_decimal_to_bigint(b)?;
    use std::cmp::Ordering;
    Ok(match big_a.cmp(&big_b) {
        Ordering::Less => -1,
        Ordering::Equal => 0,
        Ordering::Greater => 1,
    })
}

pub fn is_positive(value: &str) -> Result<bool, String> {
    Ok(parse_decimal_to_bigint(value)? > BigInt::zero())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_zero() {
        let result = parse_decimal_to_bigint("0").unwrap();
        assert_eq!(result, BigInt::zero());
    }

    #[test]
    fn test_parse_simple() {
        let result = parse_decimal_to_bigint("1.5").unwrap();
        let expected = BigInt::from(15u64) * BigInt::from(10u64).pow(43);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_roundtrip() {
        let cases = vec!["0", "1", "1.5", "0.0001", "123456789.123456789", "1000000"];
        for case in cases {
            let big = parse_decimal_to_bigint(case).unwrap();
            let back = bigint_to_decimal_string(&big);
            assert_eq!(back, case, "Roundtrip failed for {}", case);
        }
    }

    #[test]
    fn test_negative() {
        let result = parse_decimal_to_bigint("-1.5").unwrap();
        let back = bigint_to_decimal_string(&result);
        assert_eq!(back, "-1.5");
    }

    #[test]
    fn test_add() {
        let result = add_decimal_strings("1.5", "2.5").unwrap();
        assert_eq!(result, "4");
    }

    #[test]
    fn test_subtract() {
        let result = subtract_decimal_strings("5", "1.5").unwrap();
        assert_eq!(result, "3.5");
    }

    #[test]
    fn test_compare() {
        assert_eq!(compare_decimal("1.5", "2.0").unwrap(), -1);
        assert_eq!(compare_decimal("2.0", "1.5").unwrap(), 1);
        assert_eq!(compare_decimal("1.0", "1.0").unwrap(), 0);
    }

    #[test]
    fn test_invalid() {
        assert!(parse_decimal_to_bigint("abc").is_err());
        assert!(parse_decimal_to_bigint("1.2.3").is_err());
    }
}

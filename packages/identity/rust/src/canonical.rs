use sha3::{Digest, Sha3_256};

pub fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

pub fn canonical_json(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "null".to_string(),
        serde_json::Value::Bool(b) => {
            if *b { "true".to_string() } else { "false".to_string() }
        }
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                i.to_string()
            } else if let Some(f) = n.as_f64() {
                if f.fract() == 0.0 {
                    format!("{:.1?}", f)
                } else {
                    format!("{}", f)
                }
            } else {
                n.to_string()
            }
        }
        serde_json::Value::String(s) => {
            serde_json::to_string(s).unwrap_or_else(|_| format!("\"{}\"", s))
        }
        serde_json::Value::Array(arr) => {
            let items: Vec<String> = arr.iter().map(canonical_json).collect();
            format!("[{}]", items.join(","))
        }
        serde_json::Value::Object(obj) => {
            let mut keys: Vec<&String> = obj.keys().collect();
            keys.sort();
            let pairs: Vec<String> = keys
                .into_iter()
                .map(|k| {
                    let key_escaped = serde_json::to_string(k).unwrap_or_else(|_| format!("\"{}\"", k));
                    format!("{}:{}", key_escaped, canonical_json(&obj[k]))
                })
                .collect();
            format!("{{{}}}", pairs.join(","))
        }
    }
}

pub fn claim_digest(claim: &serde_json::Value) -> Vec<u8> {
    let canonical = canonical_json(claim);
    let mut hasher = Sha3_256::new();
    hasher.update(canonical.as_bytes());
    hasher.finalize().to_vec()
}

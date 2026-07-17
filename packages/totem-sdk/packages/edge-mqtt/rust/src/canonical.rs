/// Canonical helpers and message codec — Rust/WASM port of canonical.ts.
///
/// Provides deterministic JSON canonicalization, SHA3-256 event ID computation,
/// and binary message encode/decode for MQTT edge messages.

use sha3::{Digest, Sha3_256};
use serde_json::{Value, Map};
use wasm_bindgen::prelude::*;

/// Convert bytes to lowercase hex string.
#[wasm_bindgen]
pub fn to_hex(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

/// Deterministic JSON canonicalization with sorted keys.
/// Strips undefined values (represented as null in JSON).
#[wasm_bindgen]
pub fn canonical_json(value: &JsValue) -> Result<String, JsValue> {
    let v: Value = serde_wasm_bindgen::from_value(value.clone())
        .map_err(|e| JsValue::from_str(&format!("JSON error: {}", e)))?;
    let canonical = sort_and_strip(v);
    serde_json::to_string(&canonical)
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))
}

fn sort_and_strip(v: Value) -> Value {
    match v {
        Value::Object(map) => {
            let mut sorted: Vec<(String, Value)> = map
                .into_iter()
                .filter(|(_, v)| !v.is_null())
                .map(|(k, v)| (k, sort_and_strip(v)))
                .collect();
            sorted.sort_by(|a, b| a.0.cmp(&b.0));
            Value::Object(sorted.into_iter().collect())
        }
        Value::Array(arr) => {
            Value::Array(arr.into_iter().map(sort_and_strip).collect())
        }
        other => other,
    }
}

/// Compute a content-addressed MQTT event ID.
/// Returns "mqtt:event:<hex_hash>"
#[wasm_bindgen]
pub fn compute_mqtt_event_id(event: &JsValue) -> Result<String, JsValue> {
    let json = canonical_json(event)?;
    let mut hasher = Sha3_256::new();
    hasher.update(json.as_bytes());
    let hash = hasher.finalize();
    Ok(format!("mqtt:event:{}", hex::encode(hash)))
}

/// Encode an MqttMessage to bytes for transport over arbitrary channels.
/// Payload is base64-encoded when it's bytes, kept as-is when it's a string.
#[wasm_bindgen]
pub fn encode_mqtt_edge_message(
    topic: &str,
    payload_str: Option<String>,
    payload_bytes: Option<Vec<u8>>,
    received_at: f64,
    qos: Option<u8>,
    retain: Option<bool>,
    properties: Option<JsValue>,
) -> Result<Vec<u8>, JsValue> {
    let mut map = Map::new();
    map.insert("topic".into(), Value::String(topic.to_string()));

    if let Some(s) = payload_str {
        map.insert("payload".into(), Value::String(s));
    } else if let Some(bytes) = payload_bytes {
        let mut payload_obj = Map::new();
        payload_obj.insert("__type".into(), Value::String("bytes".into()));
        payload_obj.insert("data".into(), Value::String(base64_encode(&bytes)));
        map.insert("payload".into(), Value::Object(payload_obj));
    } else {
        return Err(JsValue::from_str("payload is required"));
    }

    map.insert("receivedAt".into(), Value::Number(
        serde_json::Number::from_f64(received_at).unwrap_or(serde_json::Number::from(0))
    ));

    if let Some(q) = qos {
        map.insert("qos".into(), Value::Number(q.into()));
    }
    if let Some(r) = retain {
        map.insert("retain".into(), Value::Bool(r));
    }
    if let Some(props) = properties {
        let p: Value = serde_wasm_bindgen::from_value(props.clone())
            .map_err(|e| JsValue::from_str(&format!("properties error: {}", e)))?;
        map.insert("properties".into(), p);
    }

    let obj = Value::Object(map);
    let canonical = sort_and_strip(obj);
    let json = serde_json::to_string(&canonical)
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))?;
    Ok(json.into_bytes())
}

/// Decode bytes produced by encode_mqtt_edge_message back into a JS object.
#[wasm_bindgen]
pub fn decode_mqtt_edge_message(bytes: &[u8]) -> Result<JsValue, JsValue> {
    let text = std::str::from_utf8(bytes)
        .map_err(|_| JsValue::from_str("decodeMqttEdgeMessage: invalid UTF-8"))?;

    let obj: Value = serde_json::from_str(text)
        .map_err(|_| JsValue::from_str("decodeMqttEdgeMessage: invalid JSON"))?;

    let map = obj.as_object()
        .ok_or_else(|| JsValue::from_str("decodeMqttEdgeMessage: expected JSON object"))?;

    let topic = map.get("topic")
        .and_then(|v| v.as_str())
        .ok_or_else(|| JsValue::from_str("decodeMqttEdgeMessage: missing or invalid field \"topic\""))?;

    let received_at = map.get("receivedAt")
        .and_then(|v| v.as_f64())
        .ok_or_else(|| JsValue::from_str("decodeMqttEdgeMessage: missing or invalid field \"receivedAt\""))?;

    let payload_value = map.get("payload")
        .ok_or_else(|| JsValue::from_str("decodeMqttEdgeMessage: missing field \"payload\""))?;

    // Build result object
    let result = js_sys::Object::new();
    js_sys::Reflect::set(&result, &"topic".into(), &JsValue::from_str(topic)).unwrap();
    js_sys::Reflect::set(&result, &"receivedAt".into(), &JsValue::from_f64(received_at)).unwrap();

    // Handle payload
    if let Some(payload_obj) = payload_value.as_object() {
        if payload_obj.get("__type").and_then(|v| v.as_str()) == Some("bytes") {
            if let Some(data) = payload_obj.get("data").and_then(|v| v.as_str()) {
                let decoded = base64_decode(data)
                    .map_err(|e| JsValue::from_str(&e))?;
                let arr = js_sys::Uint8Array::new_with_length(decoded.len() as u32);
                arr.copy_from(&decoded);
                js_sys::Reflect::set(&result, &"payload".into(), &arr).unwrap();
            }
        } else {
            let payload_js = serde_wasm_bindgen::to_value(payload_value)
                .map_err(|e| JsValue::from_str(&format!("payload conversion error: {}", e)))?;
            js_sys::Reflect::set(&result, &"payload".into(), &payload_js).unwrap();
        }
    } else if let Some(s) = payload_value.as_str() {
        js_sys::Reflect::set(&result, &"payload".into(), &JsValue::from_str(s)).unwrap();
    } else {
        let payload_js = serde_wasm_bindgen::to_value(payload_value)
            .map_err(|e| JsValue::from_str(&format!("payload conversion error: {}", e)))?;
        js_sys::Reflect::set(&result, &"payload".into(), &payload_js).unwrap();
    }

    if let Some(qos) = map.get("qos").and_then(|v| v.as_u64()) {
        js_sys::Reflect::set(&result, &"qos".into(), &JsValue::from_f64(qos as f64)).unwrap();
    }
    if let Some(retain) = map.get("retain").and_then(|v| v.as_bool()) {
        js_sys::Reflect::set(&result, &"retain".into(), &JsValue::from_bool(retain)).unwrap();
    }
    if let Some(props) = map.get("properties") {
        let props_js = serde_wasm_bindgen::to_value(props)
            .map_err(|e| JsValue::from_str(&format!("properties conversion error: {}", e)))?;
        js_sys::Reflect::set(&result, &"properties".into(), &props_js).unwrap();
    }

    Ok(result.into())
}

fn base64_encode(data: &[u8]) -> String {
    // Simple base64 implementation
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

fn base64_decode(s: &str) -> Result<Vec<u8>, String> {
    let s = s.trim_end_matches('=');
    let mut result = Vec::new();
    let mut buffer: u32 = 0;
    let mut bits: u32 = 0;

    for ch in s.chars() {
        let val = match ch {
            'A'..='Z' => ch as u32 - 'A' as u32,
            'a'..='z' => ch as u32 - 'a' as u32 + 26,
            '0'..='9' => ch as u32 - '0' as u32 + 52,
            '+' => 62,
            '/' => 63,
            _ => return Err(format!("Invalid base64 character: {}", ch)),
        };
        buffer = (buffer << 6) | val;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            result.push((buffer >> bits) as u8);
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_hex() {
        assert_eq!(to_hex(&[0xab, 0xcd, 0xef]), "abcdef");
    }

    #[test]
    fn test_sort_and_strip() {
        let input = serde_json::json!({"z": "first", "a": "second", "n": null});
        let result = sort_and_strip(input);
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.starts_with("{\"a\":"));
        assert!(!json.contains("\"n\""));
    }

    #[test]
    fn test_base64_roundtrip() {
        let data = vec![0u8, 1, 2, 255, 254, 253];
        let encoded = base64_encode(&data);
        let decoded = base64_decode(&encoded).unwrap();
        assert_eq!(decoded, data);
    }

    #[test]
    fn test_base64_empty() {
        let encoded = base64_encode(&[]);
        assert_eq!(encoded, "");
        let decoded = base64_decode(&encoded).unwrap();
        assert!(decoded.is_empty());
    }
}

/// MQTT topic helpers — Rust/WASM port of topics.ts.
///
/// Provides default topic sets and MQTT wildcard matching (+ and #).

use wasm_bindgen::prelude::*;

/// Create default MQTT topic set for a device.
#[wasm_bindgen]
pub fn create_default_mqtt_topics(device_id: &str) -> JsValue {
    let obj = js_sys::Object::new();
    js_sys::Reflect::set(&obj, &"status".into(), &JsValue::from_str(&format!("totem/{}/status", device_id))).unwrap();
    js_sys::Reflect::set(&obj, &"manifest".into(), &JsValue::from_str(&format!("totem/{}/manifest", device_id))).unwrap();
    js_sys::Reflect::set(&obj, &"proofs".into(), &JsValue::from_str(&format!("totem/{}/proofs", device_id))).unwrap();
    js_sys::Reflect::set(&obj, &"receipts".into(), &JsValue::from_str(&format!("totem/{}/receipts", device_id))).unwrap();
    js_sys::Reflect::set(&obj, &"payments".into(), &JsValue::from_str(&format!("totem/{}/payments", device_id))).unwrap();
    js_sys::Reflect::set(&obj, &"commands".into(), &JsValue::from_str(&format!("totem/{}/commands", device_id))).unwrap();
    js_sys::Reflect::set(&obj, &"errors".into(), &JsValue::from_str(&format!("totem/{}/errors", device_id))).unwrap();
    obj.into()
}

/// Create a sensor topic string.
#[wasm_bindgen]
pub fn create_sensor_topic(device_id: &str, sensor_id: &str, kind: &str) -> String {
    format!("sensors/{}/{}/{}", device_id, sensor_id, kind)
}

/// Match an MQTT topic pattern against a concrete topic.
/// Supports + (single-level) and # (multi-level, must be last segment).
/// Returns { matched: boolean, params: Record<string, string> }
#[wasm_bindgen]
pub fn match_mqtt_topic(pattern: &str, topic: &str) -> JsValue {
    let pattern_segments: Vec<&str> = pattern.split('/').collect();
    let topic_segments: Vec<&str> = topic.split('/').collect();

    let params = js_sys::Object::new();
    let mut pi: usize = 0;
    let mut ti: usize = 0;

    while pi < pattern_segments.len() && ti < topic_segments.len() {
        let p = pattern_segments[pi];
        let t = topic_segments[ti];

        if p == "#" {
            let remaining = topic_segments[ti..].join("/");
            js_sys::Reflect::set(&params, &"#".into(), &JsValue::from_str(&remaining)).unwrap();
            let result = js_sys::Object::new();
            js_sys::Reflect::set(&result, &"matched".into(), &JsValue::from_bool(true)).unwrap();
            js_sys::Reflect::set(&result, &"params".into(), &params).unwrap();
            return result.into();
        } else if p == "+" {
            let key = format!("+{}", pi);
            js_sys::Reflect::set(&params, &JsValue::from_str(&key), &JsValue::from_str(t)).unwrap();
            pi += 1;
            ti += 1;
        } else if p == t {
            pi += 1;
            ti += 1;
        } else {
            let result = js_sys::Object::new();
            js_sys::Reflect::set(&result, &"matched".into(), &JsValue::from_bool(false)).unwrap();
            return result.into();
        }
    }

    if pi == pattern_segments.len() && ti == topic_segments.len() {
        let result = js_sys::Object::new();
        js_sys::Reflect::set(&result, &"matched".into(), &JsValue::from_bool(true)).unwrap();
        js_sys::Reflect::set(&result, &"params".into(), &params).unwrap();
        return result.into();
    }

    if pi < pattern_segments.len() && pattern_segments[pi] == "#" {
        js_sys::Reflect::set(&params, &"#".into(), &JsValue::from_str("")).unwrap();
        let result = js_sys::Object::new();
        js_sys::Reflect::set(&result, &"matched".into(), &JsValue::from_bool(true)).unwrap();
        js_sys::Reflect::set(&result, &"params".into(), &params).unwrap();
        return result.into();
    }

    let result = js_sys::Object::new();
    js_sys::Reflect::set(&result, &"matched".into(), &JsValue::from_bool(false)).unwrap();
    result.into()
}

#[cfg(test)]
#[cfg(target_arch = "wasm32")]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    fn get_matched(result: &JsValue) -> bool {
        js_sys::Reflect::get(result, &"matched".into())
            .unwrap()
            .as_bool()
            .unwrap()
    }

    #[wasm_bindgen_test]
    fn test_create_sensor_topic() {
        let topic = create_sensor_topic("dev1", "sensor1", "raw");
        assert_eq!(topic, "sensors/dev1/sensor1/raw");
    }

    #[wasm_bindgen_test]
    fn test_create_default_topics() {
        let topics = create_default_mqtt_topics("dev1");
        let status = js_sys::Reflect::get(&topics, &"status".into()).unwrap();
        assert_eq!(status.as_string().unwrap(), "totem/dev1/status");
    }

    #[wasm_bindgen_test]
    fn test_exact_match() {
        let r = match_mqtt_topic("sensors/device1/temp", "sensors/device1/temp");
        assert!(get_matched(&r));
    }

    #[wasm_bindgen_test]
    fn test_no_match() {
        let r = match_mqtt_topic("sensors/device1/temp", "sensors/device2/temp");
        assert!(!get_matched(&r));
    }

    #[wasm_bindgen_test]
    fn test_single_level_wildcard() {
        let r = match_mqtt_topic("sensors/+/temp", "sensors/device1/temp");
        assert!(get_matched(&r));
    }

    #[wasm_bindgen_test]
    fn test_multi_level_wildcard() {
        let r = match_mqtt_topic("sensors/device1/#", "sensors/device1/temp/humidity");
        assert!(get_matched(&r));
    }

    #[wasm_bindgen_test]
    fn test_hash_at_end_of_pattern() {
        let r = match_mqtt_topic("sensors/#", "sensors");
        assert!(get_matched(&r));
    }
}

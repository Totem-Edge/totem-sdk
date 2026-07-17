/// Rust/WASM helpers for @totemsdk/edge-mqtt.
///
/// Provides:
///   - canonical.rs  — deterministic JSON, SHA3 event IDs, message codec
///   - topics.rs     — MQTT wildcard matching, topic construction
///   - fixed_point.rs — MachinePay scaled integer arithmetic

pub mod canonical;
pub mod topics;
pub mod fixed_point;

use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn init() {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
}

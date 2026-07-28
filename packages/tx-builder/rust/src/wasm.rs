use wasm_bindgen::prelude::*;
use crate::coin_selection;
use crate::decimal;
use crate::multisig;
use crate::types::*;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn parse_decimal_to_bigint_wasm(value: &str) -> Result<String, JsValue> {
    decimal::parse_decimal_to_bigint(value)
        .map(|b| b.to_string())
        .map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn bigint_to_decimal_string_wasm(value: &str) -> Result<String, JsValue> {
    use num_bigint::BigInt;
    use std::str::FromStr;
    let big = BigInt::from_str(value)
        .map_err(|e| JsValue::from_str(&format!("Invalid bigint: {}", e)))?;
    Ok(decimal::bigint_to_decimal_string(&big))
}

#[wasm_bindgen]
pub fn add_decimal_strings_wasm(a: &str, b: &str) -> Result<String, JsValue> {
    decimal::add_decimal_strings(a, b).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn subtract_decimal_strings_wasm(a: &str, b: &str) -> Result<String, JsValue> {
    decimal::subtract_decimal_strings(a, b).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn compare_decimal_wasm(a: &str, b: &str) -> Result<i32, JsValue> {
    decimal::compare_decimal(a, b).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn is_positive_wasm(value: &str) -> Result<bool, JsValue> {
    decimal::is_positive(value).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn select_coins_wasm(
    coins_js: JsValue,
    options_js: JsValue,
    excluded_addresses_js: JsValue,
) -> Result<JsValue, JsValue> {
    let coins: Vec<SpendableCoin> = serde_wasm_bindgen::from_value(coins_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse coins: {}", e)))?;
    let options: CoinSelectionOptions = serde_wasm_bindgen::from_value(options_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse options: {}", e)))?;
    let excluded: Vec<String> = serde_wasm_bindgen::from_value(excluded_addresses_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse excluded addresses: {}", e)))?;

    let result = coin_selection::select_coins(&coins, &options, &excluded);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

#[wasm_bindgen]
pub fn order_coins_by_amount_wasm(coins_js: JsValue) -> Result<JsValue, JsValue> {
    let coins: Vec<SpendableCoin> = serde_wasm_bindgen::from_value(coins_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse coins: {}", e)))?;
    let result = coin_selection::order_coins_by_amount(&coins);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

#[wasm_bindgen]
pub fn sha3_256_hex_wasm(data: &[u8]) -> String {
    multisig::sha3_256_hex(data)
}

#[wasm_bindgen]
pub fn compute_multisig_address_wasm(config_js: JsValue) -> Result<JsValue, JsValue> {
    let config: MultisigConfig = serde_wasm_bindgen::from_value(config_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse config: {}", e)))?;
    let result = multisig::compute_multisig_address(&config)
        .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

#[wasm_bindgen]
pub fn recompute_digest_wasm(transaction_hex: &str) -> Result<String, JsValue> {
    multisig::recompute_digest(transaction_hex).map_err(|e| JsValue::from_str(&e))
}

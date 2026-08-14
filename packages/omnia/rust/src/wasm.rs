use wasm_bindgen::prelude::*;

use crate::capacity;
use crate::commitment;
use crate::persistence;
use crate::program;
use crate::script;
use crate::state_vars;
use crate::transition;
use crate::types::*;
use crate::validation;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

// ─── script ──────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn build_eltoo_script_wasm(parties_js: JsValue) -> Result<String, JsValue> {
    let parties: Vec<ChannelParticipant> = serde_wasm_bindgen::from_value(parties_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse parties: {}", e)))?;
    script::build_eltoo_script(&parties).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn normalize_script_wasm(script_str: &str) -> String {
    script::normalize_script(script_str)
}

// ─── capacity ────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn assess_capacity_wasm(used: u32) -> Result<JsValue, JsValue> {
    match capacity::assess_capacity(used) {
        Ok(assessment) => serde_wasm_bindgen::to_value(&assessment)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e))),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn flat_signing_index_wasm(l1: u32, l2: u32) -> u32 {
    capacity::flat_signing_index(l1, l2)
}

#[wasm_bindgen]
pub fn get_wots_capacity_total_wasm() -> u32 {
    capacity::WOTS_CAPACITY_TOTAL
}

// ─── commitment ──────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn compute_state_commitment_wasm(
    sequence: u32,
    balances_js: JsValue,
    pending_htlcs_js: JsValue,
) -> Result<Vec<u8>, JsValue> {
    let balances: std::collections::HashMap<String, String> =
        serde_wasm_bindgen::from_value(balances_js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse balances: {}", e)))?;
    let pending_htlcs: Vec<HTLCRecord> = serde_wasm_bindgen::from_value(pending_htlcs_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse HTLCs: {}", e)))?;
    Ok(commitment::compute_state_commitment(
        sequence,
        &balances,
        &pending_htlcs,
    ))
}

#[wasm_bindgen]
pub fn compute_tx_draft_digest_wasm(
    tx_type: &str,
    inputs_js: JsValue,
    outputs_js: JsValue,
    state_variables_js: JsValue,
) -> Result<Vec<u8>, JsValue> {
    let inputs: Vec<serde_json::Value> = serde_wasm_bindgen::from_value(inputs_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse inputs: {}", e)))?;
    let outputs: Vec<serde_json::Value> = serde_wasm_bindgen::from_value(outputs_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse outputs: {}", e)))?;
    let state_variables: Vec<serde_json::Value> =
        serde_wasm_bindgen::from_value(state_variables_js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse stateVariables: {}", e)))?;
    Ok(commitment::compute_tx_draft_digest(
        tx_type,
        &inputs,
        &outputs,
        &state_variables,
    ))
}

// ─── program transitions ────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn canonicalize_program_transition_wasm(transition_js: JsValue) -> Result<JsValue, JsValue> {
    let transition: ProgramTransition = serde_wasm_bindgen::from_value(transition_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse ProgramTransition: {}", e)))?;
    let canonical = transition::canonicalize_program_transition(Some(&transition))
        .map_err(|e| JsValue::from_str(&e))?
        .ok_or_else(|| JsValue::from_str("Invalid ProgramTransition: expected object"))?;
    serde_wasm_bindgen::to_value(&canonical)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn serialize_program_transition_wasm(transition_js: JsValue) -> Result<String, JsValue> {
    let transition: ProgramTransition = serde_wasm_bindgen::from_value(transition_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse ProgramTransition: {}", e)))?;
    transition::serialize_program_transition(&transition).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn validate_program_transition_wasm(transition_js: JsValue) -> Result<JsValue, JsValue> {
    let transition: ProgramTransition = serde_wasm_bindgen::from_value(transition_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse ProgramTransition: {}", e)))?;
    let result = match transition::validate_program_transition_shape(&transition) {
        Ok(()) => ValidationResult {
            valid: true,
            reason: None,
        },
        Err(reason) => ValidationResult {
            valid: false,
            reason: Some(reason),
        },
    };
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

// ─── program state variables ─────────────────────────────────────────────────

#[wasm_bindgen]
pub fn assert_program_state_port_wasm(port: u32) -> Result<bool, JsValue> {
    state_vars::assert_program_state_port(port)
        .map(|_| true)
        .map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn get_state_bigint_wasm(
    state_js: JsValue,
    port: u32,
    fallback: &str,
) -> Result<String, JsValue> {
    let state: Option<SignedChannelState> = if state_js.is_null() || state_js.is_undefined() {
        None
    } else {
        Some(serde_wasm_bindgen::from_value(state_js).map_err(|e| {
            JsValue::from_str(&format!("Failed to parse SignedChannelState: {}", e))
        })?)
    };
    let fallback = fallback
        .parse::<i128>()
        .map_err(|e| JsValue::from_str(&format!("Invalid fallback: {}", e)))?;
    state_vars::get_state_bigint(state.as_ref(), port, fallback)
        .map(|value| value.to_string())
        .map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn program_number_state_wasm(port: u32, value: &str) -> Result<JsValue, JsValue> {
    let value = value
        .parse::<i128>()
        .map_err(|e| JsValue::from_str(&format!("Invalid value: {}", e)))?;
    let state = state_vars::program_number_state(port, value).map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&state)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

// ─── built-in programs ───────────────────────────────────────────────────────

fn parse_optional_state(value: JsValue) -> Result<Option<SignedChannelState>, JsValue> {
    if value.is_null() || value.is_undefined() {
        return Ok(None);
    }
    serde_wasm_bindgen::from_value(value)
        .map(Some)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse SignedChannelState: {}", e)))
}

fn parse_optional_transition(value: JsValue) -> Result<Option<ProgramTransition>, JsValue> {
    if value.is_null() || value.is_undefined() {
        return Ok(None);
    }
    serde_wasm_bindgen::from_value(value)
        .map(Some)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse ProgramTransition: {}", e)))
}

#[wasm_bindgen]
pub fn default_eltoo_payment_state_variables_wasm() -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(&program::default_eltoo_payment_state_variables())
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn build_counter_state_variables_wasm(
    previous_state_js: JsValue,
    transition_js: JsValue,
) -> Result<JsValue, JsValue> {
    let previous_state = parse_optional_state(previous_state_js)?;
    let transition = parse_optional_transition(transition_js)?;
    let state_variables =
        program::build_counter_state_variables(previous_state.as_ref(), transition.as_ref())
            .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&state_variables)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn validate_counter_transition_wasm(
    previous_state_js: JsValue,
    next_state_js: JsValue,
    transition_js: JsValue,
) -> Result<JsValue, JsValue> {
    let previous_state = parse_optional_state(previous_state_js)?;
    let next_state: SignedChannelState = serde_wasm_bindgen::from_value(next_state_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse SignedChannelState: {}", e)))?;
    let transition = parse_optional_transition(transition_js)?;
    let result = program::validate_counter_transition(
        previous_state.as_ref(),
        &next_state,
        transition.as_ref(),
    );
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn build_meter_state_variables_wasm(
    previous_state_js: JsValue,
    transition_js: JsValue,
) -> Result<JsValue, JsValue> {
    let previous_state = parse_optional_state(previous_state_js)?;
    let transition = parse_optional_transition(transition_js)?;
    let state_variables =
        program::build_meter_state_variables(previous_state.as_ref(), transition.as_ref())
            .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&state_variables)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn validate_meter_transition_wasm(
    channel_js: JsValue,
    previous_state_js: JsValue,
    next_state_js: JsValue,
    transition_js: JsValue,
) -> Result<JsValue, JsValue> {
    let channel: OmniaChannel = serde_wasm_bindgen::from_value(channel_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse channel: {}", e)))?;
    let previous_state = parse_optional_state(previous_state_js)?;
    let next_state: SignedChannelState = serde_wasm_bindgen::from_value(next_state_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse SignedChannelState: {}", e)))?;
    let transition = parse_optional_transition(transition_js)?;
    let result = program::validate_meter_transition(
        &channel,
        previous_state.as_ref(),
        &next_state,
        transition.as_ref(),
    );
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

// ─── RFC-003 built-in programs ───────────────────────────────────────────────

#[wasm_bindgen]
pub fn build_htlc_state_variables_wasm(
    previous_state_js: JsValue,
    transition_js: JsValue,
) -> Result<JsValue, JsValue> {
    let previous_state = parse_optional_state(previous_state_js)?;
    let transition = parse_optional_transition(transition_js)?;
    let state_variables =
        program::build_htlc_state_variables(previous_state.as_ref(), transition.as_ref())
            .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&state_variables)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn validate_htlc_transition_wasm(
    previous_state_js: JsValue,
    next_state_js: JsValue,
    transition_js: JsValue,
) -> Result<JsValue, JsValue> {
    let previous_state = parse_optional_state(previous_state_js)?;
    let next_state: SignedChannelState = serde_wasm_bindgen::from_value(next_state_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse SignedChannelState: {}", e)))?;
    let transition = parse_optional_transition(transition_js)?;
    let result = program::validate_htlc_transition(
        previous_state.as_ref(),
        &next_state,
        transition.as_ref(),
    );
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn build_vault_state_variables_wasm(
    previous_state_js: JsValue,
    transition_js: JsValue,
) -> Result<JsValue, JsValue> {
    let previous_state = parse_optional_state(previous_state_js)?;
    let transition = parse_optional_transition(transition_js)?;
    let state_variables =
        program::build_vault_state_variables(previous_state.as_ref(), transition.as_ref())
            .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&state_variables)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn validate_vault_transition_wasm(
    previous_state_js: JsValue,
    next_state_js: JsValue,
    transition_js: JsValue,
) -> Result<JsValue, JsValue> {
    let previous_state = parse_optional_state(previous_state_js)?;
    let next_state: SignedChannelState = serde_wasm_bindgen::from_value(next_state_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse SignedChannelState: {}", e)))?;
    let transition = parse_optional_transition(transition_js)?;
    let result = program::validate_vault_transition(
        previous_state.as_ref(),
        &next_state,
        transition.as_ref(),
    );
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn build_treasury_state_variables_wasm(
    previous_state_js: JsValue,
    transition_js: JsValue,
) -> Result<JsValue, JsValue> {
    let previous_state = parse_optional_state(previous_state_js)?;
    let transition = parse_optional_transition(transition_js)?;
    let state_variables =
        program::build_treasury_state_variables(previous_state.as_ref(), transition.as_ref())
            .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&state_variables)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn validate_treasury_transition_wasm(
    previous_state_js: JsValue,
    next_state_js: JsValue,
    transition_js: JsValue,
) -> Result<JsValue, JsValue> {
    let previous_state = parse_optional_state(previous_state_js)?;
    let next_state: SignedChannelState = serde_wasm_bindgen::from_value(next_state_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse SignedChannelState: {}", e)))?;
    let transition = parse_optional_transition(transition_js)?;
    let result = program::validate_treasury_transition(
        previous_state.as_ref(),
        &next_state,
        transition.as_ref(),
    );
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn build_membership_state_variables_wasm(
    previous_state_js: JsValue,
    transition_js: JsValue,
) -> Result<JsValue, JsValue> {
    let previous_state = parse_optional_state(previous_state_js)?;
    let transition = parse_optional_transition(transition_js)?;
    let state_variables =
        program::build_membership_state_variables(previous_state.as_ref(), transition.as_ref())
            .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&state_variables)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn validate_membership_transition_wasm(
    previous_state_js: JsValue,
    next_state_js: JsValue,
    transition_js: JsValue,
) -> Result<JsValue, JsValue> {
    let previous_state = parse_optional_state(previous_state_js)?;
    let next_state: SignedChannelState = serde_wasm_bindgen::from_value(next_state_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse SignedChannelState: {}", e)))?;
    let transition = parse_optional_transition(transition_js)?;
    let result = program::validate_membership_transition(
        previous_state.as_ref(),
        &next_state,
        transition.as_ref(),
    );
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn build_asset_state_variables_wasm(
    previous_state_js: JsValue,
    transition_js: JsValue,
) -> Result<JsValue, JsValue> {
    let previous_state = parse_optional_state(previous_state_js)?;
    let transition = parse_optional_transition(transition_js)?;
    let state_variables =
        program::build_asset_state_variables(previous_state.as_ref(), transition.as_ref())
            .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&state_variables)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn validate_asset_transition_wasm(
    previous_state_js: JsValue,
    next_state_js: JsValue,
    transition_js: JsValue,
) -> Result<JsValue, JsValue> {
    let previous_state = parse_optional_state(previous_state_js)?;
    let next_state: SignedChannelState = serde_wasm_bindgen::from_value(next_state_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse SignedChannelState: {}", e)))?;
    let transition = parse_optional_transition(transition_js)?;
    let result = program::validate_asset_transition(
        previous_state.as_ref(),
        &next_state,
        transition.as_ref(),
    );
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

// ─── persistence and recovery ────────────────────────────────────────────────

#[wasm_bindgen]
pub fn snapshot_channel_wasm(channel_js: JsValue, saved_at: u64) -> Result<JsValue, JsValue> {
    let channel: OmniaChannel = serde_wasm_bindgen::from_value(channel_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse channel: {}", e)))?;
    serde_wasm_bindgen::to_value(&persistence::snapshot_channel(&channel, saved_at))
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn serialize_channel_snapshot_wasm(snapshot_js: JsValue) -> Result<String, JsValue> {
    let snapshot: persistence::OmniaChannelSnapshot =
        serde_wasm_bindgen::from_value(snapshot_js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse snapshot: {}", e)))?;
    persistence::serialize_channel_snapshot(&snapshot).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn deserialize_channel_snapshot_wasm(json: &str) -> Result<JsValue, JsValue> {
    let snapshot =
        persistence::deserialize_channel_snapshot(json).map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&snapshot)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn recover_channel_snapshot_wasm(snapshot_js: JsValue) -> Result<JsValue, JsValue> {
    let result = if let Some(json) = snapshot_js.as_string() {
        persistence::recover_channel_snapshot_from_json(&json)
    } else {
        let value: serde_json::Value = serde_wasm_bindgen::from_value(snapshot_js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse snapshot: {}", e)))?;
        let snapshot = persistence::deserialize_channel_snapshot_value(value)
            .map_err(|e| JsValue::from_str(&e))?;
        persistence::recover_channel_snapshot(snapshot)
    }
    .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn recover_channel_wasm(json_or_snapshot: JsValue) -> Result<JsValue, JsValue> {
    let channel = if let Some(json) = json_or_snapshot.as_string() {
        persistence::recover_channel(&json)
    } else {
        let value: serde_json::Value = serde_wasm_bindgen::from_value(json_or_snapshot)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse snapshot: {}", e)))?;
        let snapshot = persistence::deserialize_channel_snapshot_value(value)
            .map_err(|e| JsValue::from_str(&e))?;
        persistence::recover_channel_snapshot(snapshot).map(|result| result.channel)
    }
    .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&channel)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

// ─── validation ──────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn validate_balance_conservation_wasm(
    total_value: &str,
    balances_js: JsValue,
    pending_htlcs_js: JsValue,
) -> Result<JsValue, JsValue> {
    let balances: std::collections::HashMap<String, String> =
        serde_wasm_bindgen::from_value(balances_js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse balances: {}", e)))?;
    let pending_htlcs: Vec<HTLCRecord> = serde_wasm_bindgen::from_value(pending_htlcs_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse HTLCs: {}", e)))?;
    let result = validation::validate_balance_conservation(total_value, &balances, &pending_htlcs);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn validate_complete_channel_state_wasm(
    channel_js: JsValue,
    state_js: JsValue,
) -> Result<JsValue, JsValue> {
    let channel: OmniaChannel = serde_wasm_bindgen::from_value(channel_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse channel: {}", e)))?;
    let state: SignedChannelState = serde_wasm_bindgen::from_value(state_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse state: {}", e)))?;
    let result = validation::validate_complete_channel_state(&channel, &state);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn verify_state_wasm(
    channel_js: JsValue,
    state_js: JsValue,
    verify_sig_js: JsValue,
) -> Result<JsValue, JsValue> {
    let channel: OmniaChannel = serde_wasm_bindgen::from_value(channel_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse channel: {}", e)))?;
    let state: SignedChannelState = serde_wasm_bindgen::from_value(state_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse state: {}", e)))?;

    let verify_fn = js_sys::Function::from(verify_sig_js);
    let sig_verifier = move |sig: &str, commitment: &[u8], pkd: &str| -> bool {
        let this = JsValue::NULL;
        let args = js_sys::Array::new();
        args.push(&JsValue::from_str(sig));
        args.push(&JsValue::from_str(&hex::encode(commitment)));
        args.push(&JsValue::from_str(pkd));
        match verify_fn.call1(&this, &args) {
            Ok(result) => result.as_bool().unwrap_or(false),
            Err(_) => false,
        }
    };

    let result = validation::verify_state(&channel, &state, &sig_verifier);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn validate_state_transition_wasm(
    channel_js: JsValue,
    new_sequence: u32,
    new_balances_js: JsValue,
    pending_htlc_delta: &str,
) -> Result<JsValue, JsValue> {
    let channel: OmniaChannel = serde_wasm_bindgen::from_value(channel_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse channel: {}", e)))?;
    let new_balances: std::collections::HashMap<String, String> =
        serde_wasm_bindgen::from_value(new_balances_js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse balances: {}", e)))?;
    match validation::validate_state_transition(
        &channel,
        new_sequence,
        &new_balances,
        pending_htlc_delta,
    ) {
        Ok(()) => Ok(JsValue::from_bool(true)),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn verify_htlc_preimage_wasm(preimage: &str, hashlock: &str) -> bool {
    validation::verify_htlc_preimage(preimage, hashlock)
}

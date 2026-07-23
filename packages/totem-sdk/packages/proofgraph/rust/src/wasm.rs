use wasm_bindgen::prelude::*;

use crate::canonical;
use crate::graph;
use crate::query;
use crate::types::*;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn to_hex_wasm(bytes: &[u8]) -> String {
    canonical::to_hex(bytes)
}

#[wasm_bindgen]
pub fn canonical_json_wasm(value_js: JsValue) -> Result<String, JsValue> {
    let v: serde_json::Value = serde_wasm_bindgen::from_value(value_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    Ok(canonical::canonical_json(&v))
}

#[wasm_bindgen]
pub fn compute_node_id_wasm(node_type: &str, ref_id: &str) -> String {
    canonical::compute_node_id(node_type, ref_id)
}

#[wasm_bindgen]
pub fn compute_edge_id_wasm(
    edge_type: &str,
    from: &str,
    to: &str,
    proof_id: Option<String>,
    data_js: Option<JsValue>,
) -> Result<String, JsValue> {
    let data: Option<serde_json::Value> = match data_js {
        Some(js) => Some(serde_wasm_bindgen::from_value(js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse data: {}", e)))?),
        None => None,
    };
    Ok(canonical::compute_edge_id(edge_type, from, to, proof_id.as_deref(), data.as_ref()))
}

#[wasm_bindgen]
pub fn compute_proof_graph_id_wasm(nodes_js: JsValue, edges_js: JsValue) -> Result<String, JsValue> {
    let nodes: Vec<ProofGraphNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse nodes: {}", e)))?;
    let edges: Vec<ProofGraphEdge> = serde_wasm_bindgen::from_value(edges_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse edges: {}", e)))?;
    Ok(canonical::compute_proof_graph_id(&nodes, &edges))
}

#[wasm_bindgen]
pub fn create_proof_graph_wasm(
    metadata_js: Option<JsValue>,
    created_at: u64,
) -> Result<JsValue, JsValue> {
    let metadata: Option<std::collections::HashMap<String, serde_json::Value>> = match metadata_js {
        Some(js) => Some(serde_wasm_bindgen::from_value(js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse metadata: {}", e)))?),
        None => None,
    };
    let g = graph::create_proof_graph(metadata, created_at);
    serde_wasm_bindgen::to_value(&g)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn add_node_wasm(
    graph_js: JsValue,
    node_type: &str,
    ref_id: &str,
    data_js: Option<JsValue>,
    created_at: u64,
) -> Result<JsValue, JsValue> {
    let g: ProofGraph = serde_wasm_bindgen::from_value(graph_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse graph: {}", e)))?;
    let data: Option<std::collections::HashMap<String, serde_json::Value>> = match data_js {
        Some(js) => Some(serde_wasm_bindgen::from_value(js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse data: {}", e)))?),
        None => None,
    };
    let result = graph::add_node(&g, node_type, ref_id, data, created_at);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn add_edge_wasm(graph_js: JsValue, edge_js: JsValue) -> Result<JsValue, JsValue> {
    let g: ProofGraph = serde_wasm_bindgen::from_value(graph_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse graph: {}", e)))?;
    let edge: ProofGraphEdge = serde_wasm_bindgen::from_value(edge_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse edge: {}", e)))?;
    let result = graph::add_edge(&g, &edge);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn find_node_wasm(graph_js: JsValue, id: &str) -> Result<JsValue, JsValue> {
    let g: ProofGraph = serde_wasm_bindgen::from_value(graph_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse graph: {}", e)))?;
    match query::find_node(&g, id) {
        Some(node) => serde_wasm_bindgen::to_value(node)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e))),
        None => Ok(JsValue::NULL),
    }
}

#[wasm_bindgen]
pub fn get_edges_from_wasm(graph_js: JsValue, node_id: &str) -> Result<JsValue, JsValue> {
    let g: ProofGraph = serde_wasm_bindgen::from_value(graph_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse graph: {}", e)))?;
    let edges = query::get_edges_from(&g, node_id);
    serde_wasm_bindgen::to_value(&edges)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn find_proofs_by_subject_wasm(graph_js: JsValue, subject_id: &str) -> Result<JsValue, JsValue> {
    let g: ProofGraph = serde_wasm_bindgen::from_value(graph_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse graph: {}", e)))?;
    let proofs = query::find_proofs_by_subject(&g, subject_id);
    serde_wasm_bindgen::to_value(&proofs)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn resolve_current_proof_set_wasm(graph_js: JsValue) -> Result<JsValue, JsValue> {
    let g: ProofGraph = serde_wasm_bindgen::from_value(graph_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse graph: {}", e)))?;
    let proofs = query::resolve_current_proof_set(&g);
    serde_wasm_bindgen::to_value(&proofs)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn reachable_from_wasm(graph_js: JsValue, start_ref_id: &str) -> Result<JsValue, JsValue> {
    let g: ProofGraph = serde_wasm_bindgen::from_value(graph_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse graph: {}", e)))?;
    let reachable = query::reachable_from(&g, start_ref_id);
    serde_wasm_bindgen::to_value(&reachable)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

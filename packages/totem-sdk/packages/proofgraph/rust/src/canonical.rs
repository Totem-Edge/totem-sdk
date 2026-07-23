use sha3::{Digest, Sha3_256};

use crate::types::{ProofGraphEdge, ProofGraphNode};

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

pub fn compute_node_id(node_type: &str, ref_id: &str) -> String {
    format!("{}:{}", node_type, ref_id)
}

pub fn compute_edge_id(
    edge_type: &str,
    from: &str,
    to: &str,
    proof_id: Option<&str>,
    data: Option<&serde_json::Value>,
) -> String {
    let data_hash = {
        let d = data.cloned().unwrap_or(serde_json::Value::Object(serde_json::Map::new()));
        let mut hasher = Sha3_256::new();
        hasher.update(canonical_json(&d).as_bytes());
        to_hex(&hasher.finalize())
    };
    let input = format!(
        "totem-proofgraph-edge{}{}{}{}{}",
        edge_type, from, to, proof_id.unwrap_or(""), data_hash
    );
    let mut hasher = Sha3_256::new();
    hasher.update(input.as_bytes());
    to_hex(&hasher.finalize())
}

fn node_for_hashing(node: &ProofGraphNode) -> serde_json::Value {
    serde_json::json!({
        "id": node.id,
        "type": node.node_type,
        "refId": node.ref_id,
        "data": node.data,
    })
}

pub fn compute_proof_graph_id(nodes: &[ProofGraphNode], edges: &[ProofGraphEdge]) -> String {
    let mut sorted_nodes: Vec<&ProofGraphNode> = nodes.iter().collect();
    sorted_nodes.sort_by(|a, b| a.id.cmp(&b.id));
    let node_hashes: Vec<serde_json::Value> = sorted_nodes.iter().map(|n| node_for_hashing(n)).collect();

    let mut sorted_edges: Vec<&ProofGraphEdge> = edges.iter().collect();
    sorted_edges.sort_by(|a, b| a.id.cmp(&b.id));

    let input = format!(
        "totem-proofgraph{}{}",
        canonical_json(&serde_json::Value::Array(node_hashes)),
        canonical_json(&serde_json::to_value(sorted_edges).unwrap_or_default())
    );
    let mut hasher = Sha3_256::new();
    hasher.update(input.as_bytes());
    to_hex(&hasher.finalize())
}

pub fn recompute_graph_id(nodes: &[ProofGraphNode], edges: &[ProofGraphEdge]) -> String {
    compute_proof_graph_id(nodes, edges)
}

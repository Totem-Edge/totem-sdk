use std::collections::HashMap;

use crate::canonical::{compute_node_id, compute_proof_graph_id};
use crate::types::{ProofGraph, ProofGraphEdge, ProofGraphNode};

fn make_node(node_type: &str, ref_id: &str, data: Option<HashMap<String, serde_json::Value>>, created_at: u64) -> ProofGraphNode {
    ProofGraphNode {
        id: compute_node_id(node_type, ref_id),
        node_type: node_type.to_string(),
        ref_id: ref_id.to_string(),
        data,
        created_at,
    }
}

fn merge_nodes(existing: &[ProofGraphNode], incoming: &[ProofGraphNode]) -> Vec<ProofGraphNode> {
    let mut by_id: HashMap<String, ProofGraphNode> = existing.iter().map(|n| (n.id.clone(), n.clone())).collect();
    for node in incoming {
        by_id.entry(node.id.clone()).or_insert_with(|| node.clone());
    }
    let mut result: Vec<ProofGraphNode> = by_id.into_values().collect();
    result.sort_by(|a, b| a.id.cmp(&b.id));
    result
}

fn merge_edges(existing: &[ProofGraphEdge], incoming: &[ProofGraphEdge]) -> Vec<ProofGraphEdge> {
    let mut by_id: HashMap<String, ProofGraphEdge> = existing.iter().map(|e| (e.id.clone(), e.clone())).collect();
    for edge in incoming {
        by_id.entry(edge.id.clone()).or_insert_with(|| edge.clone());
    }
    let mut result: Vec<ProofGraphEdge> = by_id.into_values().collect();
    result.sort_by(|a, b| a.id.cmp(&b.id));
    result
}

fn rebuild(graph: &ProofGraph, new_nodes: &[ProofGraphNode], new_edges: &[ProofGraphEdge]) -> ProofGraph {
    let nodes = merge_nodes(&graph.nodes, new_nodes);
    let edges = merge_edges(&graph.edges, new_edges);
    ProofGraph {
        graph_id: compute_proof_graph_id(&nodes, &edges),
        nodes,
        edges,
        created_at: graph.created_at,
        metadata: graph.metadata.clone(),
    }
}

pub fn create_proof_graph(metadata: Option<HashMap<String, serde_json::Value>>, created_at: u64) -> ProofGraph {
    let nodes: Vec<ProofGraphNode> = Vec::new();
    let edges: Vec<ProofGraphEdge> = Vec::new();
    ProofGraph {
        graph_id: compute_proof_graph_id(&nodes, &edges),
        nodes,
        edges,
        created_at,
        metadata,
    }
}

pub fn add_node(
    graph: &ProofGraph,
    node_type: &str,
    ref_id: &str,
    data: Option<HashMap<String, serde_json::Value>>,
    created_at: u64,
) -> ProofGraph {
    rebuild(graph, &[make_node(node_type, ref_id, data, created_at)], &[])
}

pub fn add_edge(graph: &ProofGraph, edge: &ProofGraphEdge) -> ProofGraph {
    let edges = merge_edges(&graph.edges, &[edge.clone()]);
    ProofGraph {
        graph_id: compute_proof_graph_id(&graph.nodes, &edges),
        nodes: graph.nodes.clone(),
        edges,
        created_at: graph.created_at,
        metadata: graph.metadata.clone(),
    }
}

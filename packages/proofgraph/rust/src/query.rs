use crate::types::{ProofGraph, ProofGraphEdge, ProofGraphNode};

pub fn find_node<'a>(graph: &'a ProofGraph, id: &str) -> Option<&'a ProofGraphNode> {
    graph.nodes.iter().find(|n| n.id == id || n.ref_id == id)
}

pub fn get_edges_from<'a>(graph: &'a ProofGraph, node_id_or_ref_id: &str) -> Vec<&'a ProofGraphEdge> {
    let node = find_node(graph, node_id_or_ref_id);
    match node {
        Some(n) => graph.edges.iter().filter(|e| e.from == n.ref_id).collect(),
        None => Vec::new(),
    }
}

pub fn get_edges_to<'a>(graph: &'a ProofGraph, node_id_or_ref_id: &str) -> Vec<&'a ProofGraphEdge> {
    let node = find_node(graph, node_id_or_ref_id);
    match node {
        Some(n) => graph.edges.iter().filter(|e| e.to == n.ref_id).collect(),
        None => Vec::new(),
    }
}

pub fn get_edges_by_type<'a>(graph: &'a ProofGraph, edge_type: &str) -> Vec<&'a ProofGraphEdge> {
    graph.edges.iter().filter(|e| e.edge_type == edge_type).collect()
}

pub fn get_proof_nodes(graph: &ProofGraph) -> Vec<&ProofGraphNode> {
    graph.nodes.iter().filter(|n| n.node_type == "proof").collect()
}

pub fn find_proofs_by_subject<'a>(graph: &'a ProofGraph, subject_id: &str) -> Vec<&'a ProofGraphNode> {
    let relevant_edges: Vec<&ProofGraphEdge> = graph
        .edges
        .iter()
        .filter(|e| (e.edge_type == "about" || e.edge_type == "proves") && e.to == subject_id)
        .collect();
    let proof_ref_ids: std::collections::HashSet<&str> = relevant_edges.iter().map(|e| e.from.as_str()).collect();
    graph.nodes.iter().filter(|n| proof_ref_ids.contains(n.ref_id.as_str()) && n.node_type == "proof").collect()
}

pub fn find_proofs_by_issuer<'a>(graph: &'a ProofGraph, issuer_id: &str) -> Vec<&'a ProofGraphNode> {
    let issued_edges: Vec<&ProofGraphEdge> = graph
        .edges
        .iter()
        .filter(|e| e.edge_type == "issued_by" && e.to == issuer_id)
        .collect();
    let proof_ref_ids: std::collections::HashSet<&str> = issued_edges.iter().map(|e| e.from.as_str()).collect();
    graph.nodes.iter().filter(|n| proof_ref_ids.contains(n.ref_id.as_str()) && n.node_type == "proof").collect()
}

pub fn find_revocations<'a>(graph: &'a ProofGraph, proof_id: &str) -> Vec<&'a ProofGraphEdge> {
    graph.edges.iter().filter(|e| e.edge_type == "revokes" && e.to == proof_id).collect()
}

pub fn resolve_current_proof_set(graph: &ProofGraph) -> Vec<&ProofGraphNode> {
    let mut superseded_or_revoked: std::collections::HashSet<&str> = std::collections::HashSet::new();
    for edge in &graph.edges {
        if edge.edge_type == "revokes" || edge.edge_type == "supersedes" {
            superseded_or_revoked.insert(edge.to.as_str());
        }
    }
    graph.nodes.iter().filter(|n| n.node_type == "proof" && !superseded_or_revoked.contains(n.ref_id.as_str())).collect()
}

pub fn reachable_from(graph: &ProofGraph, start_ref_id: &str) -> Vec<String> {
    let mut visited: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut stack: Vec<String> = vec![start_ref_id.to_string()];
    visited.insert(start_ref_id.to_string());

    while let Some(current) = stack.pop() {
        for edge in &graph.edges {
            if edge.from == current && !visited.contains(&edge.to) {
                visited.insert(edge.to.clone());
                stack.push(edge.to.clone());
            }
        }
    }

    let mut result: Vec<String> = visited.into_iter().collect();
    result.sort();
    result
}

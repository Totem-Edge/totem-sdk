use sha3::{Digest, Sha3_256};
use std::collections::HashMap;

use crate::types::{PolicyNode, PolicyNodeInput, PolicyTree};

fn hash_script(script: &str) -> String {
    let mut hasher = Sha3_256::new();
    hasher.update(script.as_bytes());
    hex::encode(hasher.finalize())
}

fn compute_policy_root(scripts: &[String]) -> String {
    if scripts.is_empty() {
        return hash_script("");
    }
    if scripts.len() == 1 {
        return hash_script(&scripts[0]);
    }
    let leaves: Vec<Vec<u8>> = scripts
        .iter()
        .map(|s| {
            let mut h = Sha3_256::new();
            h.update(s.as_bytes());
            h.finalize().to_vec()
        })
        .collect();
    build_merkle_root(&leaves)
}

fn build_merkle_root(leaves: &[Vec<u8>]) -> String {
    if leaves.is_empty() {
        let mut h = Sha3_256::new();
        h.update(&[]);
        return hex::encode(h.finalize());
    }
    if leaves.len() == 1 {
        return hex::encode(&leaves[0]);
    }

    let mut level: Vec<Vec<u8>> = leaves.to_vec();
    while level.len() > 1 {
        let mut next: Vec<Vec<u8>> = Vec::new();
        for i in (0..level.len()).step_by(2) {
            let left = &level[i];
            let right = if i + 1 < level.len() {
                &level[i + 1]
            } else {
                left
            };
            let mut pair = Vec::with_capacity(left.len() + right.len());
            pair.extend_from_slice(left);
            pair.extend_from_slice(right);
            let mut h = Sha3_256::new();
            h.update(&pair);
            next.push(h.finalize().to_vec());
        }
        level = next;
    }
    hex::encode(&level[0])
}

pub fn build_policy_tree(nodes: &[PolicyNodeInput]) -> Result<PolicyTree, String> {
    let mut children_map: HashMap<String, Vec<&PolicyNodeInput>> = HashMap::new();
    for node in nodes {
        let parent_key = node.parent_id.clone().unwrap_or_default();
        children_map.entry(parent_key).or_default().push(node);
    }

    let mut node_map: HashMap<String, PolicyNode> = HashMap::new();

    fn build_node(
        input: &PolicyNodeInput,
        children_map: &HashMap<String, Vec<&PolicyNodeInput>>,
        node_map: &mut HashMap<String, PolicyNode>,
    ) -> PolicyNode {
        let child_inputs = children_map.get(&input.id).cloned().unwrap_or_default();
        let children: Vec<PolicyNode> = child_inputs.iter().map(|ci| build_node(ci, children_map, node_map)).collect();

        let mut all_scripts: Vec<String> = vec![input.script.clone()];
        for child in &children {
            all_scripts.push(child.script.clone());
        }
        let policy_root = compute_policy_root(&all_scripts);

        let node = PolicyNode {
            id: input.id.clone(),
            name: input.name.clone(),
            script_hash: hash_script(&input.script),
            script: input.script.clone(),
            policy_root,
            children,
            parent_id: input.parent_id.clone(),
            metadata: input.metadata.clone(),
        };
        node_map.insert(input.id.clone(), node.clone());
        node
    }

    let root_inputs = children_map.get("").cloned().unwrap_or_default();
    if root_inputs.is_empty() {
        return Err("No root node found (node with no parentId)".to_string());
    }
    if root_inputs.len() > 1 {
        return Err("Multiple root nodes found — policy tree must have a single root".to_string());
    }

    let root = build_node(root_inputs[0], &children_map, &mut node_map);

    fn max_depth(node: &PolicyNode) -> u32 {
        if node.children.is_empty() {
            return 1;
        }
        1 + node.children.iter().map(max_depth).max().unwrap_or(0)
    }

    Ok(PolicyTree {
        depth: max_depth(&root),
        node_count: node_map.len() as u32,
        root,
        node_map,
    })
}

pub fn find_policy_node<'a>(tree: &'a PolicyTree, id: &str) -> Option<&'a PolicyNode> {
    tree.node_map.get(id)
}

pub fn get_policy_path(tree: &PolicyTree, target_id: &str) -> Vec<PolicyNode> {
    let mut path: Vec<PolicyNode> = Vec::new();
    let mut current = tree.node_map.get(target_id);
    while let Some(node) = current {
        path.insert(0, node.clone());
        current = node.parent_id.as_ref().and_then(|pid| tree.node_map.get(pid));
    }
    path
}

pub fn get_policy_leaves(tree: &PolicyTree) -> Vec<PolicyNode> {
    let mut leaves: Vec<PolicyNode> = Vec::new();
    fn collect(node: &PolicyNode, leaves: &mut Vec<PolicyNode>) {
        if node.children.is_empty() {
            leaves.push(node.clone());
        } else {
            for child in &node.children {
                collect(child, leaves);
            }
        }
    }
    collect(&tree.root, &mut leaves);
    leaves
}

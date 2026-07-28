use std::collections::HashMap;

use crate::types::{LocalWatermark, SigningIndices, TreeWatermark, WotsWatermarkState};

pub const MAX_L: u32 = 64;
pub const CAPACITY_PER_TREE: u32 = MAX_L * MAX_L * MAX_L;
pub const DEFAULT_TREE: &str = "default";

pub fn flat_index(indices: &SigningIndices) -> u32 {
    indices.address_index * MAX_L * MAX_L + indices.l1 * MAX_L + indices.l2
}

pub fn from_flat_index(flat: u32) -> SigningIndices {
    let address_index = flat / (MAX_L * MAX_L);
    let rem = flat % (MAX_L * MAX_L);
    let l1 = rem / MAX_L;
    let l2 = rem % MAX_L;
    SigningIndices { address_index, l1, l2 }
}

fn empty_tree(tree_id: &str) -> TreeWatermark {
    TreeWatermark {
        tree_id: tree_id.to_string(),
        device_id: None,
        branch_id: None,
        address_cursor: 0,
        l1_cursor: 0,
        l2_cursor: 0,
        unavailable: HashMap::new(),
        last_sync_timestamp: None,
    }
}

fn next_indices(cur: &SigningIndices) -> Option<SigningIndices> {
    let mut l2 = cur.l2 + 1;
    let mut l1 = cur.l1;
    let mut address_index = cur.address_index;

    if l2 >= MAX_L {
        l2 = 0;
        l1 += 1;
    }
    if l1 >= MAX_L {
        l1 = 0;
        address_index += 1;
    }
    if address_index >= MAX_L {
        return None;
    }
    Some(SigningIndices { address_index, l1, l2 })
}

pub fn get_next_indices(state: &WotsWatermarkState, tree_id: &str) -> Result<SigningIndices, String> {
    let tree = state.trees.get(tree_id).cloned().unwrap_or_else(|| empty_tree(tree_id));
    let mut cur = SigningIndices {
        address_index: tree.address_cursor,
        l1: tree.l1_cursor,
        l2: tree.l2_cursor,
    };
    let mut attempts: u32 = 0;
    while attempts < CAPACITY_PER_TREE {
        if !tree.unavailable.contains_key(&flat_index(&cur)) {
            return Ok(cur);
        }
        match next_indices(&cur) {
            Some(nxt) => cur = nxt,
            None => break,
        }
        attempts += 1;
    }
    Err(format!("WOTS keyspace exhausted for tree: {}", tree_id))
}

pub fn mark_unavailable(
    state: &mut WotsWatermarkState,
    tree_id: &str,
    indices: &SigningIndices,
    reason: &str,
) {
    let tree = state.trees.entry(tree_id.to_string()).or_insert_with(|| empty_tree(tree_id));
    let f = flat_index(indices);
    tree.unavailable.insert(f, reason.to_string());

    if let Some(nxt) = next_indices(indices) {
        let nxt_flat = flat_index(&nxt);
        let cur_flat = flat_index(&SigningIndices {
            address_index: tree.address_cursor,
            l1: tree.l1_cursor,
            l2: tree.l2_cursor,
        });
        if nxt_flat > cur_flat {
            tree.address_cursor = nxt.address_index;
            tree.l1_cursor = nxt.l1;
            tree.l2_cursor = nxt.l2;
        }
    }
}

pub fn is_unavailable(state: &WotsWatermarkState, tree_id: &str, indices: &SigningIndices) -> bool {
    match state.trees.get(tree_id) {
        Some(tree) => tree.unavailable.contains_key(&flat_index(indices)),
        None => false,
    }
}

pub fn get_local_watermark(state: &WotsWatermarkState, tree_id: &str) -> LocalWatermark {
    let tree = state.trees.get(tree_id).cloned().unwrap_or_else(|| empty_tree(tree_id));
    LocalWatermark {
        tree_id: tree.tree_id,
        address_cursor: tree.address_cursor,
        l1_cursor: tree.l1_cursor,
        l2_cursor: tree.l2_cursor,
        unavailable_count: tree.unavailable.len() as u32,
        capacity: CAPACITY_PER_TREE,
        last_sync_timestamp: tree.last_sync_timestamp,
    }
}

pub fn new_state() -> WotsWatermarkState {
    WotsWatermarkState {
        version: 3,
        trees: HashMap::new(),
    }
}

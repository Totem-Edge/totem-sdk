use crate::content_keys::compute_script_hash;
use crate::types::{ProofChain, ProofLink, VerificationResult};

pub fn build_proof_chain(links: &[ProofLink]) -> Result<ProofChain, String> {
    if links.is_empty() {
        return Err("Proof chain must have at least one link".to_string());
    }

    for link in links {
        let computed_hash = compute_script_hash(&link.script);
        if computed_hash != link.script_hash {
            return Err(format!(
                "Script hash mismatch for \"{}\": expected {}, got {}",
                link.label.as_deref().unwrap_or("unnamed"),
                link.script_hash,
                computed_hash
            ));
        }
    }

    Ok(ProofChain {
        links: links.to_vec(),
        depth: links.len() as u32,
        verified: false,
        leaf_script_hash: links[links.len() - 1].script_hash.clone(),
    })
}

pub fn verify_proof_chain(
    chain: &ProofChain,
    expected_leaf_script_hash: Option<&str>,
    verify_membership_fn: &dyn Fn(&str, &str, &str) -> bool,
) -> VerificationResult {
    if chain.links.is_empty() {
        return VerificationResult {
            valid: false,
            failed_at: None,
            reason: Some("Empty proof chain".to_string()),
        };
    }

    for i in 0..chain.links.len() {
        let link = &chain.links[i];

        if !verify_membership_fn(&link.script, &link.proof, &link.policy_root) {
            return VerificationResult {
                valid: false,
                failed_at: Some(i as u32),
                reason: Some(format!(
                    "MMR proof verification failed at level {} (\"{}\")",
                    i,
                    link.label.as_deref().unwrap_or("unnamed")
                )),
            };
        }

        if i < chain.links.len() - 1 {
            let next_link = &chain.links[i + 1];
            let mast_ref = format!("MAST 0x{}", next_link.policy_root);
            if !link.script.contains(&mast_ref) && !link.script.contains(&format!("MAST {}", next_link.policy_root)) {
                return VerificationResult {
                    valid: false,
                    failed_at: Some(i as u32),
                    reason: Some(format!(
                        "Delegation verification failed at level {} (\"{}\"): script does not contain MAST referencing next root {}…",
                        i,
                        link.label.as_deref().unwrap_or("unnamed"),
                        &next_link.policy_root[..16.min(next_link.policy_root.len())]
                    )),
                };
            }
        }
    }

    if let Some(expected) = expected_leaf_script_hash {
        let leaf = &chain.links[chain.links.len() - 1];
        if leaf.script_hash != expected {
            return VerificationResult {
                valid: false,
                failed_at: Some((chain.links.len() - 1) as u32),
                reason: Some(format!(
                    "Leaf script hash mismatch: expected {}…, got {}…",
                    &expected[..16.min(expected.len())],
                    &leaf.script_hash[..16.min(leaf.script_hash.len())]
                )),
            };
        }
    }

    VerificationResult {
        valid: true,
        failed_at: None,
        reason: None,
    }
}

pub fn to_minima_proof_expression(link: &ProofLink) -> String {
    let leaf_sum = link.leaf_sum.as_deref().unwrap_or("0");
    let root_sum = link.root_sum.as_deref().unwrap_or("0");
    format!(
        "PROOF(0x{} {} 0x{} {} 0x{})",
        link.script_hash, leaf_sum, link.policy_root, root_sum, link.proof
    )
}

pub fn to_nested_mast_script(chain: &ProofChain) -> String {
    if chain.links.is_empty() {
        return "RETURN TRUE".to_string();
    }

    let mut script = chain.links[chain.links.len() - 1].script.clone();

    for i in (0..chain.links.len() - 1).rev() {
        let next_root = &chain.links[i + 1].policy_root;
        script = format!("{}\nMAST 0x{}", chain.links[i].script, next_root);
    }

    script
}

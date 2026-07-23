use crate::content_keys::compute_script_hash;
use crate::types::{DelegationChain, DelegationConstraints, DelegationLink};

pub fn build_delegation_script(
    delegator: &str,
    delegate: &str,
    constraints: &DelegationConstraints,
) -> String {
    let mut lines: Vec<String> = Vec::new();

    lines.push(format!("ASSERT SIGNEDBY(0x{})", delegator));

    if let Some(max_block) = constraints.max_block {
        lines.push(format!("ASSERT @BLOCK LTE {}", max_block));
    }
    if let Some(ref max_amount) = constraints.max_amount {
        lines.push(format!("ASSERT @AMOUNT LTE {}", max_amount));
    }
    if let Some(ref scopes) = constraints.scopes {
        if !scopes.is_empty() {
            let scope_list = scopes.iter().map(|s| format!("\"{}\"", s)).collect::<Vec<_>>().join(" ");
            lines.push(format!("ASSERT CONTAINS([{}] STATE(0))", scope_list));
        }
    }
    if let Some(ref co_signers) = constraints.co_signers {
        if !co_signers.is_empty() {
            let signer_checks = co_signers
                .iter()
                .map(|pk| format!("SIGNEDBY(0x{})", pk))
                .collect::<Vec<_>>()
                .join(" AND ");
            lines.push(format!("ASSERT {}", signer_checks));
        }
    }

    lines.push(format!("LET delegate = 0x{}", delegate));
    lines.push("ASSERT VERIFYOUT(@INPUT delegate @AMOUNT @TOKENID TRUE)".to_string());
    lines.push("RETURN TRUE".to_string());

    lines.join("\n")
}

pub fn build_delegation_link(
    delegator: &str,
    delegate: &str,
    policy_root: &str,
    proof: &str,
    constraints: DelegationConstraints,
    sequence: u32,
) -> DelegationLink {
    let script = build_delegation_script(delegator, delegate, &constraints);
    DelegationLink {
        delegator: delegator.to_string(),
        delegate: delegate.to_string(),
        policy_root: policy_root.to_string(),
        proof: proof.to_string(),
        script,
        constraints,
        sequence,
    }
}

pub fn build_delegation_chain(links: &[DelegationLink]) -> Result<DelegationChain, String> {
    if links.is_empty() {
        return Err("Delegation chain must have at least one link".to_string());
    }

    for i in 1..links.len() {
        if links[i].delegator != links[i - 1].delegate {
            return Err(format!(
                "Delegation chain broken at link {}: expected delegator \"{}\", got \"{}\"",
                i, links[i - 1].delegate, links[i].delegator
            ));
        }
    }

    Ok(DelegationChain {
        root_authority: links[0].delegator.clone(),
        current_delegate: links[links.len() - 1].delegate.clone(),
        links: links.to_vec(),
        verified: false,
    })
}

pub fn verify_delegation_chain(chain: &DelegationChain) -> crate::types::VerificationResult {
    if chain.links.is_empty() {
        return crate::types::VerificationResult {
            valid: false,
            failed_at: None,
            reason: Some("Empty delegation chain".to_string()),
        };
    }

    for i in 0..chain.links.len() {
        let link = &chain.links[i];

        if i > 0 {
            let prev = &chain.links[i - 1];
            if link.delegator != prev.delegate {
                return crate::types::VerificationResult {
                    valid: false,
                    failed_at: Some(i as u32),
                    reason: Some(format!(
                        "Chain broken at link {}: delegator \"{}\" does not match previous delegate \"{}\"",
                        i, link.delegator, prev.delegate
                    )),
                };
            }
        }

        let expected_script = build_delegation_script(&link.delegator, &link.delegate, &link.constraints);
        let expected_hash = compute_script_hash(&expected_script);
        let actual_hash = compute_script_hash(&link.script);
        if expected_hash != actual_hash {
            return crate::types::VerificationResult {
                valid: false,
                failed_at: Some(i as u32),
                reason: Some(format!(
                    "Script hash mismatch at link {}: expected {}…, got {}…",
                    i,
                    &expected_hash[..16.min(expected_hash.len())],
                    &actual_hash[..16.min(actual_hash.len())]
                )),
            };
        }
    }

    crate::types::VerificationResult {
        valid: true,
        failed_at: None,
        reason: None,
    }
}

pub fn to_delegation_chain_script(chain: &DelegationChain) -> String {
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

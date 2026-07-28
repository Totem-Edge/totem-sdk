# KISSVM Template Library

Source-aligned with `minima-global/Minima` commit `74316b11b6ce724f36ff757ad30113f2dcc04990`.

These files are design starting points, not audited contracts. Each file is comment-free for safer canonicalization. Replace demonstration values, define a state schema, constrain transaction shape, run positive and negative tests, record the cleaned script/address and obtain independent review.

## Test workflow

Use `test-cookbook.json` for representative `runscript` commands. For templates containing `VERIFYIN`, `VERIFYOUT`, MMR proofs or MAST, build an integration transaction/witness matching the desired shape; the basic `runscript` harness creates an empty transaction unless extended by node tooling.

## Naming

KISSVM variables use lowercase letters only. Commands/functions/globals are uppercase. Function parameters are whitespace-separated.

## Inventory

- `01_single_signature.kiss` - Basic owner authorization.
- `02_multisig_2_of_3.kiss` - Threshold authorization.
- `03_absolute_block_timelock.kiss` - Block-height release.
- `04_relative_coinage_timelock.kiss` - Age-relative release.
- `05_htlc_dual_path.kiss` - Preimage claim or timed refund.
- `06_three_party_escrow.kiss` - Two-party agreement or arbiter resolution.
- `07_counter_state_machine.kiss` - Strict nonce increment and self recreation.
- `08_immutable_state_schema.kiss` - Preserve a state range.
- `09_token_gate.kiss` - Restrict by token identity.
- `10_exact_indexed_payout.kiss` - Exact single payout covenant.
- `11_two_output_split.kiss` - Exact two-recipient split.
- `12_self_recreating_covenant.kiss` - Preserve address, value, token and state.
- `13_bounded_withdrawal_vault.kiss` - Per-transition withdrawal cap.
- `14_nonce_authorized_transition.kiss` - Authorized, replay-resistant transition.
- `15_bitfield_permissions.kiss` - Compact permission flags.
- `16_dynamic_function_safe_demo.kiss` - Typed local reusable logic.
- `17_exec_hash_authorized.kiss` - Hash-authorized dynamic execution.
- `18_mast_leaf_dispatch.kiss` - Witness-proven script branch.
- `19_explicit_checksig_oracle.kiss` - Arbitrary-message signature verification.
- `20_mmr_membership.kiss` - MMR membership/sum proof.
- `21_array_allowlist.kiss` - Tuple array and bounded scan.
- `22_preserve_selected_state.kiss` - Immutable range plus mutable nonce.
- `23_emergency_escape_plus_covenant.kiss` - Recovery key and normal covenant.
- `24_commit_reveal_round.kiss` - Two-round state transition.

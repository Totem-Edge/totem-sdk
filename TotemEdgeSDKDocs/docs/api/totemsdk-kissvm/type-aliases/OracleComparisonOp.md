[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / OracleComparisonOp

# Type Alias: OracleComparisonOp

> **OracleComparisonOp** = `"GT"` \| `"GTE"` \| `"LT"` \| `"LTE"` \| `"EQ"` \| `"NEQ"`

OMP-18 / OMP-19 — on-chain oracle condition witness (RFC-048 §3.1).

Turns a signed oracle **observation** into an objective on-chain condition for a
spend (price-linked / parametric payouts, liquidation triggers, condition
witnesses). It reuses the existing evidence stack (`proof` / `proofgraph` /
`identity`); it does **not** define a second signature scheme.

On-chain semantics (and their honest limit):
  - The observation fields are **committed** to state ports at funding (see
    [oracleConditionStateVariables](../functions/oracleConditionStateVariables.md)); the witness reads them via
    `PREVSTATE` and pins the feed commitment with `SAMESTATE`.
  - The authorized oracle(s) authorize the spend — `MULTISIG(threshold …)` — so
    a quorum can be required. In this SDK, `CHECKSIG`/`SIGNEDBY` verify against
    the **transaction digest**, and the transaction commits the observation, so
    the oracle's signature is a cooperative attestation **bound to the spend**.
  - Freshness (`observedAt ≤ @BLOCK ≤ validUntil`) and the objective value
    comparison (`value OP threshold`) are enforced in-script; the witness
    **fails closed** on a stale observation, an untrusted signer, or a
    non-matching value.

**Unilateral (non-cooperative) use.** If a product needs to exercise an oracle
condition *without* the oracle being online, do not rely on the oracle signing
the spend. Instead commit the observation at funding and use the P-EXIT exercise
covenant (`buildExerciseCovenant`) — optionally with a pre-signed exercise
transaction — so the beneficiary triggers settlement alone (RFC-048 §3.1
caveat; RFC-050 §3). This template is the **cooperative/attested** shape and
MUST be disclosed as such when used directly.

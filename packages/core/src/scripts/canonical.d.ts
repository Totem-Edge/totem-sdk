/**
 * `toNodeScript` — canonicalize a KISSVM script to the syntax the Minima **node**
 * tokenizer accepts (RFC-048 §3.1 L4 finding; audit
 * `docs/audits/kissvm-node-validity-l4-2026-10.md`).
 *
 * The node tokenizer requires:
 *   - user variable names `^[a-z]+$` (lowercase letters only — no digits/underscores/uppercase),
 *   - hex literals `^0x[0-9a-fA-F]+$` (lowercase `0x` prefix),
 *   - arithmetic via the `+` / `-` operators (`ADD`/`SUB` are not node functions).
 *
 * This is a token-level rewrite: commands, functions, operators, globals (`@…`), hex
 * literals, numbers and `[…]` string literals are preserved; only **user identifiers**
 * are rewritten to lowercase letters (with deterministic de-collision), `0X`→`0x`, and
 * `ADD`/`SUB`→`+`/`-`. It is idempotent.
 *
 * Semantics are unchanged: the SDK evaluators normalize `+`→ADD and `-`→SUB (and vice
 * versa), so a canonical script behaves identically to its source.
 */
/** Canonicalize a KISSVM script to node-accepted syntax. Idempotent. */
export declare function toNodeScript(script: string): string;

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
const KEYWORDS = new Set([
    'LET', 'IF', 'THEN', 'ELSE', 'ELSEIF', 'ENDIF', 'RETURN', 'ASSERT', 'EXEC', 'MAST',
    'WHILE', 'DO', 'ENDWHILE', 'FOR', 'TO', 'BY', 'ENDFOR', 'FOREACH', 'IN', 'SWITCH',
    'CASE', 'DEFAULT', 'ENDSWITCH', 'FUNC', 'ENDFUNC', 'TRUE', 'FALSE', 'STORE', 'WITH',
]);
// Word operators kept as-is (ADD/SUB are handled separately → +/−).
const OPS = new Set([
    'GT', 'LT', 'EQ', 'GTE', 'LTE', 'NEQ', 'AND', 'OR', 'XOR', 'NAND', 'NOR', 'NXOR',
    'NOT', 'NEG', 'MUL', 'DIV', 'MOD', 'LSHIFT', 'RSHIFT', 'BITAND', 'BITOR', 'BITXOR', 'BITNOT',
]);
const FUNCTIONS = new Set([
    'SHA3', 'SHA2', 'HASH', 'PROOF', 'SIGNEDBY', 'MULTISIG', 'CHECKSIG', 'VERIFYOUT', 'VERIFYIN',
    'GETOUTADDR', 'GETOUTAMT', 'GETOUTTOK', 'GETOUTKEEPSTATE', 'GETINADDR', 'GETINAMT', 'GETINID',
    'GETINTOK', 'STATE', 'PREVSTATE', 'SAMESTATE', 'SAMECOINS', 'COINAGE', 'COINDATA', 'NUMBER',
    'HEX', 'STRING', 'ASCII', 'UTF8', 'BOOL', 'CONCAT', 'LEN', 'REV', 'SUBSET', 'SETLEN',
    'SUBSTR', 'REPLACE', 'REPLACEFIRST', 'OVERWRITE', 'ABS', 'CEIL', 'FLOOR', 'MAX', 'MIN',
    'DEC', 'INC', 'SIGDIG', 'POW', 'SQRT', 'BITSET', 'BITGET', 'BITCOUNT', 'ADDRESS', 'EXISTS',
    'GET', 'SUMINPUTS', 'SUMOUTPUTS', 'CHECKSIG',
]);
function classify(id) {
    const up = id.toUpperCase();
    if (up === 'ADD')
        return { kind: 'keep', out: '+' };
    if (up === 'SUB')
        return { kind: 'keep', out: '-' };
    if (KEYWORDS.has(up) || OPS.has(up) || FUNCTIONS.has(up))
        return { kind: 'keep', out: up };
    return { kind: 'var' };
}
/** a, b, …, z, aa, ab, … */
function letters(n) {
    let s = '';
    n += 1;
    while (n > 0) {
        const r = (n - 1) % 26;
        s = String.fromCharCode(97 + r) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}
const TOKEN = /(\[[^\]]*\]|0[xX][0-9a-fA-F]+|@[A-Za-z][A-Za-z0-9]*|[A-Za-z_][A-Za-z0-9_]*)/g;
/** Canonicalize a KISSVM script to node-accepted syntax. Idempotent. */
export function toNodeScript(script) {
    // The node tokenizer has no comment syntax; strip `//` line comments.
    script = script.replace(/\/\/[^\n]*/g, '');
    const varMap = new Map();
    const used = new Set();
    // First pass: assign canonical names to user variables (in first-occurrence order).
    let m;
    const re1 = new RegExp(TOKEN.source, 'g');
    while ((m = re1.exec(script))) {
        const tok = m[0];
        if (tok[0] === '[' || tok.startsWith('0x') || tok.startsWith('0X') || tok[0] === '@')
            continue;
        if (classify(tok).kind !== 'var' || varMap.has(tok))
            continue;
        const base = tok.toLowerCase().replace(/[^a-z]/g, '') || 'v';
        let cand = base;
        let i = 0;
        while (used.has(cand))
            cand = base + letters(i++);
        used.add(cand);
        varMap.set(tok, cand);
    }
    // Second pass: rewrite.
    return script.replace(TOKEN, (tok) => {
        if (tok[0] === '[')
            return tok;
        if (tok.startsWith('0x') || tok.startsWith('0X'))
            return '0x' + tok.slice(2);
        if (tok[0] === '@')
            return '@' + tok.slice(1).toUpperCase();
        const c = classify(tok);
        if (c.kind === 'keep')
            return c.out;
        return varMap.get(tok) ?? tok;
    });
}

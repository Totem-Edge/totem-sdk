/**
 * KISSVM v1 evaluator — deterministic scaled-BigInt arithmetic.
 *
 * All numeric values inside the VM are `bigint` scaled by SCALE = 10^8
 * (8 decimal places, matching Minima's MiniNumber precision).
 *
 * Conversion rules:
 *   Script literal "1.01"  → 101_000_000n
 *   Script literal "500"   → 50_000_000_000n
 *   Context value  1000.0  → contextToScaled(1000.0) = 100_000_000_000n
 *
 * Arithmetic:
 *   ADD / SUB : a + b  / a − b        (scales cancel)
 *   MUL       : (a × b) / SCALE
 *   DIV       : (a × SCALE) / b
 *   MOD       : a mod b
 *   LSHIFT    : n << k   (BigInt, k ≤ 256)
 *   RSHIFT    : n >> k   (BigInt, k ≤ 256)
 *
 * KissvmLimitError is intentionally NOT caught here — callers must handle it.
 * KissvmRuntimeError is caught and converted to { passed:false, error }.
 */

import { createHash } from 'node:crypto';
import { F, fromHex, wotsVerifyDigest } from '@totemsdk/core';
import { KissvmLimitError, KissvmRuntimeError, ReturnSignal } from './errors.js';
import { LIMITS, VMState, MastBranch, UserFunction } from './vm.js';
import { parseScript } from './parser.js';
import type { ASTNode, Value, Scalar, EvalResult, ScriptWitness, TxContext } from './types.js';

// ─── Fixed-point scale ────────────────────────────────────────────────────────

/** 8 decimal places — matches Minima MiniNumber precision */
const SCALE = 100_000_000n;

/**
 * Parse a decimal string literal to a scaled bigint.
 * "1.01" → 101_000_000n   "500" → 50_000_000_000n   "0.3" → 30_000_000n
 * The 9th+ decimal digits are dropped with standard rounding.
 */
function parseLiteralBigInt(s: string): bigint {
  const isNeg = s.startsWith('-');
  const abs   = isNeg ? s.slice(1) : s;
  const dot   = abs.indexOf('.');

  let intPart: string;
  let fracStr: string;

  if (dot === -1) {
    intPart = abs;
    fracStr = '';
  } else {
    intPart = abs.slice(0, dot) || '0';
    fracStr = abs.slice(dot + 1);
  }

  const fracPadded = fracStr.slice(0, 8).padEnd(8, '0');
  const ninth      = fracStr.length > 8 ? parseInt(fracStr[8] ?? '0', 10) : 0;
  const result = BigInt(intPart) * SCALE + BigInt(fracPadded) + (ninth >= 5 ? 1n : 0n);
  return isNeg ? -result : result;
}

/**
 * Convert a JavaScript `number` (e.g. `CoinData.amount`, `TxContext.block`)
 * to a scaled bigint.  Uses `toFixed(8)` to avoid float-to-string rounding drift.
 */
function contextToScaled(n: number): bigint {
  return parseLiteralBigInt(n.toFixed(8));
}

/**
 * Extract the scaled bigint from a VM value (for arithmetic / comparison).
 * Throws KissvmRuntimeError if the value cannot be interpreted as a number.
 * Hex strings (MiniData / 0x…) are NOT accepted here — they are data, not numbers.
 */
function asScaled(v: Value): bigint {
  if (typeof v === 'bigint')  return v;
  if (typeof v === 'boolean') return v ? SCALE : 0n;
  if (typeof v === 'string') {
    if (v.startsWith('0x') || v.startsWith('0X')) {
      throw new KissvmRuntimeError(`Cannot use hex data value "${v.slice(0, 20)}" as a number`);
    }
    if (v === '') return 0n;
    return parseLiteralBigInt(v);
  }
  throw new KissvmRuntimeError(`Cannot convert ${typeof v} to number`);
}

/**
 * Convert a VM port/index value (scaled bigint) to a plain integer.
 * e.g. 300_000_000n → 3
 */
function asPortInt(v: Value): number {
  return Number(asScaled(v) / SCALE);
}

/** Scaled multiplication: (a × b) / SCALE */
function mulScaled(a: bigint, b: bigint): bigint { return (a * b) / SCALE; }
/** Scaled division: (a × SCALE) / b */
function divScaled(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new KissvmRuntimeError('Division by zero');
  return (a * SCALE) / b;
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Evaluate a KISSVM script.
 *
 * Returns `EvalResult` for normal termination (RETURN, ASSERT failure, runtime errors).
 * **Throws `KissvmLimitError`** if any safety limit (instructions, stack depth, shift
 * size) is exceeded — callers must handle this case separately.
 */
export function evaluateScript(
  script: string,
  witness: ScriptWitness,
  txCtx: TxContext,
): EvalResult {
  const vm = new VMState(witness, txCtx);
  try {
    const ast = parseScript(script);
    execStatements(ast, vm);
    return {
      passed: false,
      trace: vm.trace,
      error: 'Script ended without RETURN',
      instructionsUsed: vm.instructionCount,
    };
  } catch (e) {
    if (e instanceof ReturnSignal) {
      const passed = isTruthy(e.value as Value);
      vm.addTrace(`RETURN → ${passed}`);
      return { passed, trace: vm.trace, instructionsUsed: vm.instructionCount };
    }
    // KissvmLimitError: intentionally NOT caught — let it propagate to the caller
    if (e instanceof KissvmLimitError) throw e;
    if (e instanceof KissvmRuntimeError) {
      return { passed: false, trace: vm.trace, error: e.message, instructionsUsed: vm.instructionCount };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { passed: false, trace: vm.trace, error: msg, instructionsUsed: vm.instructionCount };
  }
}

// ─── Statement execution ──────────────────────────────────────────────────────

function execStatements(stmts: ASTNode[], vm: VMState): void {
  for (const stmt of stmts) execStatement(stmt, vm);
}

function execStatement(node: ASTNode, vm: VMState): void {
  vm.tick();

  switch (node.type) {
    case 'RETURN': {
      const val = evalExpr(node.expr, vm);
      vm.addTrace(`RETURN ${val}`);
      throw new ReturnSignal(val);
    }
    case 'ASSERT': {
      const val = evalExpr(node.expr, vm);
      vm.addTrace(`ASSERT ${val}`);
      if (!isTruthy(val)) throw new KissvmRuntimeError(`ASSERT failed: ${val}`);
      break;
    }
    case 'LET': {
      const val = evalExpr(node.value, vm);
      vm.addTrace(`LET ${node.name} = ${val}`);
      vm.set(node.name, val);
      break;
    }
    case 'STORE_STATE': {
      const port = asPortInt(evalExpr(node.port, vm));
      const val  = evalExpr(node.value, vm);
      vm.addTrace(`STORE STATE(${port}) WITH ${val}`);
      vm.txCtx.state[port] = scaledToString(val);
      break;
    }
    case 'IF': {
      const cond = evalExpr(node.cond, vm);
      vm.addTrace(`IF ${cond}`);
      vm.pushBlockScope();
      try {
        if (isTruthy(cond)) execStatements(node.then, vm);
        else if (node.else) execStatements(node.else, vm);
      } finally { vm.popBlockScope(); }
      break;
    }
    case 'FOR': {
      const from = asScaled(evalExpr(node.from, vm));
      const to   = asScaled(evalExpr(node.to, vm));
      const by   = node.by ? asScaled(evalExpr(node.by, vm)) : SCALE;
      if (by === 0n) throw new KissvmRuntimeError('FOR loop step cannot be zero');
      for (let i = from; by > 0n ? i <= to : i >= to; i += by) {
        vm.tick();
        vm.pushBlockScope();
        vm.set(node.name, i);
        try { execStatements(node.body, vm); } finally { vm.popBlockScope(); }
      }
      break;
    }
    case 'FOREACH': {
      const items = toArray(evalExpr(node.list, vm));
      for (const item of items) {
        vm.tick();
        vm.pushBlockScope();
        vm.set(node.name, item);
        try { execStatements(node.body, vm); } finally { vm.popBlockScope(); }
      }
      break;
    }
    case 'SWITCH': {
      const sv = evalExpr(node.expr, vm);
      vm.addTrace(`SWITCH ${sv}`);
      let matched = false;
      for (const c of node.cases) {
        const cv = evalExpr(c.value, vm);
        if (kissvmEq(sv, cv)) {
          matched = true;
          vm.pushBlockScope();
          try { execStatements(c.body, vm); } finally { vm.popBlockScope(); }
          break;
        }
      }
      if (!matched && node.defaultBody) {
        vm.pushBlockScope();
        try { execStatements(node.defaultBody, vm); } finally { vm.popBlockScope(); }
      }
      break;
    }
    case 'FUNC_DEF': {
      if (node.params.length > LIMITS.MAX_PARAMS) {
        throw new KissvmLimitError(`Function ${node.name} exceeds max ${LIMITS.MAX_PARAMS} params`);
      }
      vm.funcs.set(node.name, { params: node.params, body: node.body, closureEnv: vm.snapshotEnv() });
      vm.addTrace(`FUNC ${node.name} defined`);
      break;
    }
    case 'CALL_STMT': {
      const fn = vm.funcs.get(node.name);
      if (!fn) throw new KissvmRuntimeError(`Unknown function: ${node.name}`);
      validateArgCount(fn, node.args.length, node.name);
      callUserFunc(fn, node.args, vm);
      break;
    }
    case 'MAST_BLOCK': {
      vm.mastBlock = node.branches;
      vm.addTrace(`MAST_BLOCK: ${node.branches.length} branch(es) defined`);
      break;
    }
    case 'EXEC_MAST': {
      const result = execMastBlockVm(vm);
      throw new ReturnSignal(result);
    }
    case 'MAST_STMT': {
      if (node.rootHash) {
        const result = evalMastExpr(node.rootHash, vm);
        throw new ReturnSignal(result);
      }
      break;
    }
    default:
      throw new KissvmRuntimeError(`Cannot execute ${(node as ASTNode).type} as statement`);
  }
}

// ─── Expression evaluation ────────────────────────────────────────────────────

function evalExpr(node: ASTNode, vm: VMState): Value {
  vm.tick();

  switch (node.type) {
    case 'LITERAL': {
      const v = node.value;
      // Convert parser's parseFloat output to a deterministic scaled bigint
      if (typeof v === 'number') return parseLiteralBigInt(v.toString());
      return v as Value;
    }

    case 'BUILTIN': return resolveBuiltin(node.name, vm);

    case 'IDENT': {
      const v = vm.get(node.name);
      if (v === undefined) throw new KissvmRuntimeError(`Undefined variable: ${node.name}`);
      return v;
    }

    case 'BINARY': return evalBinary(node.op, node.left, node.right, vm);

    case 'UNARY': {
      if (node.op === 'NOT') return !isTruthy(evalExpr(node.expr, vm));
      if (node.op === 'NEG') return -asScaled(evalExpr(node.expr, vm));
      throw new KissvmRuntimeError(`Unknown unary op: ${node.op}`);
    }

    case 'STATE': {
      const port = asPortInt(evalExpr(node.port, vm));
      const raw = vm.txCtx.state[port] ?? '';
      checkStringSize(raw);
      return parseStateValue(raw);
    }
    case 'PREVSTATE': {
      const port = asPortInt(evalExpr(node.port, vm));
      const raw = vm.txCtx.prevState[port] ?? '';
      checkStringSize(raw);
      return parseStateValue(raw);
    }
    case 'SAMESTATE': {
      const from = asPortInt(evalExpr(node.from, vm));
      const to   = asPortInt(evalExpr(node.to, vm));
      for (let p = from; p <= to; p++) {
        if ((vm.txCtx.state[p] ?? '') !== (vm.txCtx.prevState[p] ?? '')) return false;
      }
      return true;
    }
    case 'SAMECOINS': {
      const { inputs, prevCoins } = vm.txCtx;
      if (!prevCoins) return true;
      if (inputs.length !== prevCoins.length) return false;
      for (let i = 0; i < inputs.length; i++) {
        const a = inputs[i], b = prevCoins[i];
        if (a.coinId   !== b.coinId  || a.tokenId  !== b.tokenId  ||
            a.amount   !== b.amount  || a.address   !== b.address) return false;
      }
      return true;
    }
    case 'COINDATA': {
      const coin = vm.txCtx.inputs[vm.txCtx.inputIndex];
      if (!coin) return '';
      return `${coin.coinId}:${coin.amount}:${coin.tokenId}:${coin.address}`;
    }
    case 'SIGNEDBY': {
      const pkVal = String(evalExpr(node.pubkey, vm));
      return verifySignedBy(pkVal, vm);
    }
    case 'MULTISIG': {
      const threshold = asPortInt(evalExpr(node.threshold, vm));
      let sigCount = 0;
      for (const k of node.keys) {
        if (verifySignedBy(String(evalExpr(k, vm)), vm)) sigCount++;
        if (sigCount >= threshold) return true;
      }
      return sigCount >= threshold;
    }
    case 'CHECKSIG': {
      if (!vm.txCtx.txDigest) {
        if (vm.txCtx.simulationMode) return vm.witness.signatures.size > 0;
        vm.addTrace('CHECKSIG → false (no txDigest; provide TxContext.txDigest for real verification)');
        return false;
      }
      for (const [pkHex, sig] of vm.witness.signatures) {
        try { if (wotsVerifyDigest(sig, vm.txCtx.txDigest, fromHex(pkHex))) return true; } catch { /**/ }
      }
      return false;
    }
    case 'HASH': {
      const val   = evalExpr(node.expr, vm);
      const bytes = toBytes(val);
      const out   = node.fn === 'SHA2' ? sha2(bytes) : F(bytes);
      const hex   = '0x' + bytesToHex(out);
      checkStringSize(hex);
      return hex;
    }
    case 'VERIFYOUT': {
      const idxVal    = evalExpr(node.index, vm);
      const addr      = normalizeHex(String(evalExpr(node.address, vm)));
      const amtScaled = asScaled(evalExpr(node.amount, vm));
      const tokId     = normalizeHex(String(evalExpr(node.tokenId, vm)));
      const keep      = isTruthy(evalExpr(node.keepState, vm));

      let outIdx = typeof idxVal === 'string' && idxVal.toUpperCase().includes('INPUT')
        ? vm.txCtx.inputIndex
        : asPortInt(idxVal);

      const out = vm.txCtx.outputs[outIdx];
      if (!out) return false;
      const r = normalizeHex(out.address) === addr
             && contextToScaled(out.amount) === amtScaled
             && normalizeHex(out.tokenId)  === tokId
             && out.keepState              === keep;
      vm.addTrace(`VERIFYOUT[${outIdx}] → ${r}`);
      return r;
    }
    case 'GETOUT': {
      const idx = asPortInt(evalExpr(node.index, vm));
      const out = vm.txCtx.outputs[idx];
      if (!out) return 0n;
      if (node.fn === 'AMT')       return contextToScaled(out.amount);
      if (node.fn === 'ADDR')      return out.address;
      if (node.fn === 'TOK')       return out.tokenId;
      if (node.fn === 'KEEPSTATE') return out.keepState;
      return 0n;
    }
    case 'SIGDIG': {
      const nScaled  = asScaled(evalExpr(node.digits, vm));
      const valScaled = asScaled(evalExpr(node.expr, vm));
      return sigdigBigInt(valScaled, nScaled);
    }
    case 'CALL_EXPR': {
      const fn = vm.funcs.get(node.name);
      if (!fn) throw new KissvmRuntimeError(`Unknown function: ${node.name}`);
      validateArgCount(fn, node.args.length, node.name);
      return callUserFuncExpr(fn, node.args, vm);
    }
    case 'MAST_EXPR': return evalMastExpr(node.rootHash, vm) as Value;
    case 'EXEC_MAST': return execMastBlockVm(vm) as Value;
    case 'PROOF': {
      const scriptHashVal = String(evalExpr(node.scriptHash, vm));
      const policyRootVal = String(evalExpr(node.policyRoot, vm));
      const proofVal      = String(evalExpr(node.proof, vm));
      return evalProof(scriptHashVal, policyRootVal, proofVal, vm);
    }

    default:
      throw new KissvmRuntimeError(`Cannot evaluate ${(node as ASTNode).type} as expression`);
  }
}

// ─── Binary operators ─────────────────────────────────────────────────────────

function evalBinary(op: string, leftNode: ASTNode, rightNode: ASTNode, vm: VMState): Value {
  // Short-circuit boolean operators
  if (op === 'AND') {
    if (!isTruthy(evalExpr(leftNode, vm))) return false;
    return isTruthy(evalExpr(rightNode, vm));
  }
  if (op === 'OR') {
    if (isTruthy(evalExpr(leftNode, vm))) return true;
    return isTruthy(evalExpr(rightNode, vm));
  }

  const left  = evalExpr(leftNode, vm);
  const right = evalExpr(rightNode, vm);

  switch (op) {
    case 'XOR':  return isTruthy(left) !== isTruthy(right);
    case 'EQ':   return kissvmEq(left, right);
    case 'NEQ':  return !kissvmEq(left, right);
    case 'GT':   return asScaled(left) >  asScaled(right);
    case 'GTE':  return asScaled(left) >= asScaled(right);
    case 'LT':   return asScaled(left) <  asScaled(right);
    case 'LTE':  return asScaled(left) <= asScaled(right);
    case 'ADD':  return asScaled(left) +  asScaled(right);
    case 'SUB':  return asScaled(left) -  asScaled(right);
    case 'MUL':  return mulScaled(asScaled(left), asScaled(right));
    case 'DIV':  return divScaled(asScaled(left), asScaled(right));
    case 'MOD': {
      const d = asScaled(right);
      if (d === 0n) throw new KissvmRuntimeError('Modulo by zero');
      return asScaled(left) % d;
    }
    case 'LSHIFT': {
      const n      = asScaled(left) / SCALE;           // unscale to integer
      const amount = Number(asScaled(right) / SCALE);  // shift count as plain int
      if (amount < 0) throw new KissvmRuntimeError('Negative shift amount');
      if (amount > LIMITS.MAX_SHIFT_BITS) {
        throw new KissvmLimitError(`Shift ${amount} exceeds max ${LIMITS.MAX_SHIFT_BITS}`);
      }
      return (n << BigInt(amount)) * SCALE;            // re-scale result
    }
    case 'RSHIFT': {
      const n      = asScaled(left) / SCALE;
      const amount = Number(asScaled(right) / SCALE);
      if (amount < 0) throw new KissvmRuntimeError('Negative shift amount');
      if (amount > LIMITS.MAX_SHIFT_BITS) {
        throw new KissvmLimitError(`Shift ${amount} exceeds max ${LIMITS.MAX_SHIFT_BITS}`);
      }
      return (n >> BigInt(amount)) * SCALE;
    }
    default:
      throw new KissvmRuntimeError(`Unknown binary operator: ${op}`);
  }
}

// ─── Built-in variable resolution ────────────────────────────────────────────

function resolveBuiltin(name: string, vm: VMState): Value {
  const ctx  = vm.txCtx;
  const coin = ctx.inputs[ctx.inputIndex];
  switch (name) {
    case 'BLOCK':   return contextToScaled(ctx.block);
    case 'ADDRESS': { const a = coin?.address ?? ''; checkStringSize(a); return a; }
    case 'AMOUNT':  return contextToScaled(coin?.amount ?? 0);
    case 'TOKENID': { const t = coin?.tokenId ?? ''; checkStringSize(t); return t; }
    case 'INPUT':   return contextToScaled(ctx.inputIndex);
    /** @SCRIPT = the SHA3-256 hash of the coin's locking script */
    case 'SCRIPT':  { const s = coin?.scriptHash ?? ''; checkStringSize(s); return s; }
    /**
     * @COINAGE = current block − block at which this coin was created.
     * Returns 0 if coinCreatedBlock is not supplied (simulation default).
     */
    case 'COINAGE': {
      const created = coin?.coinCreatedBlock ?? 0;
      return contextToScaled(Math.max(0, ctx.block - created));
    }
    default:
      throw new KissvmRuntimeError(`Unknown built-in variable: @${name}`);
  }
}

// ─── SIGNEDBY verification ────────────────────────────────────────────────────

function verifySignedBy(pkVal: string, vm: VMState): boolean {
  const stripped = (pkVal.startsWith('0x') || pkVal.startsWith('0X'))
    ? pkVal.slice(2).toLowerCase()
    : pkVal.toLowerCase();

  const sig = vm.witness.signatures.get(stripped);
  if (!sig) { vm.addTrace(`SIGNEDBY(${stripped.slice(0, 10)}…) → no sig`); return false; }

  if (!vm.txCtx.txDigest) {
    if (vm.txCtx.simulationMode) {
      vm.addTrace(`SIGNEDBY(${stripped.slice(0, 10)}…) → present (simulation mode)`);
      return true;
    }
    vm.addTrace(`SIGNEDBY(${stripped.slice(0, 10)}…) → false (no txDigest; provide TxContext.txDigest for real verification)`);
    return false;
  }
  try {
    const ok = wotsVerifyDigest(sig, vm.txCtx.txDigest, fromHex(stripped));
    vm.addTrace(`SIGNEDBY(${stripped.slice(0, 10)}…) → ${ok}`);
    return ok;
  } catch {
    vm.addTrace(`SIGNEDBY(${stripped.slice(0, 10)}…) → verify error`);
    return false;
  }
}

// ─── MAST — hash-form ─────────────────────────────────────────────────────────

function evalMastExpr(rootHash: string, vm: VMState): boolean {
  const branches = vm.txCtx.mastBranches;
  if (!branches) throw new KissvmRuntimeError(`MAST requires mastBranches in TxContext`);

  const norm = normalizeHex(rootHash);

  // 1. Direct hash → script lookup
  if (branches.has(norm)) {
    vm.addTrace(`MAST branch found for ${norm.slice(0, 14)}…`);
    return executeSubScript(branches.get(norm)!, vm);
  }

  // 2. Normalise all keys and retry
  for (const [key, value] of branches) {
    if (normalizeHex(key) === norm) {
      vm.addTrace(`MAST branch found (normalised) for ${norm.slice(0, 14)}…`);
      return executeSubScript(value, vm);
    }
  }

  // 3. Treat keys as script texts — compute their hashes and compare
  for (const [scriptText] of branches) {
    if (!scriptText.startsWith('0x') && !scriptText.startsWith('0X')) {
      if (normalizeHex(computeScriptHash(scriptText)) === norm) {
        vm.addTrace(`MAST branch found (hash match) for ${norm.slice(0, 14)}…`);
        return executeSubScript(scriptText, vm);
      }
    }
  }

  throw new KissvmRuntimeError(`MAST: no branch found for root ${norm.slice(0, 20)}…`);
}

// ─── MAST — brace-form (EXEC MAST) ───────────────────────────────────────────

function execMastBlockVm(vm: VMState): boolean {
  const defined = vm.mastBlock;
  if (!defined || defined.length === 0) {
    const branches = vm.txCtx.mastBranches;
    if (!branches || branches.size === 0) throw new KissvmRuntimeError('EXEC MAST: no branches available');
    const [, script] = [...branches.entries()][0];
    vm.addTrace('EXEC MAST (fallback to mastBranches)');
    return executeSubScript(script, vm);
  }

  const revealed = vm.txCtx.mastBranches;
  if (!revealed) throw new KissvmRuntimeError('EXEC MAST: mastBranches not provided in TxContext');

  for (const branch of defined) {
    const norm = normalizeHex(branch.hash);
    if (revealed.has(norm)) {
      vm.addTrace(`EXEC MAST: executing branch ${norm.slice(0, 14)}…`);
      return execInlineBody(branch.body, vm);
    }
  }

  throw new KissvmRuntimeError('EXEC MAST: no matching branch revealed in mastBranches');
}

function execInlineBody(body: ASTNode[], vm: VMState): boolean {
  vm.pushCallFrame();
  let result = false;
  try {
    execStatements(body, vm);
  } catch (e) {
    if (e instanceof ReturnSignal) result = isTruthy(e.value as Value);
    else throw e;
  } finally {
    vm.popCallFrame();
  }
  return result;
}

function executeSubScript(script: string, parentVm: VMState): boolean {
  const ast   = parseScript(script);
  const subVm = new VMState(parentVm.witness, parentVm.txCtx);
  subVm.instructionCount = parentVm.instructionCount;
  for (const [k, v] of parentVm.funcs) subVm.funcs.set(k, v);

  let result = false;
  try {
    execStatements(ast, subVm);
  } catch (e) {
    parentVm.instructionCount = subVm.instructionCount;
    if (e instanceof ReturnSignal) result = isTruthy(e.value as Value);
    else throw e;
  }
  parentVm.instructionCount = subVm.instructionCount;
  for (const t of subVm.trace) parentVm.addTrace(`  [sub] ${t}`);
  return result;
}

// ─── PROOF — Merkle-conditioned policy verification ───────────────────────────

/**
 * PROOF(scriptHash, policyRoot, proof)
 *
 * Semantics:
 *  1. scriptHash must be present in txCtx.mastBranches (spender revealed it).
 *  2a. If proof is empty (zero-length hex or empty string):
 *      ONLY accepted when scriptHash === policyRoot
 *      (trivial single-leaf Merkle tree: root = leaf).
 *  2b. If proof is non-empty: verify the Merkle inclusion path.
 *      Returns false if verification fails.
 */
function evalProof(
  scriptHashVal: string,
  policyRootVal: string,
  proofVal: string,
  vm: VMState,
): boolean {
  const normHash = normalizeHex(scriptHashVal);
  const normRoot = normalizeHex(policyRootVal);

  // Step 1: revealed script must be known to the spender
  const branches = vm.txCtx.mastBranches;
  let scriptPresent = branches?.has(normHash) ?? false;
  if (!scriptPresent && branches) {
    for (const [k] of branches) {
      if (normalizeHex(k) === normHash) { scriptPresent = true; break; }
    }
  }
  if (!scriptPresent) {
    vm.addTrace(`PROOF: script ${normHash.slice(0, 12)}… not in mastBranches → false`);
    return false;
  }

  // Canonicalise proof bytes: strip 0x prefix
  const proofHex = (proofVal.startsWith('0x') || proofVal.startsWith('0X'))
    ? proofVal.slice(2)
    : proofVal;

  // Step 2a: empty proof — only valid for trivial single-leaf tree (root == leaf)
  if (proofHex.length === 0) {
    const ok = normHash === normRoot;
    vm.addTrace(`PROOF(${normHash.slice(0, 12)}…) empty-proof, trivial=${ok}`);
    return ok;
  }

  // Step 2b: non-empty proof — verify Merkle inclusion path
  const ok = verifyMerkleProof(normHash, normRoot, proofHex);
  vm.addTrace(`PROOF(${normHash.slice(0, 12)}…, root=${normRoot.slice(0, 12)}…) merkle=${ok}`);
  return ok;
}

/**
 * Verify a binary-Merkle inclusion proof.
 *
 * proofHex: concatenation of 32-byte sibling hashes (no direction bits —
 * the left-then-right sorted-pair convention used by Minima).
 * Returns true iff the recomputed root matches policyRoot.
 */
function verifyMerkleProof(leafHex: string, rootHex: string, proofHex: string): boolean {
  try {
    const leafPure = leafHex.startsWith('0x') ? leafHex.slice(2) : leafHex;
    let current   = fromHex(leafPure);
    const proofBytes = fromHex(proofHex);
    const SIBLING = 32;
    for (let off = 0; off + SIBLING <= proofBytes.length; off += SIBLING) {
      const sibling = proofBytes.slice(off, off + SIBLING);
      // Canonical pair-hash: sort both halves lexicographically then SHA3-256
      const [lo, hi] = uint8Less(current, sibling)
        ? [current, sibling]
        : [sibling, current];
      const pair = new Uint8Array(64);
      pair.set(lo,  0);
      pair.set(hi, 32);
      current = F(pair);
    }
    const computedRoot = '0x' + bytesToHex(current);
    return normalizeHex(computedRoot) === normalizeHex(rootHex);
  } catch {
    return false;
  }
}

// ─── User-defined function calls ──────────────────────────────────────────────

function validateArgCount(fn: UserFunction, provided: number, name: string): void {
  if (provided !== fn.params.length) {
    throw new KissvmRuntimeError(
      `Function ${name} expects ${fn.params.length} arg(s), got ${provided}`
    );
  }
}

function callUserFunc(fn: UserFunction, argNodes: ASTNode[], vm: VMState): void {
  const args = argNodes.map(a => evalExpr(a, vm));
  vm.pushCallFrame();
  for (let i = 0; i < fn.params.length; i++) vm.set(fn.params[i], args[i] ?? 0n);
  try { execStatements(fn.body, vm); }
  catch (e) { if (!(e instanceof ReturnSignal)) throw e; }
  finally { vm.popCallFrame(); }
}

function callUserFuncExpr(fn: UserFunction, argNodes: ASTNode[], vm: VMState): Value {
  const args = argNodes.map(a => evalExpr(a, vm));
  vm.pushCallFrame();
  for (let i = 0; i < fn.params.length; i++) vm.set(fn.params[i], args[i] ?? 0n);
  let ret: Value = false;
  try { execStatements(fn.body, vm); }
  catch (e) { if (e instanceof ReturnSignal) ret = e.value as Value; else throw e; }
  finally { vm.popCallFrame(); }
  return ret;
}

// ─── SIGDIG ───────────────────────────────────────────────────────────────────

/**
 * Round `value` (scaled bigint) to `n` significant decimal digits.
 * n is also a scaled bigint (e.g. 4 significant digits → 400_000_000n).
 * Returns a scaled bigint.
 *
 * Example:  sigdigBigInt(100_000_000_000n, 400_000_000n)
 *           = sigdig(1000, 4) → still 1000 → 100_000_000_000n
 *
 * Example:  sigdigBigInt(123_456_789_000_000_000n, 800_000_000n)
 *           = sigdig(1234567890, 8) → 1234567900 → 123_456_790_000_000_000n
 */
function sigdigBigInt(value: bigint, nScaled: bigint): bigint {
  const n = Number(nScaled / SCALE);
  if (n <= 0 || value === 0n) return 0n;

  const isNeg  = value < 0n;
  const absVal = isNeg ? -value : value;
  const absStr = absVal.toString();
  const totalDigits = absStr.length;
  const drop = totalDigits - n;

  if (drop <= 0) return value; // already fewer than n digits

  const divisor    = 10n ** BigInt(drop);
  const halfDivsor = divisor / 2n;
  const rounded    = ((absVal + halfDivsor) / divisor) * divisor;

  return isNeg ? -rounded : rounded;
}

/**
 * Public utility: round `value` to `n` significant digits (JavaScript float version).
 * This is the exported API used directly by tests and external consumers.
 * The evaluator uses sigdigBigInt internally for deterministic VM arithmetic.
 */
export function sigdig(value: number, n: number): number {
  if (value === 0 || n <= 0) return 0;
  const d         = Math.ceil(Math.log10(Math.abs(value)));
  const power     = n - d;
  const magnitude = Math.pow(10, power);
  return Math.round(value * magnitude) / magnitude;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function isTruthy(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'bigint')  return v !== 0n;
  if (typeof v === 'number')  return v !== 0;
  if (typeof v === 'string')  return v !== '' && v.toLowerCase() !== 'false';
  if (v instanceof Uint8Array) return v.length > 0;
  return Boolean(v);
}

/**
 * Equality comparison:
 *   bigint  vs bigint  : exact
 *   string  vs string  : normalise-hex then compare
 *   boolean vs boolean : exact
 *   cross-type numeric : both coerced to scaled bigint
 *   cross-type bool    : isTruthy both sides
 */
function kissvmEq(a: Value, b: Value): boolean {
  if (typeof a === 'bigint' && typeof b === 'bigint') return a === b;
  if (typeof a === 'string' && typeof b === 'string') return normalizeHex(a) === normalizeHex(b);
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;
  // Cross-type: if either is bigint and the other is boolean
  if (typeof a === 'boolean' || typeof b === 'boolean') return isTruthy(a) === isTruthy(b);
  // Cross-type numeric
  try { return asScaled(a) === asScaled(b); } catch { return false; }
}

function normalizeHex(s: string): string {
  if (typeof s !== 'string') return String(s);
  return (s.startsWith('0x') || s.startsWith('0X'))
    ? '0x' + s.slice(2).toLowerCase()
    : s.toLowerCase();
}

function toBytes(v: Value): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (typeof v === 'string') {
    if (v.startsWith('0x') || v.startsWith('0X')) return fromHex(v.slice(2));
    return new TextEncoder().encode(v);
  }
  if (typeof v === 'bigint') {
    let hex = (v < 0n ? -v : v).toString(16);
    if (hex.length % 2) hex = '0' + hex;
    return fromHex(hex);
  }
  if (typeof v === 'boolean') return new Uint8Array([v ? 1 : 0]);
  return new Uint8Array(0);
}

function toArray(v: Value): Value[] {
  if (typeof v === 'string') return v.split(',').map(s => s.trim()) as Value[];
  return [v];
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function computeScriptHash(script: string): string {
  const bytes = new TextEncoder().encode(script.trim().toUpperCase());
  return '0x' + bytesToHex(F(bytes));
}

function checkStringSize(s: string): void {
  const byteLen = (s.startsWith('0x') || s.startsWith('0X'))
    ? (s.length - 2) / 2
    : new TextEncoder().encode(s).length;
  if (byteLen > LIMITS.MAX_STRING_BYTES) {
    throw new KissvmLimitError(`String/hex value exceeds ${LIMITS.MAX_STRING_BYTES}-byte limit`);
  }
}

/**
 * Parse a stored state value back to a VM Value.
 *   ""       → 0n  (empty = zero)
 *   "0xABCD" → string hex
 *   "42"     → 4_200_000_000n  (42 * SCALE)
 */
function parseStateValue(raw: string): Value {
  if (!raw) return 0n;
  if (raw.startsWith('0x') || raw.startsWith('0X')) return raw;
  // Try numeric
  const f = parseFloat(raw);
  if (!isNaN(f)) return parseLiteralBigInt(raw);
  return raw;
}

/**
 * Convert a VM value back to its canonical string representation for storage.
 */
function scaledToString(v: Value): string {
  if (typeof v === 'bigint') {
    // Unscale: divide by SCALE, format with 8 decimal places
    const neg = v < 0n;
    const abs = neg ? -v : v;
    const intPart  = abs / SCALE;
    const fracPart = abs % SCALE;
    const frac = fracPart.toString().padStart(8, '0').replace(/0+$/, '');
    const body = frac.length > 0 ? `${intPart}.${frac}` : `${intPart}`;
    return neg ? `-${body}` : body;
  }
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v instanceof Uint8Array) return '0x' + bytesToHex(v);
  return String(v);
}

/** SHA-256 using Node.js built-in crypto (no external npm dep) */
function sha2(data: Uint8Array): Uint8Array {
  const h = createHash('sha256');
  h.update(data);
  return new Uint8Array(h.digest());
}

// ─── Uint8Array ordering helper for Merkle pair sort ─────────────────────────

/** Lexicographic comparison of two Uint8Arrays */
function uint8Less(a: Uint8Array, b: Uint8Array): boolean {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return a.length < b.length;
}

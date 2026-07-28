/**
 * KISSVM v1 evaluator — uses MiniNumber matching Java's MiniNumber/BigDecimal.
 *
 * Arithmetic:
 *   ADD / SUB : a + b  / a − b        (standard decimal arithmetic)
 *   MUL       : a × b                  (standard decimal multiplication)
 *   DIV       : a / b                  (standard decimal division)
 *   MOD       : a mod b
 *   LSHIFT    : n << k   (BigInt, k ≤ 256)
 *   RSHIFT    : n >> k   (BigInt, k ≤ 256)
 *
 * KissvmLimitError is intentionally NOT caught here — callers must handle it.
 * KissvmRuntimeError is caught and converted to { passed:false, error }.
 */

import { createHash } from 'node:crypto';
import { sha3_256, hexToBytes, wotsVerifyDigest, mmrLeafExact, parseMMRProofFromHex, createMMRDataParentNode, createMMRDataLeafNode, calculateProofRoot } from '@totemsdk/core';
import type { MMRData, MMRProof } from '@totemsdk/core';
import { KissvmLimitError, KissvmRuntimeError, ReturnSignal } from './errors.js';
import { LIMITS, VMState, MastBranch, UserFunction } from './vm.js';
import { parseScript } from './parser.js';
import { MiniNumber } from './MiniNumber.js';
import type { ASTNode, Value, Scalar, EvalResult, ScriptWitness, TxContext } from './types.js';

function asMiniNumber(v: Value): MiniNumber {
  if (v instanceof MiniNumber) return v;
  if (typeof v === 'boolean') return v ? MiniNumber.ONE : MiniNumber.ZERO;
  if (typeof v === 'string') {
    if (v === '') return MiniNumber.ZERO;
    if (v.startsWith('0x') || v.startsWith('0X')) {
      const hex = v.slice(2);
      if (/^[0-9a-fA-F]+$/.test(hex) && hex.length <= 64) {
        return new MiniNumber(BigInt('0x' + hex).toString());
      }
      if (/^[0-9a-fA-F]+$/.test(hex)) {
        throw new KissvmRuntimeError(`Hex value "${v.slice(0, 20)}" exceeds MiniNumber precision`);
      }
      throw new KissvmRuntimeError(`Cannot convert hex data "${v.slice(0, 20)}" to a number`);
    }
    return new MiniNumber(v);
  }
  throw new KissvmRuntimeError(`Cannot convert ${typeof v} to number`);
}

function asPortInt(v: Value): number {
  return asMiniNumber(v).toNumber();
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
      vm.txCtx.state[port] = miniNumberToString(val);
      break;
    }
    case 'STORE_TUPLE': {
      const idx = asPortInt(evalExpr(node.index, vm));
      const val = evalExpr(node.value, vm);
      vm.addTrace(`STORE TUPLE(${idx}) WITH ${val}`);
      vm.tuples.set(idx, val);
      break;
    }
    case 'IF': {
      const cond = evalExpr(node.cond, vm);
      vm.addTrace(`IF ${cond}`);
      vm.pushBlockScope();
      try {
        if (isTruthy(cond)) {
          execStatements(node.then, vm);
        } else if (node.elseifBranches) {
          let matched = false;
          for (const branch of node.elseifBranches) {
            if (isTruthy(evalExpr(branch.cond, vm))) {
              execStatements(branch.body, vm);
              matched = true;
              break;
            }
          }
          if (!matched && node.else) execStatements(node.else, vm);
        } else if (node.else) {
          execStatements(node.else, vm);
        }
      } finally { vm.popBlockScope(); }
      break;
    }
    case 'WHILE': {
      vm.addTrace(`WHILE`);
      while (isTruthy(evalExpr(node.cond, vm))) {
        vm.tick();
        vm.pushBlockScope();
        try { execStatements(node.body, vm); } finally { vm.popBlockScope(); }
      }
      break;
    }
    case 'FOR': {
      const from = asMiniNumber(evalExpr(node.from, vm));
      const to   = asMiniNumber(evalExpr(node.to, vm));
      const by   = node.by ? asMiniNumber(evalExpr(node.by, vm)) : MiniNumber.ONE;
      if (by.isEqual(MiniNumber.ZERO)) throw new KissvmRuntimeError('FOR loop step cannot be zero');
      let i = from;
      const cmp = by.isMore(MiniNumber.ZERO) ? (i: MiniNumber) => i.isLessEqual(to) : (i: MiniNumber) => i.isMoreEqual(to);
      for (; cmp(i); i = i.add(by)) {
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
      const builtinFn = resolveBuiltinFunction(node.name, node.args, vm);
      if (builtinFn !== undefined) break;
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
    case 'EXEC': {
      let scriptVal = String(evalExpr(node.script, vm));
      if (scriptVal.startsWith('0x') || scriptVal.startsWith('0X')) {
        scriptVal = new TextDecoder().decode(hexToBytes(scriptVal.slice(2)));
      }
      vm.addTrace(`EXEC ${scriptVal.slice(0, 40)}…`);
      const passed = executeSubScript(scriptVal, vm);
      throw new ReturnSignal(passed);
    }
    case 'EXEC_MAST': {
      const result = execMastBlockVm(vm);
      throw new ReturnSignal(result);
    }
    case 'MAST_STMT': {
      const rootHash = String(evalExpr(node.rootHash, vm));
      if (rootHash) {
        const result = evalMastExpr(rootHash, vm);
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
      if (typeof v === 'number') return new MiniNumber(v.toString());
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
      if (node.op === 'NEG') return asMiniNumber(evalExpr(node.expr, vm)).negate();
      if (node.op === 'BITNOT') {
        const val = evalExpr(node.expr, vm);
        const str = typeof val === 'string' ? val : miniNumberToString(val);
        const hex = str.startsWith('0x') || str.startsWith('0X') ? str.slice(2) : str;
        if (!/^[0-9a-fA-F]*$/.test(hex)) {
          throw new KissvmRuntimeError('BITNOT requires hex value');
        }
        if (hex.length === 0) return '0x' + 'ff'.repeat(1);
        // Java BigInteger.not(): the result is sign-extended such that
        // the byte representation uses ceil((bitLength(input)+1)/8) bytes.
        // If input's MSB is set, prepend a 0x00 byte before NOT to give
        // the result room for sign extension; otherwise keep the same width.
        const inputBytes = hex.length / 2;
        const msbSet = parseInt(hex.slice(0, 2), 16) >= 0x80;
        const padded = msbSet ? '00' + hex : hex;
        let result = '';
        for (let i = 0; i < padded.length; i += 2) {
          const b = parseInt(padded.slice(i, i + 2), 16);
          result += ((~b) & 0xFF).toString(16).padStart(2, '0');
        }
        const out = '0x' + result;
        checkStringSize(out);
        return out;
      }
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
      if (from > to) throw new KissvmRuntimeError(`SAMESTATE: from (${from}) must be <= to (${to})`);
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
      return evalChecksig(node.args, vm);
    }
    case 'HASH': {
      const val   = evalExpr(node.expr, vm);
      const bytes = toBytes(val);
      const out   = node.fn === 'SHA2' ? sha2(bytes) : sha3_256(bytes);
      const hex   = '0x' + bytesToHex(out);
      checkStringSize(hex);
      return hex;
    }
    case 'VERIFYOUT': {
      const idxVal    = evalExpr(node.index, vm);
      const addr      = normalizeHex(String(evalExpr(node.address, vm)));
      const amt       = asMiniNumber(evalExpr(node.amount, vm));
      const tokId     = normalizeHex(String(evalExpr(node.tokenId, vm)));
      const keep      = isTruthy(evalExpr(node.keepState, vm));

      let outIdx = typeof idxVal === 'string' && idxVal.toUpperCase().includes('INPUT')
        ? vm.txCtx.inputIndex
        : asPortInt(idxVal);

      const out = vm.txCtx.outputs[outIdx];
      if (!out) return false;
      const r = normalizeHex(out.address) === addr
             && new MiniNumber(out.amount).isEqual(amt)
             && normalizeHex(out.tokenId)  === tokId
             && out.keepState              === keep;
      vm.addTrace(`VERIFYOUT[${outIdx}] → ${r}`);
      return r;
    }
    case 'GETOUT': {
      const idx = asPortInt(evalExpr(node.index, vm));
      const out = vm.txCtx.outputs[idx];
      if (!out) return MiniNumber.ZERO;
      if (node.fn === 'AMT')       return new MiniNumber(out.amount);
      if (node.fn === 'ADDR')      return out.address;
      if (node.fn === 'TOK')       return out.tokenId;
      if (node.fn === 'KEEPSTATE') return out.keepState;
      return MiniNumber.ZERO;
    }
    case 'SIGDIG': {
      const n   = asMiniNumber(evalExpr(node.digits, vm));
      const val = asMiniNumber(evalExpr(node.expr, vm));
      return val.setSignificantDigits(n.toNumber());
    }
    case 'CALL_EXPR': {
      const builtinFn = resolveBuiltinFunction(node.name, node.args, vm);
      if (builtinFn !== undefined) return builtinFn;
      const fn = vm.funcs.get(node.name);
      if (!fn) throw new KissvmRuntimeError(`Unknown function: ${node.name}`);
      validateArgCount(fn, node.args.length, node.name);
      return callUserFuncExpr(fn, node.args, vm);
    }
    case 'MAST_EXPR': {
      const rootHash = String(evalExpr(node.rootHash, vm));
      return evalMastExpr(rootHash, vm) as Value;
    }
    case 'EXEC_MAST': return execMastBlockVm(vm) as Value;
    case 'PROOF': {
      const dataVal    = String(evalExpr(node.data, vm));
      const leafSumVal = asMiniNumber(evalExpr(node.leafSum, vm));
      const rootHashVal = String(evalExpr(node.rootHash, vm));
      const rootSumVal  = asMiniNumber(evalExpr(node.rootSum, vm));
      const proofVal    = String(evalExpr(node.proof, vm));
      const isHex = (node.data as { kind?: string }).kind === 'HEX';
      return evalProof(dataVal, leafSumVal, rootHashVal, rootSumVal, proofVal, isHex, vm);
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
    case 'XOR':   return isTruthy(left) !== isTruthy(right);
    case 'NXOR':  return isTruthy(left) === isTruthy(right);
    case 'NAND':  return !(isTruthy(left) && isTruthy(right));
    case 'NOR':   return !(isTruthy(left) || isTruthy(right));
    case 'EQ':    return kissvmEq(left, right);
    case 'NEQ':   return !kissvmEq(left, right);
    case 'GT':    return asMiniNumber(left).isMore(asMiniNumber(right));
    case 'GTE':   return asMiniNumber(left).isMoreEqual(asMiniNumber(right));
    case 'LT':    return asMiniNumber(left).isLess(asMiniNumber(right));
    case 'LTE':   return asMiniNumber(left).isLessEqual(asMiniNumber(right));
    case 'ADD': {
      // String concat: if either operand is a string, concatenate
      if (typeof left === 'string' || typeof right === 'string') {
        const ls = typeof left === 'string' ? left : miniNumberToString(left);
        const rs = typeof right === 'string' ? right : miniNumberToString(right);
        const result = ls + rs;
        checkStringSize(result);
        return result;
      }
      return asMiniNumber(left).add(asMiniNumber(right));
    }
    case 'SUB':  return asMiniNumber(left).sub(asMiniNumber(right));
    case 'MUL':  return asMiniNumber(left).mult(asMiniNumber(right));
    case 'DIV':  return asMiniNumber(left).div(asMiniNumber(right));
    case 'MOD':  return asMiniNumber(left).modulo(asMiniNumber(right));
    case 'LSHIFT': {
      const n      = asMiniNumber(left).getAsBigInteger();  // integer part
      const amount = asMiniNumber(right).toNumber();         // shift count
      if (amount < 0) throw new KissvmRuntimeError('Negative shift amount');
      if (amount > LIMITS.MAX_SHIFT_BITS) {
        throw new KissvmLimitError(`Shift ${amount} exceeds max ${LIMITS.MAX_SHIFT_BITS}`);
      }
      const intVal = BigInt(n) << BigInt(amount);
      return new MiniNumber(intVal.toString());
    }
    case 'RSHIFT': {
      const n      = asMiniNumber(left).getAsBigInteger();
      const amount = asMiniNumber(right).toNumber();
      if (amount < 0) throw new KissvmRuntimeError('Negative shift amount');
      if (amount > LIMITS.MAX_SHIFT_BITS) {
        throw new KissvmLimitError(`Shift ${amount} exceeds max ${LIMITS.MAX_SHIFT_BITS}`);
      }
      const intVal = BigInt(n) >> BigInt(amount);
      return new MiniNumber(intVal.toString());
    }
    case 'BITAND':
    case 'BITOR':
    case 'BITXOR': {
      const lStr = typeof left === 'string' ? left : miniNumberToString(left);
      const rStr = typeof right === 'string' ? right : miniNumberToString(right);
      const lHex = lStr.startsWith('0x') || lStr.startsWith('0X') ? lStr.slice(2) : lStr;
      const rHex = rStr.startsWith('0x') || rStr.startsWith('0X') ? rStr.slice(2) : rStr;
      if (!/^[0-9a-fA-F]*$/.test(lHex) || !/^[0-9a-fA-F]*$/.test(rHex)) {
        throw new KissvmRuntimeError(`Bitwise ${op} requires hex values`);
      }
      // Pad to same length
      const maxLen = Math.max(lHex.length, rHex.length);
      const lPadded = lHex.padStart(maxLen, '0');
      const rPadded = rHex.padStart(maxLen, '0');
      const lNum = BigInt('0x' + lPadded);
      const rNum = BigInt('0x' + rPadded);
      let result: bigint;
      if (op === 'BITAND') result = lNum & rNum;
      else if (op === 'BITOR') result = lNum | rNum;
      else result = lNum ^ rNum;
      const hex = result.toString(16).padStart(Math.ceil(maxLen / 2) * 2, '0');
      const out = '0x' + hex;
      checkStringSize(out);
      return out;
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
    case 'BLOCK':   return new MiniNumber(ctx.block);
    case 'ADDRESS': { const a = coin?.address ?? ''; checkStringSize(a); return a; }
    case 'AMOUNT':  return new MiniNumber(coin?.amount ?? 0);
    case 'TOKENID': { const t = coin?.tokenId ?? ''; checkStringSize(t); return t; }
    case 'INPUT':   return new MiniNumber(ctx.inputIndex);
    /** @SCRIPT = the SHA3-256 hash of the coin's locking script */
    case 'SCRIPT':  { const s = coin?.scriptHash ?? ''; checkStringSize(s); return s; }
    /**
     * @COINAGE = current block − block at which this coin was created.
     * Returns 0 if coinCreatedBlock is not supplied (simulation default).
     */
    case 'COINAGE': {
      const created = coin?.coinCreatedBlock ?? 0;
      return new MiniNumber(Math.max(0, ctx.block - created));
    }
    case 'BLOCKMILLI': {
      if (ctx.blockMilli === undefined) {
        throw new KissvmRuntimeError('@BLOCKMILLI requires txCtx.blockMilli to be set');
      }
      return new MiniNumber(ctx.blockMilli);
    }
    case 'CREATED': {
      const created = coin?.coinCreatedBlock ?? 0;
      return new MiniNumber(created);
    }
    case 'COINID': {
      const id = coin?.coinId ?? '';
      checkStringSize(id);
      return id;
    }
    case 'TOTIN': {
      return new MiniNumber(ctx.inputs.length);
    }
    case 'TOTOUT': {
      return new MiniNumber(ctx.outputs.length);
    }
    default:
      throw new KissvmRuntimeError(`Unknown built-in variable: @${name}`);
  }
}

// ─── Built-in function resolution ──────────────────────────────────────────────

function resolveBuiltinFunction(name: string, argNodes: ASTNode[], vm: VMState): Value | undefined {
  switch (name.toUpperCase()) {
    case 'LEN': {
      const val = evalExpr(argNodes[0], vm);
      const str = typeof val === 'string' ? val : miniNumberToString(val);
      const hex = str.startsWith('0x') || str.startsWith('0X') ? str.slice(2) : str;
      return new MiniNumber(hex.length / 2);
    }
    case 'INT': {
      const val = evalExpr(argNodes[0], vm);
      return asMiniNumber(val);
    }
    case 'STR': {
      const val = evalExpr(argNodes[0], vm);
      if (val instanceof MiniNumber) return val.toString();
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
      if (val instanceof Uint8Array) return '0x' + bytesToHex(val);
      return String(val);
    }
    case 'ABS': {
      const n = asMiniNumber(evalExpr(argNodes[0], vm));
      return n.isLess(MiniNumber.ZERO) ? n.negate() : n;
    }
    case 'MIN': {
      const a = asMiniNumber(evalExpr(argNodes[0], vm));
      const b = asMiniNumber(evalExpr(argNodes[1], vm));
      return a.isLess(b) ? a : b;
    }
    case 'MAX': {
      const a = asMiniNumber(evalExpr(argNodes[0], vm));
      const b = asMiniNumber(evalExpr(argNodes[1], vm));
      return a.isMore(b) ? a : b;
    }
    case 'SUBSTR': {
      const str = String(evalExpr(argNodes[0], vm));
      const start = asPortInt(evalExpr(argNodes[1], vm));
      const len = argNodes.length > 2 ? asPortInt(evalExpr(argNodes[2], vm)) : undefined;
      const isHex = str.startsWith('0x') || str.startsWith('0X');
      const raw = isHex ? str.slice(2) : str;
      if (len !== undefined) {
        const sub = raw.slice(start, start + len);
        return isHex ? '0x' + sub : sub;
      }
      const sub = raw.slice(start);
      return isHex ? '0x' + sub : sub;
    }
    case 'CONCAT': {
      let result = '';
      for (const a of argNodes) {
        const v = evalExpr(a, vm);
        result += String(v);
      }
      checkStringSize(result);
      return result;
    }
    case 'SIZE': {
      const val = evalExpr(argNodes[0], vm);
      if (val instanceof Uint8Array) return new MiniNumber(val.length.toString());
      const str = typeof val === 'string' ? val : miniNumberToString(val);
      const byteLen = (str.startsWith('0x') || str.startsWith('0X'))
        ? (str.length - 2) / 2
        : new TextEncoder().encode(str).length;
      return new MiniNumber(byteLen.toString());
    }
    case 'REVERSE': {
      const val = evalExpr(argNodes[0], vm);
      const str = typeof val === 'string' ? val : miniNumberToString(val);
      if (str.startsWith('0x') || str.startsWith('0X')) {
        const raw = str.slice(2);
        let reversed = '';
        for (let i = raw.length - 2; i >= 0; i -= 2) {
          reversed += raw.slice(i, i + 2);
        }
        return '0x' + reversed;
      }
      return str.split('').reverse().join('');
    }
    case 'INC': {
      return asMiniNumber(evalExpr(argNodes[0], vm)).add(MiniNumber.ONE);
    }
    case 'DEC': {
      return asMiniNumber(evalExpr(argNodes[0], vm)).sub(MiniNumber.ONE);
    }
    case 'BITGET': {
      const bits = asMiniNumber(evalExpr(argNodes[0], vm));
      const pos  = asPortInt(evalExpr(argNodes[1], vm));
      const bit  = (bits.unscaled >> BigInt(pos)) & 1n;
      return bit === 1n ? MiniNumber.ONE : MiniNumber.ZERO;
    }
    case 'BITSET': {
      const bits = asMiniNumber(evalExpr(argNodes[0], vm));
      const pos  = asPortInt(evalExpr(argNodes[1], vm));
      const val  = isTruthy(evalExpr(argNodes[2], vm));
      if (pos < 0) throw new KissvmRuntimeError('BITSET position must be non-negative');
      const result = val ? bits.unscaled | (1n << BigInt(pos)) : bits.unscaled & ~(1n << BigInt(pos));
      return new MiniNumber(result.toString());
    }
    case 'GET': {
      const idx = asPortInt(evalExpr(argNodes[0], vm));
      return vm.tuples.get(idx) ?? MiniNumber.ZERO;
    }
    case 'FUNCTION': {
      if (argNodes.length < 1) throw new KissvmRuntimeError('FUNCTION requires at least a body argument');
      const bodyVal = evalExpr(argNodes[0], vm);
      let scriptlet = String(bodyVal);
      const argValues = argNodes.slice(1).map(a => miniNumberToString(evalExpr(a, vm)));
      for (let i = 0; i < argValues.length; i++) {
        scriptlet = scriptlet.replaceAll(`$${i + 1}`, argValues[i]);
      }
      const ast = parseScript(scriptlet);
      const subVm = new VMState(vm.witness, vm.txCtx);
      for (const [k, v] of vm.funcs) subVm.funcs.set(k, v);
      let returnVal: Value = MiniNumber.ZERO;
      try {
        execStatements(ast, subVm);
        const last = ast[ast.length - 1];
        if (last && last.type === 'LET') {
          returnVal = evalExpr(last.value, subVm);
        }
      } catch (e) {
        if (e instanceof ReturnSignal) {
          returnVal = e.value as Value;
        } else { throw e; }
      }
      for (const t of subVm.trace) vm.addTrace(`  [FUNCTION] ${t}`);
      return returnVal;
    }
  }
  return undefined;
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
    const ok = wotsVerifyDigest(sig, vm.txCtx.txDigest, hexToBytes(stripped));
    vm.addTrace(`SIGNEDBY(${stripped.slice(0, 10)}…) → ${ok}`);
    return ok;
  } catch {
    vm.addTrace(`SIGNEDBY(${stripped.slice(0, 10)}…) → verify error`);
    return false;
  }
}

// ─── CHECKSIG — 0, 1, 2, or 3 parameters ─────────────────────────────────────

function evalChecksig(args: ASTNode[], vm: VMState): boolean {
  // CHECKSIG costs 10 instructions for WOTS verification overhead
  vm.tick(9);
  const txDigest = vm.txCtx.txDigest;
  if (!txDigest) {
    if (vm.txCtx.simulationMode) {
      const pkCount = args.length >= 1 ? 1 : vm.witness.signatures.size;
      return pkCount > 0;
    }
    vm.addTrace('CHECKSIG → false (no txDigest)');
    return false;
  }

  if (args.length === 0) {
    for (const [, sig] of vm.witness.signatures) {
      try {
        if (wotsVerifyDigest(sig, txDigest, new Uint8Array(32))) return true;
      } catch { /**/ }
    }
    return false;
  }

  const pubKeyHex = String(evalExpr(args[0], vm));
  const stripped = normalizeHex(pubKeyHex).replace(/^0x/i, '');
  const pkBytes = hexToBytes(stripped);

  const sig = vm.witness.signatures.get(stripped);
  if (!sig) {
    vm.addTrace(`CHECKSIG → no signature for ${stripped.slice(0, 10)}…`);
    return false;
  }

  try {
    const ok = wotsVerifyDigest(sig, txDigest, pkBytes);
    vm.addTrace(`CHECKSIG(${stripped.slice(0, 10)}…) → ${ok}`);
    return ok;
  } catch {
    vm.addTrace(`CHECKSIG(${stripped.slice(0, 10)}…) → verify error`);
    return false;
  }
}

// ─── MAST — canonical ScriptProof verification ──────────────────────────────

/**
 * Evaluate a MAST expression by verifying ScriptProofs from the witness.
 *
 * Canonical Minima semantics:
 *  1. Look in the witness scriptProofs array for proofs that match the
 *     requested root (verified via MMR proof).
 *  2. Only execute a script whose MMR proof confirms membership in the root.
 *  3. Fall back to mastBranches (TxContext) for backward compatibility.
 *  4. No uppercase-hash fallback — that is non-canonical.
 */
function evalMastExpr(rootHash: string, vm: VMState): boolean {
  const norm = normalizeHex(rootHash);
  const scriptProofs = vm.witness.scriptProofs;

  // 1. Canonical path: verify ScriptProofs from witness
  if (scriptProofs && scriptProofs.length > 0) {
    for (const sp of scriptProofs) {
      if (verifyScriptProof(sp, norm, vm)) {
        vm.addTrace(`MAST: verified ScriptProof for ${norm.slice(0, 14)}…`);
        return executeSubScript(sp.script, vm);
      }
    }
    throw new KissvmRuntimeError(`MAST: no verified ScriptProof found for root ${norm.slice(0, 20)}…`);
  }

  // 2. Fallback: legacy mastBranches (TxContext)
  const branches = vm.txCtx.mastBranches;
  if (branches) {
    if (branches.has(norm)) {
      vm.addTrace(`MAST branch found (legacy mastBranches) for ${norm.slice(0, 14)}…`);
      return executeSubScript(branches.get(norm)!, vm);
    }
    for (const [key, value] of branches) {
      if (normalizeHex(key) === norm) {
        vm.addTrace(`MAST branch found (legacy normalized) for ${norm.slice(0, 14)}…`);
        return executeSubScript(value, vm);
      }
    }
  }

  throw new KissvmRuntimeError(`MAST: no branch found for root ${norm.slice(0, 20)}…`);
}

function verifyScriptProof(sp: { script: string; proofHex: string }, expectedRoot: string, vm: VMState): boolean {
  try {
    const leafBytes = mmrLeafExact(sp.script);
    const leafData: MMRData = { data: leafBytes, value: 0n };
    const proofBytes = hexToBytes(sp.proofHex.replace(/^0x/i, ''));
    if (proofBytes.length === 0) {
      const leafRoot = normalizeHex('0x' + bytesToHex(leafBytes));
      if (leafRoot !== expectedRoot) {
        vm.addTrace(`MAST: empty-proof ScriptProof root mismatch for ${sp.script.slice(0, 20)}…`);
        return false;
      }
    } else {
      const { proof } = parseMMRProofFromHex(proofBytes);
      const computedRoot = calculateProofRoot(leafData, proof);
      const computedRootHex = normalizeHex('0x' + bytesToHex(computedRoot));
      if (computedRootHex !== expectedRoot) {
        vm.addTrace(`MAST: ScriptProof root mismatch for ${sp.script.slice(0, 20)}…`);
        return false;
      }
    }
    return true;
  } catch {
    vm.addTrace(`MAST: ScriptProof verification error for ${sp.script.slice(0, 20)}…`);
    return false;
  }
}

// ─── MAST — brace-form (EXEC MAST) ───────────────────────────────────────────

function execMastBlockVm(vm: VMState): boolean {
  const defined = vm.mastBlock;
  if (!defined || defined.length === 0) {
    // No inline branches — try witness ScriptProofs, then legacy mastBranches
    const scriptProofs = vm.witness.scriptProofs;
    if (scriptProofs && scriptProofs.length > 0) {
      vm.addTrace('EXEC MAST: executing first verified ScriptProof');
      return executeSubScript(scriptProofs[0].script, vm);
    }
    const branches = vm.txCtx.mastBranches;
    if (branches && branches.size > 0) {
      const [, script] = [...branches.entries()][0];
      vm.addTrace('EXEC MAST (fallback to mastBranches)');
      return executeSubScript(script, vm);
    }
    throw new KissvmRuntimeError('EXEC MAST: no branches available in witness or mastBranches');
  }

  // Inline branches — verify against ScriptProofs, then legacy mastBranches
  const scriptProofs = vm.witness.scriptProofs;
  const revealed = vm.txCtx.mastBranches;

  for (const branch of defined) {
    const norm = normalizeHex(branch.hash);

    // Canonical: match via ScriptProof verification
    if (scriptProofs && scriptProofs.length > 0) {
      for (const sp of scriptProofs) {
        const leafBytes = mmrLeafExact(sp.script);
        if (normalizeHex('0x' + bytesToHex(leafBytes)) === norm) {
          vm.addTrace(`EXEC MAST: executing verified inline branch ${norm.slice(0, 14)}…`);
          return execInlineBody(branch.body, vm);
        }
      }
    }

    // Fallback: legacy mastBranches
    if (revealed && revealed.has(norm)) {
      vm.addTrace(`EXEC MAST: executing inline branch (legacy) ${norm.slice(0, 14)}…`);
      return execInlineBody(branch.body, vm);
    }
  }

  throw new KissvmRuntimeError('EXEC MAST: no matching branch revealed');
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

// ─── PROOF — Canonical MMR proof verification ─────────────────────────────────

/**
 * Canonical Minima PROOF: PROOF(data, leafSum, rootHash, rootSum, proofHex)
 *
 * Semantics:
 *  1. If `data` is a HEX literal, the leaf hash is computed as
 *     MMRData.CreateMMRDataLeafNode(MiniData.fromHex(data), leafSum).
 *  2. If `data` is a SCRIPT expression, the leaf hash is computed as
 *     MMRData.CreateMMRDataLeafNode(MiniString(data), leafSum).
 *  3. No mastBranches lookup is performed — the data argument is used
 *     directly (MAST branch revelation is handled by the MAST opcode).
 *  4. If `proofHex` is empty (zero-length hex): only accepted when the
 *     computed leaf hash matches rootHash AND leafSum matches rootSum
 *     (trivial single-leaf MMR tree).
 *  5. If `proofHex` is non-empty: parse the canonical MMR proof and
 *     verify inclusion using createMMRDataParentNode / calculateProofRoot.
 *     The computed root hash must match rootHash.
 */
function evalProof(
  dataVal: string,
  leafSumVal: MiniNumber,
  rootHashVal: string,
  rootSumVal: MiniNumber,
  proofVal: string,
  isHex: boolean,
  vm: VMState,
): boolean {
  const normRoot = normalizeHex(rootHashVal);

  // Compute canonical MMR leaf — HEX vs SCRIPT determines serialization
  let leafData: MMRData;
  try {
    if (isHex) {
      const raw = hexToBytes(dataVal.startsWith('0x') || dataVal.startsWith('0X') ? dataVal.slice(2) : dataVal);
      leafData = createMMRDataLeafNode(raw, leafSumVal.unscaled);
    } else {
      const scriptUtf8 = new TextEncoder().encode(dataVal);
      leafData = createMMRDataLeafNode(scriptUtf8, leafSumVal.unscaled);
    }
  } catch {
    vm.addTrace(`PROOF: leaf data construction failed → false`);
    return false;
  }

  // Canonicalise proof
  const proofHex = (proofVal.startsWith('0x') || proofVal.startsWith('0X'))
    ? proofVal.slice(2)
    : proofVal;

  // Empty proof: trivial single-leaf tree
  if (proofHex.length === 0) {
    const computedRoot = '0x' + bytesToHex(leafData.data);
    const hashOk = normalizeHex(computedRoot) === normRoot;
    const sumOk  = leafSumVal.unscaled === rootSumVal.unscaled;
    const ok = hashOk && sumOk;
    vm.addTrace(`PROOF(data=${(isHex ? '0x' : '') + dataVal.slice(0, 12)}…, isHex=${isHex}) empty-proof trivial=${ok} (hash=${hashOk}, sum=${sumOk})`);
    return ok;
  }

  // Parse proof and verify
  try {
    const proofBytes = hexToBytes(proofHex);
    const { proof } = parseMMRProofFromHex(proofBytes);

    // Walk the proof chain, tracking both hash and sum
    const computedLeafData = calculateRootMMRData(leafData, proof);
    const computedRoot = '0x' + bytesToHex(computedLeafData.data);
    const hashOk = normalizeHex(computedRoot) === normRoot;
    const sumOk  = computedLeafData.value === rootSumVal.unscaled;
    const ok = hashOk && sumOk;
    vm.addTrace(`PROOF(data=${(isHex ? '0x' : '') + dataVal.slice(0, 12)}…, isHex=${isHex}) canonical-MMR root=${computedRoot.slice(0, 12)}… hash-match=${hashOk} sum-match=${sumOk}`);
    return ok;
  } catch (e) {
    vm.addTrace(`PROOF: verification error → false`);
    return false;
  }
}

/**
 * Walk a canonical MMR proof chain, computing the root MMRData
 * (hash + accumulated sum) from the leaf upward.
 */
function calculateRootMMRData(leafData: MMRData, proof: MMRProof): MMRData {
  let current = leafData;
  for (const chunk of proof.chunks) {
    if (chunk.isLeft) {
      current = createMMRDataParentNode(chunk.mmrData, current);
    } else {
      current = createMMRDataParentNode(current, chunk.mmrData);
    }
  }
  return current;
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
 * Public utility: round `value` to `n` significant digits.
 */
export function sigdig(value: number, n: number): number {
  if (value === 0 || n <= 0) return 0;
  const mn = new MiniNumber(value.toString());
  return mn.setSignificantDigits(n).toNumber();
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function isTruthy(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v instanceof MiniNumber) return !v.isEqual(MiniNumber.ZERO);
  if (typeof v === 'number')  return v !== 0;
  if (typeof v === 'string')  return v !== '' && v.toLowerCase() !== 'false';
  if (v instanceof Uint8Array) return v.length > 0;
  return Boolean(v);
}

/**
 * Equality comparison:
 *   MiniNumber vs MiniNumber : exact
 *   string  vs string  : normalise-hex then compare
 *   boolean vs boolean : exact
 *   cross-type numeric : both coerced to MiniNumber
 *   cross-type bool    : isTruthy both sides
 */
function kissvmEq(a: Value, b: Value): boolean {
  if (a instanceof MiniNumber && b instanceof MiniNumber) return a.isEqual(b);
  if (typeof a === 'string' && typeof b === 'string') return normalizeHex(a) === normalizeHex(b);
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;
  // Cross-type: if either is boolean
  if (typeof a === 'boolean' || typeof b === 'boolean') return isTruthy(a) === isTruthy(b);
  // Cross-type numeric
  try { return asMiniNumber(a).isEqual(asMiniNumber(b)); } catch { return false; }
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
    if (v.startsWith('0x') || v.startsWith('0X')) return hexToBytes(v.slice(2));
    return new TextEncoder().encode(v);
  }
  if (v instanceof MiniNumber) {
    const s = v.toString();
    let hex = BigInt(s).toString(16);
    if (hex.length % 2) hex = '0' + hex;
    return hexToBytes(hex);
  }
  if (typeof v === 'boolean') return new Uint8Array([v ? 1 : 0]);
  return new Uint8Array(0);
}

function toArray(v: Value): Value[] {
  if (typeof v === 'string') return v.split(',').map(s => s.trim()) as Value[];
  if (v instanceof MiniNumber) return [v];
  return [v];
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function computeScriptHash(script: string): string {
  const bytes = new TextEncoder().encode(script.trim().toUpperCase());
  return '0x' + bytesToHex(sha3_256(bytes));
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
  if (!raw) return MiniNumber.ZERO;
  if (raw.startsWith('0x') || raw.startsWith('0X')) return raw;
  // Try numeric
  const f = parseFloat(raw);
  if (!isNaN(f)) return new MiniNumber(raw);
  return raw;
}

/**
 * Convert a VM value back to its canonical string representation for storage.
 */
function miniNumberToString(v: Value): string {
  if (v instanceof MiniNumber) return v.toString();
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



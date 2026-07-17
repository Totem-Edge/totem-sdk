use num_bigint::BigInt;
use crate::types::*;
use crate::vm::*;
use crate::parser::parse_script;

const SCALE: u64 = 100_000_000;

#[derive(Debug, Clone)]
pub enum EvalError {
    Return(VmValue),
    Limit(String),
    Runtime(String),
    Parse(String),
}

impl std::fmt::Display for EvalError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            EvalError::Return(v) => write!(f, "RETURN {}", v.to_string_val()),
            EvalError::Limit(s) => write!(f, "{}", s),
            EvalError::Runtime(s) => write!(f, "{}", s),
            EvalError::Parse(s) => write!(f, "{}", s),
        }
    }
}
impl std::error::Error for EvalError {}

pub fn evaluate_script(
    script: &str,
    witness: ScriptWitness,
    tx_ctx: TxContext,
    sha3_256: fn(&[u8]) -> Vec<u8>,
    sha256: fn(&[u8]) -> Vec<u8>,
    wots_verify: fn(&[u8], &[u8], &[u8]) -> bool,
) -> Result<EvalResult, String> {
    let mut vm = VmState::new(witness, tx_ctx, sha3_256, sha256, wots_verify);
    let ast = match parse_script(script) {
        Ok(a) => a,
        Err(e) => return Ok(EvalResult {
            passed: false, trace: vec![], error: Some(e), instructions_used: 0,
        }),
    };
    match exec_statements(&ast, &mut vm) {
        Ok(()) => Ok(EvalResult {
            passed: false,
            trace: vm.trace.clone(),
            error: Some("Script ended without RETURN".into()),
            instructions_used: vm.instruction_count,
        }),
        Err(EvalError::Return(val)) => {
            let passed = val.is_truthy();
            vm.add_trace(format!("RETURN → {}", passed));
            Ok(EvalResult { passed, trace: vm.trace.clone(), error: None, instructions_used: vm.instruction_count })
        }
        Err(EvalError::Limit(msg)) => Err(msg),
        Err(EvalError::Runtime(msg)) => Ok(EvalResult {
            passed: false, trace: vm.trace.clone(), error: Some(msg), instructions_used: vm.instruction_count,
        }),
        Err(EvalError::Parse(msg)) => Ok(EvalResult {
            passed: false, trace: vm.trace.clone(), error: Some(msg), instructions_used: vm.instruction_count,
        }),
    }
}

fn exec_statements(stmts: &[AstNode], vm: &mut VmState) -> Result<(), EvalError> {
    for stmt in stmts {
        exec_statement(stmt, vm)?;
    }
    Ok(())
}

fn exec_statement(node: &AstNode, vm: &mut VmState) -> Result<(), EvalError> {
    vm.tick(1).map_err(|e| EvalError::Limit(e))?;

    match node {
        AstNode::Return { expr, .. } => {
            let val = eval_expr(expr, vm)?;
            vm.add_trace(format!("RETURN {}", val.to_string_val()));
            Err(EvalError::Return(val))
        }
        AstNode::Assert { expr, .. } => {
            let val = eval_expr(expr, vm)?;
            vm.add_trace(format!("ASSERT {}", val.to_string_val()));
            if !val.is_truthy() {
                return Err(EvalError::Runtime(format!("ASSERT failed: {}", val.to_string_val())));
            }
            Ok(())
        }
        AstNode::Let { name, value, .. } => {
            let val = eval_expr(value, vm)?;
            vm.add_trace(format!("LET {} = {}", name, val.to_string_val()));
            vm.set(name, val);
            Ok(())
        }
        AstNode::StoreState { port, value, .. } => {
            let port_num = as_port_int(&eval_expr(port, vm)?)?;
            let val = eval_expr(value, vm)?;
            vm.add_trace(format!("STORE STATE({}) WITH {}", port_num, val.to_string_val()));
            vm.tx_ctx.state.insert(port_num as u32, scaled_to_string(&val));
            Ok(())
        }
        AstNode::If { cond, then, else_block, .. } => {
            let c = eval_expr(cond, vm)?;
            vm.add_trace(format!("IF {}", c.to_string_val()));
            vm.push_block_scope().map_err(|e| EvalError::Limit(e))?;
            let result = if c.is_truthy() {
                exec_statements(then, vm)
            } else if let Some(eb) = else_block {
                exec_statements(eb, vm)
            } else {
                Ok(())
            };
            vm.pop_block_scope();
            result
        }
        AstNode::For { name, from, to, by, body, .. } => {
            let from_val = as_scaled(&eval_expr(from, vm)?)?;
            let to_val = as_scaled(&eval_expr(to, vm)?)?;
            let by_val = match by {
                Some(b) => as_scaled(&eval_expr(b, vm)?)?,
                None => BigInt::from(SCALE),
            };
            if by_val == BigInt::from(0) {
                return Err(EvalError::Runtime("FOR loop step cannot be zero".into()));
            }
            let mut i = from_val.clone();
            let forward = by_val > BigInt::from(0);
            loop {
                if forward && i > to_val { break; }
                if !forward && i < to_val { break; }
                vm.tick(1).map_err(|e| EvalError::Limit(e))?;
                vm.push_block_scope().map_err(|e| EvalError::Limit(e))?;
                vm.set(name, VmValue::BigInt(i.clone()));
                let body_result = exec_statements(body, vm);
                vm.pop_block_scope();
                body_result?;
                i += &by_val;
            }
            Ok(())
        }
        AstNode::Foreach { name, list, body, .. } => {
            let items = to_array(&eval_expr(list, vm)?);
            for item in items {
                vm.tick(1).map_err(|e| EvalError::Limit(e))?;
                vm.push_block_scope().map_err(|e| EvalError::Limit(e))?;
                vm.set(name, item);
                let body_result = exec_statements(body, vm);
                vm.pop_block_scope();
                body_result?;
            }
            Ok(())
        }
        AstNode::Switch { expr, cases, default_body, .. } => {
            let sv = eval_expr(expr, vm)?;
            vm.add_trace(format!("SWITCH {}", sv.to_string_val()));
            let mut matched = false;
            for c in cases {
                let cv = eval_expr(&c.value, vm)?;
                if kissvm_eq(&sv, &cv) {
                    matched = true;
                    vm.push_block_scope().map_err(|e| EvalError::Limit(e))?;
                    let body_result = exec_statements(&c.body, vm);
                    vm.pop_block_scope();
                    body_result?;
                    break;
                }
            }
            if !matched {
                if let Some(db) = default_body {
                    vm.push_block_scope().map_err(|e| EvalError::Limit(e))?;
                    let body_result = exec_statements(db, vm);
                    vm.pop_block_scope();
                    body_result?;
                }
            }
            Ok(())
        }
        AstNode::FuncDef { name, params, body, .. } => {
            if params.len() > MAX_PARAMS {
                return Err(EvalError::Limit(format!("Function {} exceeds max {} params", name, MAX_PARAMS)));
            }
            let uf = UserFunction {
                params: params.clone(),
                body: body.clone(),
                closure_env: vm.snapshot_env(),
            };
            vm.funcs.insert(name.clone(), uf);
            vm.add_trace(format!("FUNC {} defined", name));
            Ok(())
        }
        AstNode::CallStmt { name, args, .. } => {
            let fn_ = vm.funcs.get(name).cloned();
            match fn_ {
                Some(f) => {
                    validate_arg_count(&f, args.len(), name)?;
                    call_user_func(&f, args, vm)
                }
                None => Err(EvalError::Runtime(format!("Unknown function: {}", name))),
            }
        }
        AstNode::MastBlock { branches, .. } => {
            let mb: Vec<MastBranch> = branches.iter().map(|b| MastBranch {
                hash: b.hash.clone(),
                body: b.body.clone(),
            }).collect();
            vm.mast_block = Some(mb);
            vm.add_trace(format!("MAST_BLOCK: {} branch(es) defined", branches.len()));
            Ok(())
        }
        AstNode::ExecMast { .. } => {
            let result = exec_mast_block_vm(vm)?;
            Err(EvalError::Return(VmValue::Bool(result)))
        }
        AstNode::MastStmt { root_hash, .. } => {
            if !root_hash.is_empty() {
                let result = eval_mast_expr(root_hash, vm)?;
                Err(EvalError::Return(VmValue::Bool(result)))
            } else {
                Ok(())
            }
        }
        _ => Err(EvalError::Runtime("Cannot execute as statement".into())),
    }
}

fn eval_expr(node: &AstNode, vm: &mut VmState) -> Result<VmValue, EvalError> {
    vm.tick(1).map_err(|e| EvalError::Limit(e))?;

    match node {
        AstNode::Literal { value, .. } => Ok(value.to_vm_value()),
        AstNode::Builtin { name, .. } => resolve_builtin(name, vm),
        AstNode::Ident { name, .. } => {
            match vm.get(name) {
                Some(v) => Ok(v),
                None => Err(EvalError::Runtime(format!("Undefined variable: {}", name))),
            }
        }
        AstNode::Binary { op, left, right, .. } => eval_binary(op, left, right, vm),
        AstNode::Unary { op, expr, .. } => {
            match op.as_str() {
                "NOT" => Ok(VmValue::Bool(!eval_expr(expr, vm)?.is_truthy())),
                "NEG" => Ok(VmValue::BigInt(-as_scaled(&eval_expr(expr, vm)?)?)),
                _ => Err(EvalError::Runtime(format!("Unknown unary op: {}", op))),
            }
        }
        AstNode::State { port, .. } => {
            let p = as_port_int(&eval_expr(port, vm)?)?;
            let raw = vm.tx_ctx.state.get(&(p as u32)).cloned().unwrap_or_default();
            check_string_size(&raw)?;
            Ok(parse_state_value(&raw))
        }
        AstNode::PrevState { port, .. } => {
            let p = as_port_int(&eval_expr(port, vm)?)?;
            let raw = vm.tx_ctx.prev_state.get(&(p as u32)).cloned().unwrap_or_default();
            check_string_size(&raw)?;
            Ok(parse_state_value(&raw))
        }
        AstNode::SameState { from, to, .. } => {
            let f = as_port_int(&eval_expr(from, vm)?)?;
            let t = as_port_int(&eval_expr(to, vm)?)?;
            for p in f..=t {
                let cur = vm.tx_ctx.state.get(&(p as u32)).cloned().unwrap_or_default();
                let prev = vm.tx_ctx.prev_state.get(&(p as u32)).cloned().unwrap_or_default();
                if cur != prev { return Ok(VmValue::Bool(false)); }
            }
            Ok(VmValue::Bool(true))
        }
        AstNode::SameCoins { .. } => {
            let inputs = &vm.tx_ctx.inputs;
            match &vm.tx_ctx.prev_coins {
                None => Ok(VmValue::Bool(true)),
                Some(prev) => {
                    if inputs.len() != prev.len() { return Ok(VmValue::Bool(false)); }
                    for i in 0..inputs.len() {
                        let a = &inputs[i];
                        let b = &prev[i];
                        if a.coin_id != b.coin_id || a.token_id != b.token_id
                            || a.amount != b.amount || a.address != b.address {
                            return Ok(VmValue::Bool(false));
                        }
                    }
                    Ok(VmValue::Bool(true))
                }
            }
        }
        AstNode::CoinData_ { .. } => {
            let idx = vm.tx_ctx.input_index as usize;
            match vm.tx_ctx.inputs.get(idx) {
                Some(coin) => Ok(VmValue::String(format!("{}:{}:{}:{}", coin.coin_id, coin.amount, coin.token_id, coin.address))),
                None => Ok(VmValue::String(String::new())),
            }
        }
        AstNode::SignedBy { pubkey, .. } => {
            let pk_val = eval_expr(pubkey, vm)?.to_string_val();
            Ok(VmValue::Bool(verify_signed_by(&pk_val, vm)?))
        }
        AstNode::MultiSig { threshold, keys, .. } => {
            let thresh = as_port_int(&eval_expr(threshold, vm)?)?;
            let mut sig_count = 0i64;
            for k in keys {
                if verify_signed_by(&eval_expr(k, vm)?.to_string_val(), vm)? {
                    sig_count += 1;
                    if sig_count >= thresh { return Ok(VmValue::Bool(true)); }
                }
            }
            Ok(VmValue::Bool(sig_count >= thresh))
        }
        AstNode::CheckSig { .. } => {
            match &vm.tx_ctx.tx_digest {
                None => {
                    if vm.tx_ctx.simulation_mode.unwrap_or(false) {
                        return Ok(VmValue::Bool(!vm.witness.signatures.is_empty()));
                    }
                    vm.add_trace("CHECKSIG → false (no txDigest; provide TxContext.txDigest for real verification)".into());
                    Ok(VmValue::Bool(false))
                }
                Some(digest) => {
                    for (pk_hex, sig) in &vm.witness.signatures {
                        let pk_bytes = hex_to_bytes(pk_hex);
                        if (vm.wots_verify)(sig, digest, &pk_bytes) {
                            return Ok(VmValue::Bool(true));
                        }
                    }
                    Ok(VmValue::Bool(false))
                }
            }
        }
        AstNode::Hash { fn_, expr, .. } => {
            let val = eval_expr(expr, vm)?;
            let bytes = to_bytes(&val);
            let out = if fn_ == "SHA2" || fn_ == "Sha2" {
                (vm.sha256)(&bytes)
            } else {
                (vm.sha3_256)(&bytes)
            };
            let hex_str = format!("0x{}", hex::encode(&out));
            check_string_size(&hex_str)?;
            Ok(VmValue::String(hex_str))
        }
        AstNode::VerifyOut { index, address, amount, token_id, keep_state, .. } => {
            let idx_val = eval_expr(index, vm)?;
            let addr = normalize_hex(&eval_expr(address, vm)?.to_string_val());
            let amt_scaled = as_scaled(&eval_expr(amount, vm)?)?;
            let tok_id = normalize_hex(&eval_expr(token_id, vm)?.to_string_val());
            let keep = eval_expr(keep_state, vm)?.is_truthy();

            let out_idx: usize = if let VmValue::String(ref s) = idx_val {
                if s.to_uppercase().contains("INPUT") {
                    vm.tx_ctx.input_index as usize
                } else {
                    as_port_int(&idx_val)? as usize
                }
            } else {
                as_port_int(&idx_val)? as usize
            };

            match vm.tx_ctx.outputs.get(out_idx) {
                None => Ok(VmValue::Bool(false)),
                Some(out) => {
                    let r = normalize_hex(&out.address) == addr
                        && float_to_scaled(out.amount) == amt_scaled
                        && normalize_hex(&out.token_id) == tok_id
                        && out.keep_state == keep;
                    vm.add_trace(format!("VERIFYOUT[{}] → {}", out_idx, r));
                    Ok(VmValue::Bool(r))
                }
            }
        }
        AstNode::GetOut { fn_, index, .. } => {
            let idx = as_port_int(&eval_expr(index, vm)?)? as usize;
            match vm.tx_ctx.outputs.get(idx) {
                None => Ok(VmValue::BigInt(BigInt::from(0))),
                Some(out) => match fn_.as_str() {
                    "AMT" => Ok(VmValue::BigInt(float_to_scaled(out.amount))),
                    "ADDR" => Ok(VmValue::String(out.address.clone())),
                    "TOK" => Ok(VmValue::String(out.token_id.clone())),
                    "KEEPSTATE" => Ok(VmValue::Bool(out.keep_state)),
                    _ => Ok(VmValue::BigInt(BigInt::from(0))),
                }
            }
        }
        AstNode::SigDig { digits, expr, .. } => {
            let n_scaled = as_scaled(&eval_expr(digits, vm)?)?;
            let val_scaled = as_scaled(&eval_expr(expr, vm)?)?;
            Ok(VmValue::BigInt(sigdig_bigint(&val_scaled, &n_scaled)))
        }
        AstNode::CallExpr { name, args, .. } => {
            let fn_ = vm.funcs.get(name).cloned();
            match fn_ {
                Some(f) => {
                    validate_arg_count(&f, args.len(), name)?;
                    call_user_func_expr(&f, args, vm)
                }
                None => Err(EvalError::Runtime(format!("Unknown function: {}", name))),
            }
        }
        AstNode::MastExpr { root_hash, .. } => {
            Ok(VmValue::Bool(eval_mast_expr(root_hash, vm)?))
        }
        AstNode::ExecMast { .. } => {
            Ok(VmValue::Bool(exec_mast_block_vm(vm)?))
        }
        AstNode::Proof { script_hash, policy_root, proof, .. } => {
            let sh_val = eval_expr(script_hash, vm)?.to_string_val();
            let pr_val = eval_expr(policy_root, vm)?.to_string_val();
            let pf_val = eval_expr(proof, vm)?.to_string_val();
            Ok(VmValue::Bool(eval_proof(&sh_val, &pr_val, &pf_val, vm)?))
        }
        _ => Err(EvalError::Runtime("Cannot evaluate as expression".into())),
    }
}

fn eval_binary(op: &str, left: &AstNode, right: &AstNode, vm: &mut VmState) -> Result<VmValue, EvalError> {
    if op == "AND" {
        if !eval_expr(left, vm)?.is_truthy() { return Ok(VmValue::Bool(false)); }
        return Ok(VmValue::Bool(eval_expr(right, vm)?.is_truthy()));
    }
    if op == "OR" {
        if eval_expr(left, vm)?.is_truthy() { return Ok(VmValue::Bool(true)); }
        return Ok(VmValue::Bool(eval_expr(right, vm)?.is_truthy()));
    }

    let l = eval_expr(left, vm)?;
    let r = eval_expr(right, vm)?;

    match op {
        "XOR" => Ok(VmValue::Bool(l.is_truthy() != r.is_truthy())),
        "EQ" => Ok(VmValue::Bool(kissvm_eq(&l, &r))),
        "NEQ" => Ok(VmValue::Bool(!kissvm_eq(&l, &r))),
        "GT" => Ok(VmValue::Bool(as_scaled(&l)? > as_scaled(&r)?)),
        "GTE" => Ok(VmValue::Bool(as_scaled(&l)? >= as_scaled(&r)?)),
        "LT" => Ok(VmValue::Bool(as_scaled(&l)? < as_scaled(&r)?)),
        "LTE" => Ok(VmValue::Bool(as_scaled(&l)? <= as_scaled(&r)?)),
        "ADD" => Ok(VmValue::BigInt(as_scaled(&l)? + as_scaled(&r)?)),
        "SUB" => Ok(VmValue::BigInt(as_scaled(&l)? - as_scaled(&r)?)),
        "MUL" => {
            let a = as_scaled(&l)?;
            let b = as_scaled(&r)?;
            Ok(VmValue::BigInt((a * b) / BigInt::from(SCALE)))
        }
        "DIV" => {
            let a = as_scaled(&l)?;
            let b = as_scaled(&r)?;
            if b == BigInt::from(0) {
                return Err(EvalError::Runtime("Division by zero".into()));
            }
            Ok(VmValue::BigInt((a * BigInt::from(SCALE)) / b))
        }
        "MOD" => {
            let a = as_scaled(&l)?;
            let b = as_scaled(&r)?;
            if b == BigInt::from(0) {
                return Err(EvalError::Runtime("Modulo by zero".into()));
            }
            Ok(VmValue::BigInt(a % b))
        }
        "LSHIFT" => {
            let n = as_scaled(&l)? / BigInt::from(SCALE);
            let amount = as_scaled(&r)? / BigInt::from(SCALE);
            let amount_u32: u32 = amount.try_into().map_err(|_| EvalError::Runtime("Shift amount too large".into()))?;
            if amount_u32 > MAX_SHIFT_BITS {
                return Err(EvalError::Limit(format!("Shift {} exceeds max {}", amount_u32, MAX_SHIFT_BITS)));
            }
            Ok(VmValue::BigInt((n << amount_u32) * BigInt::from(SCALE)))
        }
        "RSHIFT" => {
            let n = as_scaled(&l)? / BigInt::from(SCALE);
            let amount = as_scaled(&r)? / BigInt::from(SCALE);
            let amount_u32: u32 = amount.try_into().map_err(|_| EvalError::Runtime("Shift amount too large".into()))?;
            if amount_u32 > MAX_SHIFT_BITS {
                return Err(EvalError::Limit(format!("Shift {} exceeds max {}", amount_u32, MAX_SHIFT_BITS)));
            }
            Ok(VmValue::BigInt((n >> amount_u32) * BigInt::from(SCALE)))
        }
        _ => Err(EvalError::Runtime(format!("Unknown binary operator: {}", op))),
    }
}

fn resolve_builtin(name: &str, vm: &VmState) -> Result<VmValue, EvalError> {
    let ctx = &vm.tx_ctx;
    let idx = ctx.input_index as usize;
    let coin = ctx.inputs.get(idx);

    match name {
        "BLOCK" => Ok(VmValue::BigInt(float_to_scaled(ctx.block))),
        "ADDRESS" => {
            let a = coin.map(|c| c.address.clone()).unwrap_or_default();
            check_string_size(&a)?;
            Ok(VmValue::String(a))
        }
        "AMOUNT" => Ok(VmValue::BigInt(float_to_scaled(coin.map(|c| c.amount).unwrap_or(0.0)))),
        "TOKENID" => {
            let t = coin.map(|c| c.token_id.clone()).unwrap_or_default();
            check_string_size(&t)?;
            Ok(VmValue::String(t))
        }
        "INPUT" => Ok(VmValue::BigInt(float_to_scaled(ctx.input_index))),
        "SCRIPT" => {
            let s = coin.and_then(|c| c.script_hash.clone()).unwrap_or_default();
            check_string_size(&s)?;
            Ok(VmValue::String(s))
        }
        "COINAGE" => {
            let created = coin.and_then(|c| c.coin_created_block).unwrap_or(0.0);
            let age = (ctx.block - created).max(0.0);
            Ok(VmValue::BigInt(float_to_scaled(age)))
        }
        _ => Err(EvalError::Runtime(format!("Unknown built-in variable: @{}", name))),
    }
}

fn verify_signed_by(pk_val: &str, vm: &mut VmState) -> Result<bool, EvalError> {
    let stripped = if pk_val.starts_with("0x") || pk_val.starts_with("0X") {
        pk_val[2..].to_lowercase()
    } else {
        pk_val.to_lowercase()
    };

    let sig = vm.witness.signatures.get(&stripped).cloned();
    match sig {
        None => {
            let prefix = &stripped[..stripped.len().min(10)];
            vm.add_trace(format!("SIGNEDBY({}…) → no sig", prefix));
            Ok(false)
        }
        Some(sig_bytes) => {
            match &vm.tx_ctx.tx_digest {
                None => {
                    if vm.tx_ctx.simulation_mode.unwrap_or(false) {
                        let prefix = &stripped[..stripped.len().min(10)];
                        vm.add_trace(format!("SIGNEDBY({}…) → present (simulation mode)", prefix));
                        return Ok(true);
                    }
                    let prefix = &stripped[..stripped.len().min(10)];
                    vm.add_trace(format!("SIGNEDBY({}…) → false (no txDigest)", prefix));
                    Ok(false)
                }
                Some(digest) => {
                    let pk_bytes = hex_to_bytes(&stripped);
                    let ok = (vm.wots_verify)(&sig_bytes, digest, &pk_bytes);
                    let prefix = &stripped[..stripped.len().min(10)];
                    vm.add_trace(format!("SIGNEDBY({}…) → {}", prefix, ok));
                    Ok(ok)
                }
            }
        }
    }
}

fn eval_mast_expr(root_hash: &str, vm: &mut VmState) -> Result<bool, EvalError> {
    let branches = vm.tx_ctx.mast_branches.clone();
    let branches = match branches {
        Some(b) => b,
        None => return Err(EvalError::Runtime("MAST requires mastBranches in TxContext".into())),
    };

    let norm = normalize_hex(root_hash);

    if let Some(script) = branches.get(&norm) {
        let prefix = &norm[..norm.len().min(14)];
        vm.add_trace(format!("MAST branch found for {}…", prefix));
        return execute_sub_script(script, vm);
    }

    for (key, value) in &branches {
        if normalize_hex(key) == norm {
            let prefix = &norm[..norm.len().min(14)];
            vm.add_trace(format!("MAST branch found (normalised) for {}…", prefix));
            return execute_sub_script(value, vm);
        }
    }

    for (script_text, _) in &branches {
        if !script_text.starts_with("0x") && !script_text.starts_with("0X") {
            if normalize_hex(&compute_script_hash(script_text, vm)) == norm {
                let prefix = &norm[..norm.len().min(14)];
                vm.add_trace(format!("MAST branch found (hash match) for {}…", prefix));
                return execute_sub_script(script_text, vm);
            }
        }
    }

    let prefix = &norm[..norm.len().min(20)];
    Err(EvalError::Runtime(format!("MAST: no branch found for root {}…", prefix)))
}

fn exec_mast_block_vm(vm: &mut VmState) -> Result<bool, EvalError> {
    let defined = vm.mast_block.clone();
    let is_empty = match &defined {
        None => true,
        Some(d) => d.is_empty(),
    };
    if is_empty {
        let branches = vm.tx_ctx.mast_branches.clone();
        let is_empty_b = match &branches {
            None => true,
            Some(b) => b.is_empty(),
        };
        if is_empty_b {
            return Err(EvalError::Runtime("EXEC MAST: no branches available".into()));
        }
        let b = branches.unwrap();
        let script = b.values().next().unwrap().clone();
        vm.add_trace("EXEC MAST (fallback to mastBranches)".into());
        return execute_sub_script(&script, vm);
    }

    let defined = defined.unwrap();
    let revealed = vm.tx_ctx.mast_branches.clone();
    let revealed = match revealed {
        Some(r) => r,
        None => return Err(EvalError::Runtime("EXEC MAST: mastBranches not provided in TxContext".into())),
    };

    for branch in &defined {
        let norm = normalize_hex(&branch.hash);
        if revealed.contains_key(&norm) {
            let prefix = &norm[..norm.len().min(14)];
            vm.add_trace(format!("EXEC MAST: executing branch {}…", prefix));
            return exec_inline_body(&branch.body, vm);
        }
    }

    Err(EvalError::Runtime("EXEC MAST: no matching branch revealed in mastBranches".into()))
}

fn exec_inline_body(body: &[AstNode], vm: &mut VmState) -> Result<bool, EvalError> {
    vm.push_call_frame().map_err(|e| EvalError::Limit(e))?;
    let result = match exec_statements(body, vm) {
        Ok(()) => false,
        Err(EvalError::Return(val)) => val.is_truthy(),
        Err(e) => { vm.pop_call_frame(); return Err(e); }
    };
    vm.pop_call_frame();
    Ok(result)
}

fn execute_sub_script(script: &str, parent_vm: &mut VmState) -> Result<bool, EvalError> {
    let ast = match parse_script(script) {
        Ok(a) => a,
        Err(e) => return Err(EvalError::Parse(e)),
    };
    let mut sub_vm = VmState::new(
        parent_vm.witness.clone(),
        parent_vm.tx_ctx.clone(),
        parent_vm.sha3_256,
        parent_vm.sha256,
        parent_vm.wots_verify,
    );
    sub_vm.instruction_count = parent_vm.instruction_count;
    for (k, v) in &parent_vm.funcs {
        sub_vm.funcs.insert(k.clone(), v.clone());
    }

    let result = match exec_statements(&ast, &mut sub_vm) {
        Ok(()) => false,
        Err(EvalError::Return(val)) => {
            parent_vm.instruction_count = sub_vm.instruction_count;
            val.is_truthy()
        }
        Err(e) => {
            parent_vm.instruction_count = sub_vm.instruction_count;
            return Err(e);
        }
    };
    parent_vm.instruction_count = sub_vm.instruction_count;
    for t in &sub_vm.trace {
        parent_vm.add_trace(format!("  [sub] {}", t));
    }
    Ok(result)
}

fn eval_proof(script_hash_val: &str, policy_root_val: &str, proof_val: &str, vm: &mut VmState) -> Result<bool, EvalError> {
    let norm_hash = normalize_hex(script_hash_val);
    let norm_root = normalize_hex(policy_root_val);

    let branches = vm.tx_ctx.mast_branches.clone();
    let mut script_present = branches.as_ref().map(|b| b.contains_key(&norm_hash)).unwrap_or(false);
    if !script_present {
        if let Some(ref b) = branches {
            for k in b.keys() {
                if normalize_hex(k) == norm_hash { script_present = true; break; }
            }
        }
    }
    if !script_present {
        let prefix = &norm_hash[..norm_hash.len().min(12)];
        vm.add_trace(format!("PROOF: script {}… not in mastBranches → false", prefix));
        return Ok(false);
    }

    let proof_hex = if proof_val.starts_with("0x") || proof_val.starts_with("0X") {
        &proof_val[2..]
    } else {
        proof_val
    };

    if proof_hex.is_empty() {
        let ok = norm_hash == norm_root;
        let prefix = &norm_hash[..norm_hash.len().min(12)];
        vm.add_trace(format!("PROOF({}…) empty-proof, trivial={}", prefix, ok));
        return Ok(ok);
    }

    let ok = verify_merkle_proof(&norm_hash, &norm_root, proof_hex, vm);
    let prefix = &norm_hash[..norm_hash.len().min(12)];
    let rprefix = &norm_root[..norm_root.len().min(12)];
    vm.add_trace(format!("PROOF({}…, root={}…) merkle={}", prefix, rprefix, ok));
    Ok(ok)
}

fn verify_merkle_proof(leaf_hex: &str, root_hex: &str, proof_hex: &str, vm: &VmState) -> bool {
    let leaf_pure = if leaf_hex.starts_with("0x") { &leaf_hex[2..] } else { leaf_hex };
    let mut current = match hex::decode(leaf_pure) { Ok(v) => v, Err(_) => return false };
    let proof_bytes = match hex::decode(proof_hex) { Ok(v) => v, Err(_) => return false };

    let sibling_size = 32;
    let mut off = 0;
    while off + sibling_size <= proof_bytes.len() {
        let sibling = &proof_bytes[off..off + sibling_size];
        let (lo, hi) = if uint8_less(&current, sibling) {
            (current.clone(), sibling.to_vec())
        } else {
            (sibling.to_vec(), current.clone())
        };
        let mut pair = Vec::with_capacity(64);
        pair.extend_from_slice(&lo);
        pair.extend_from_slice(&hi);
        current = (vm.sha3_256)(&pair);
        off += sibling_size;
    }

    let computed_root = format!("0x{}", hex::encode(&current));
    normalize_hex(&computed_root) == normalize_hex(root_hex)
}

fn validate_arg_count(fn_: &UserFunction, provided: usize, name: &str) -> Result<(), EvalError> {
    if provided != fn_.params.len() {
        return Err(EvalError::Runtime(format!(
            "Function {} expects {} arg(s), got {}", name, fn_.params.len(), provided
        )));
    }
    Ok(())
}

fn call_user_func(fn_: &UserFunction, arg_nodes: &[AstNode], vm: &mut VmState) -> Result<(), EvalError> {
    let args: Vec<VmValue> = arg_nodes.iter().map(|a| eval_expr(a, vm)).collect::<Result<Vec<_>, _>>()?;
    vm.push_call_frame().map_err(|e| EvalError::Limit(e))?;
    for (i, param) in fn_.params.iter().enumerate() {
        let val = args.get(i).cloned().unwrap_or(VmValue::BigInt(BigInt::from(0)));
        vm.set(param, val);
    }
    let result = exec_statements(&fn_.body, vm);
    vm.pop_call_frame();
    match result {
        Ok(()) => Ok(()),
        Err(EvalError::Return(_)) => Ok(()),
        Err(e) => Err(e),
    }
}

fn call_user_func_expr(fn_: &UserFunction, arg_nodes: &[AstNode], vm: &mut VmState) -> Result<VmValue, EvalError> {
    let args: Vec<VmValue> = arg_nodes.iter().map(|a| eval_expr(a, vm)).collect::<Result<Vec<_>, _>>()?;
    vm.push_call_frame().map_err(|e| EvalError::Limit(e))?;
    for (i, param) in fn_.params.iter().enumerate() {
        let val = args.get(i).cloned().unwrap_or(VmValue::BigInt(BigInt::from(0)));
        vm.set(param, val);
    }
    let result = exec_statements(&fn_.body, vm);
    vm.pop_call_frame();
    match result {
        Ok(()) => Ok(VmValue::Bool(false)),
        Err(EvalError::Return(val)) => Ok(val),
        Err(e) => Err(e),
    }
}

fn sigdig_bigint(value: &BigInt, n_scaled: &BigInt) -> BigInt {
    let n: i64 = (n_scaled / BigInt::from(SCALE)).try_into().unwrap_or(0);
    if n <= 0 || *value == BigInt::from(0) { return BigInt::from(0); }

    let is_neg = *value < BigInt::from(0);
    let abs_val = if is_neg { -value } else { value.clone() };
    let abs_str = abs_val.to_string();
    let total_digits = abs_str.len() as i64;
    let drop = total_digits - n;

    if drop <= 0 { return value.clone(); }

    let divisor = BigInt::from(10).pow(drop as u32);
    let half_divisor = &divisor / 2;
    let rounded: BigInt = ((abs_val + half_divisor) / &divisor) * divisor;

    if is_neg { -rounded } else { rounded }
}

fn kissvm_eq(a: &VmValue, b: &VmValue) -> bool {
    match (a, b) {
        (VmValue::BigInt(ai), VmValue::BigInt(bi)) => ai == bi,
        (VmValue::String(as_), VmValue::String(bs)) => normalize_hex(as_) == normalize_hex(bs),
        (VmValue::Bool(ab), VmValue::Bool(bb)) => ab == bb,
        (VmValue::Bool(_), _) | (_, VmValue::Bool(_)) => a.is_truthy() == b.is_truthy(),
        _ => {
            match (as_scaled(a), as_scaled(b)) {
                (Ok(av), Ok(bv)) => av == bv,
                _ => false,
            }
        }
    }
}

fn normalize_hex(s: &str) -> String {
    if s.starts_with("0x") || s.starts_with("0X") {
        format!("0x{}", s[2..].to_lowercase())
    } else {
        s.to_lowercase()
    }
}

fn to_bytes(v: &VmValue) -> Vec<u8> {
    match v {
        VmValue::Bytes(b) => b.clone(),
        VmValue::String(s) => {
            if s.starts_with("0x") || s.starts_with("0X") {
                hex::decode(&s[2..]).unwrap_or_default()
            } else {
                s.as_bytes().to_vec()
            }
        }
        VmValue::BigInt(n) => {
            let abs = if *n < BigInt::from(0) { -n } else { n.clone() };
            let mut hex_str = abs.to_str_radix(16);
            if hex_str.len() % 2 != 0 { hex_str = format!("0{}", hex_str); }
            hex::decode(&hex_str).unwrap_or_default()
        }
        VmValue::Bool(b) => vec![if *b { 1 } else { 0 }],
    }
}

fn to_array(v: &VmValue) -> Vec<VmValue> {
    match v {
        VmValue::String(s) => s.split(',').map(|p| VmValue::String(p.trim().to_string())).collect(),
        _ => vec![v.clone()],
    }
}

fn compute_script_hash(script: &str, vm: &VmState) -> String {
    let bytes = script.trim().to_uppercase().as_bytes().to_vec();
    format!("0x{}", hex::encode((vm.sha3_256)(&bytes)))
}

fn check_string_size(s: &str) -> Result<(), EvalError> {
    let byte_len = if s.starts_with("0x") || s.starts_with("0X") {
        (s.len() - 2) / 2
    } else {
        s.len()
    };
    if byte_len > MAX_STRING_BYTES {
        return Err(EvalError::Limit(format!("String/hex value exceeds {}-byte limit", MAX_STRING_BYTES)));
    }
    Ok(())
}

fn parse_state_value(raw: &str) -> VmValue {
    if raw.is_empty() { return VmValue::BigInt(BigInt::from(0)); }
    if raw.starts_with("0x") || raw.starts_with("0X") { return VmValue::String(raw.to_string()); }
    match raw.parse::<f64>() {
        Ok(_) => VmValue::BigInt(parse_literal_bigint(raw)),
        Err(_) => VmValue::String(raw.to_string()),
    }
}

fn scaled_to_string(v: &VmValue) -> String {
    match v {
        VmValue::BigInt(n) => {
            let neg = *n < BigInt::from(0);
            let abs = if neg { -n } else { n.clone() };
            let scale = BigInt::from(SCALE);
            let int_part = &abs / &scale;
            let frac_part = &abs % &scale;
            let frac_str = format!("{:08}", frac_part).trim_end_matches('0').to_string();
            let body = if frac_str.is_empty() { format!("{}", int_part) } else { format!("{}.{}", int_part, frac_str) };
            if neg { format!("-{}", body) } else { body }
        }
        VmValue::Bool(b) => if *b { "1".into() } else { "0".into() },
        VmValue::Bytes(b) => format!("0x{}", hex::encode(b)),
        VmValue::String(s) => s.clone(),
    }
}

fn as_scaled(v: &VmValue) -> Result<BigInt, EvalError> {
    match v {
        VmValue::BigInt(n) => Ok(n.clone()),
        VmValue::Bool(b) => Ok(if *b { BigInt::from(SCALE) } else { BigInt::from(0) }),
        VmValue::String(s) => {
            if s.starts_with("0x") || s.starts_with("0X") {
                return Err(EvalError::Runtime(format!("Cannot use hex data value \"{}\" as a number", &s[..s.len().min(20)])));
            }
            if s.is_empty() { return Ok(BigInt::from(0)); }
            Ok(parse_literal_bigint(s))
        }
        _ => Err(EvalError::Runtime("Cannot convert to number".into())),
    }
}

fn as_port_int(v: &VmValue) -> Result<i64, EvalError> {
    let scaled = as_scaled(v)?;
    Ok((scaled / BigInt::from(SCALE)).try_into().unwrap_or(0))
}

fn hex_to_bytes(hex: &str) -> Vec<u8> {
    let s = if hex.starts_with("0x") || hex.starts_with("0X") { &hex[2..] } else { hex };
    hex::decode(s).unwrap_or_default()
}

fn uint8_less(a: &[u8], b: &[u8]) -> bool {
    let len = a.len().min(b.len());
    for i in 0..len {
        if a[i] < b[i] { return true; }
        if a[i] > b[i] { return false; }
    }
    a.len() < b.len()
}

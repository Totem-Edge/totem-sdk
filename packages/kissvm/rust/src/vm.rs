use std::collections::HashMap;
use crate::types::*;

pub const MAX_INSTRUCTIONS: u32 = 1024;
pub const MAX_STACK_DEPTH: u32 = 64;
pub const MAX_PARAMS: usize = 32;
pub const MAX_STRING_BYTES: usize = 65536;
pub const MAX_SHIFT_BITS: u32 = 256;

#[derive(Debug, Clone)]
pub struct UserFunction {
    pub params: Vec<String>,
    pub body: Vec<AstNode>,
    pub closure_env: HashMap<String, VmValue>,
}

#[derive(Debug, Clone)]
pub struct MastBranch {
    pub hash: String,
    pub body: Vec<AstNode>,
}

pub struct VmState {
    pub instruction_count: u32,
    env_stack: Vec<HashMap<String, VmValue>>,
    call_depth: u32,
    pub funcs: HashMap<String, UserFunction>,
    pub trace: Vec<String>,
    pub mast_block: Option<Vec<MastBranch>>,
    pub witness: ScriptWitness,
    pub tx_ctx: TxContext,
    pub sha3_256: fn(&[u8]) -> Vec<u8>,
    pub sha256: fn(&[u8]) -> Vec<u8>,
    pub wots_verify: fn(&[u8], &[u8], &[u8]) -> bool,
}

impl VmState {
    pub fn new(
        witness: ScriptWitness,
        tx_ctx: TxContext,
        sha3_256: fn(&[u8]) -> Vec<u8>,
        sha256: fn(&[u8]) -> Vec<u8>,
        wots_verify: fn(&[u8], &[u8], &[u8]) -> bool,
    ) -> Self {
        VmState {
            instruction_count: 0,
            env_stack: vec![HashMap::new()],
            call_depth: 0,
            funcs: HashMap::new(),
            trace: Vec::new(),
            mast_block: None,
            witness,
            tx_ctx,
            sha3_256,
            sha256,
            wots_verify,
        }
    }

    pub fn get(&self, name: &str) -> Option<VmValue> {
        for frame in self.env_stack.iter().rev() {
            if let Some(v) = frame.get(name) {
                return Some(v.clone());
            }
        }
        None
    }

    pub fn set(&mut self, name: &str, value: VmValue) {
        for frame in self.env_stack.iter_mut().rev() {
            if frame.contains_key(name) {
                frame.insert(name.to_string(), value);
                return;
            }
        }
        if let Some(last) = self.env_stack.last_mut() {
            last.insert(name.to_string(), value);
        }
    }

    pub fn push_call_frame(&mut self) -> Result<(), String> {
        self.call_depth += 1;
        if self.call_depth > MAX_STACK_DEPTH {
            return Err(format!("Call stack depth exceeded (max {})", MAX_STACK_DEPTH));
        }
        self.env_stack.push(HashMap::new());
        Ok(())
    }

    pub fn pop_call_frame(&mut self) {
        self.call_depth = self.call_depth.saturating_sub(1);
        if self.env_stack.len() > 1 {
            self.env_stack.pop();
        }
    }

    pub fn push_block_scope(&mut self) -> Result<(), String> {
        self.call_depth += 1;
        if self.call_depth > MAX_STACK_DEPTH {
            return Err(format!("Stack depth exceeded (max {})", MAX_STACK_DEPTH));
        }
        Ok(())
    }

    pub fn pop_block_scope(&mut self) {
        self.call_depth = self.call_depth.saturating_sub(1);
    }

    pub fn tick(&mut self, n: u32) -> Result<(), String> {
        self.instruction_count += n;
        if self.instruction_count > MAX_INSTRUCTIONS {
            return Err(format!("Instruction limit exceeded (max {})", MAX_INSTRUCTIONS));
        }
        Ok(())
    }

    pub fn add_trace(&mut self, msg: String) {
        self.trace.push(msg);
    }

    pub fn snapshot_env(&self) -> HashMap<String, VmValue> {
        let mut snap = HashMap::new();
        for frame in &self.env_stack {
            for (k, v) in frame {
                snap.insert(k.clone(), v.clone());
            }
        }
        snap
    }
}

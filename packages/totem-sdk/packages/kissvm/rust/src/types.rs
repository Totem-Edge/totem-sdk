use num_bigint::BigInt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const SCALE: u64 = 100_000_000;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Value {
    BigInt(i64), // We use i64 for JS interop; internally we convert to BigInt
    String(String),
    Bool(bool),
    Bytes(Vec<u8>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalResult {
    pub passed: bool,
    pub trace: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub instructions_used: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptWitness {
    pub signatures: HashMap<String, Vec<u8>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preimages: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinData {
    pub amount: f64,
    #[serde(rename = "tokenId")]
    pub token_id: String,
    #[serde(rename = "coinId")]
    pub coin_id: String,
    pub address: String,
    #[serde(rename = "coinCreatedBlock", skip_serializing_if = "Option::is_none")]
    pub coin_created_block: Option<f64>,
    #[serde(rename = "scriptHash", skip_serializing_if = "Option::is_none")]
    pub script_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputData {
    pub address: String,
    pub amount: f64,
    #[serde(rename = "tokenId")]
    pub token_id: String,
    #[serde(rename = "keepState")]
    pub keep_state: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxContext {
    pub block: f64,
    #[serde(rename = "inputIndex")]
    pub input_index: f64,
    pub inputs: Vec<CoinData>,
    pub outputs: Vec<OutputData>,
    pub state: HashMap<u32, String>,
    #[serde(rename = "prevState")]
    pub prev_state: HashMap<u32, String>,
    #[serde(rename = "txDigest", skip_serializing_if = "Option::is_none")]
    pub tx_digest: Option<Vec<u8>>,
    #[serde(rename = "mastBranches", skip_serializing_if = "Option::is_none")]
    pub mast_branches: Option<HashMap<String, String>>,
    #[serde(rename = "prevCoins", skip_serializing_if = "Option::is_none")]
    pub prev_coins: Option<Vec<CoinData>>,
    #[serde(rename = "simulationMode", skip_serializing_if = "Option::is_none")]
    pub simulation_mode: Option<bool>,
}

// ─── AST node types ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AstNode {
    #[serde(rename = "RETURN")]
    Return { expr: Box<AstNode>, span: Option<Span> },
    #[serde(rename = "ASSERT")]
    Assert { expr: Box<AstNode>, span: Option<Span> },
    #[serde(rename = "LET")]
    Let { name: String, value: Box<AstNode>, span: Option<Span> },
    #[serde(rename = "STORE_STATE")]
    StoreState { port: Box<AstNode>, value: Box<AstNode>, span: Option<Span> },
    #[serde(rename = "IF")]
    If { cond: Box<AstNode>, then: Vec<AstNode>, #[serde(rename = "else", skip_serializing_if = "Option::is_none")] else_block: Option<Vec<AstNode>>, span: Option<Span> },
    #[serde(rename = "FOR")]
    For { name: String, from: Box<AstNode>, to: Box<AstNode>, #[serde(skip_serializing_if = "Option::is_none")] by: Option<Box<AstNode>>, body: Vec<AstNode>, span: Option<Span> },
    #[serde(rename = "FOREACH")]
    Foreach { name: String, list: Box<AstNode>, body: Vec<AstNode>, span: Option<Span> },
    #[serde(rename = "SWITCH")]
    Switch { expr: Box<AstNode>, cases: Vec<SwitchCase>, #[serde(rename = "defaultBody", skip_serializing_if = "Option::is_none")] default_body: Option<Vec<AstNode>>, span: Option<Span> },
    #[serde(rename = "FUNC_DEF")]
    FuncDef { name: String, params: Vec<String>, body: Vec<AstNode>, span: Option<Span> },
    #[serde(rename = "CALL_STMT")]
    CallStmt { name: String, args: Vec<AstNode>, span: Option<Span> },
    #[serde(rename = "EXEC_MAST")]
    ExecMast { span: Option<Span> },
    #[serde(rename = "MAST_STMT")]
    MastStmt { #[serde(rename = "rootHash")] root_hash: String, span: Option<Span> },
    #[serde(rename = "MAST_BLOCK")]
    MastBlock { branches: Vec<MastBranchDef>, span: Option<Span> },
    #[serde(rename = "LITERAL")]
    Literal { value: SerdeValue, span: Option<Span> },
    #[serde(rename = "BUILTIN")]
    Builtin { name: String, span: Option<Span> },
    #[serde(rename = "IDENT")]
    Ident { name: String, span: Option<Span> },
    #[serde(rename = "BINARY")]
    Binary { op: String, left: Box<AstNode>, right: Box<AstNode>, span: Option<Span> },
    #[serde(rename = "UNARY")]
    Unary { op: String, expr: Box<AstNode>, span: Option<Span> },
    #[serde(rename = "CALL_EXPR")]
    CallExpr { name: String, args: Vec<AstNode>, span: Option<Span> },
    #[serde(rename = "STATE")]
    State { port: Box<AstNode>, span: Option<Span> },
    #[serde(rename = "PREVSTATE")]
    PrevState { port: Box<AstNode>, span: Option<Span> },
    #[serde(rename = "SAMESTATE")]
    SameState { from: Box<AstNode>, to: Box<AstNode>, span: Option<Span> },
    #[serde(rename = "SAMECOINS")]
    SameCoins { span: Option<Span> },
    #[serde(rename = "COINDATA")]
    CoinData_ { span: Option<Span> },
    #[serde(rename = "SIGNEDBY")]
    SignedBy { pubkey: Box<AstNode>, span: Option<Span> },
    #[serde(rename = "MULTISIG")]
    MultiSig { threshold: Box<AstNode>, keys: Vec<AstNode>, span: Option<Span> },
    #[serde(rename = "CHECKSIG")]
    CheckSig { span: Option<Span> },
    #[serde(rename = "HASH")]
    Hash { #[serde(rename = "fn")] fn_: String, expr: Box<AstNode>, span: Option<Span> },
    #[serde(rename = "VERIFYOUT")]
    VerifyOut { index: Box<AstNode>, address: Box<AstNode>, amount: Box<AstNode>, #[serde(rename = "tokenId")] token_id: Box<AstNode>, #[serde(rename = "keepState")] keep_state: Box<AstNode>, span: Option<Span> },
    #[serde(rename = "GETOUT")]
    GetOut { fn_: String, index: Box<AstNode>, span: Option<Span> },
    #[serde(rename = "SIGDIG")]
    SigDig { digits: Box<AstNode>, expr: Box<AstNode>, span: Option<Span> },
    #[serde(rename = "MAST_EXPR")]
    MastExpr { #[serde(rename = "rootHash")] root_hash: String, span: Option<Span> },
    #[serde(rename = "PROOF")]
    Proof { #[serde(rename = "scriptHash")] script_hash: Box<AstNode>, #[serde(rename = "policyRoot")] policy_root: Box<AstNode>, proof: Box<AstNode>, span: Option<Span> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwitchCase {
    pub value: AstNode,
    pub body: Vec<AstNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MastBranchDef {
    pub hash: String,
    pub body: Vec<AstNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SerdeValue {
    BigInt(i64),
    String(String),
    Bool(bool),
    Bytes(Vec<u8>),
    Number(f64),
}

impl SerdeValue {
    pub fn to_vm_value(&self) -> VmValue {
        match self {
            SerdeValue::BigInt(n) => VmValue::BigInt(BigInt::from(*n)),
            SerdeValue::String(s) => VmValue::String(s.clone()),
            SerdeValue::Bool(b) => VmValue::Bool(*b),
            SerdeValue::Bytes(b) => VmValue::Bytes(b.clone()),
            SerdeValue::Number(n) => {
                VmValue::BigInt(float_to_scaled(*n))
            }
        }
    }
}

pub fn float_to_scaled(n: f64) -> BigInt {
    let s = format!("{:.8}", n);
    parse_literal_bigint(&s)
}

pub fn parse_literal_bigint(s: &str) -> BigInt {
    let scale = BigInt::from(SCALE);
    let is_neg = s.starts_with('-');
    let abs = if is_neg { &s[1..] } else { s };
    let dot = abs.find('.');
    let (int_part, frac_full) = match dot {
        Some(pos) => {
            let ip = if pos == 0 { "0" } else { &abs[..pos] };
            let ff = &abs[pos + 1..];
            (ip, ff)
        }
        None => (abs, ""),
    };
    let frac_str = if frac_full.len() >= 8 {
        &frac_full[..8]
    } else {
        frac_full
    };
    let frac_padded = format!("{:0<8}", frac_str);
    let ninth = if frac_full.len() > 8 {
        frac_full.as_bytes()[8] as char
    } else {
        '0'
    };
    let int_big: BigInt = int_part.parse().unwrap_or(BigInt::from(0));
    let frac_big: BigInt = frac_padded.parse().unwrap_or(BigInt::from(0));
    let round = if ninth >= '5' { BigInt::from(1) } else { BigInt::from(0) };
    let result = int_big * &scale + frac_big + round;
    if is_neg { -result } else { result }
}

#[derive(Debug, Clone)]
pub enum VmValue {
    BigInt(BigInt),
    String(String),
    Bool(bool),
    Bytes(Vec<u8>),
}

impl VmValue {
    pub fn is_truthy(&self) -> bool {
        match self {
            VmValue::BigInt(n) => *n != BigInt::from(0),
            VmValue::String(s) => !s.is_empty() && s.to_lowercase() != "false",
            VmValue::Bool(b) => *b,
            VmValue::Bytes(b) => !b.is_empty(),
        }
    }

    pub fn to_string_val(&self) -> String {
        match self {
            VmValue::BigInt(n) => format!("{}", n),
            VmValue::String(s) => s.clone(),
            VmValue::Bool(b) => if *b { "true".to_string() } else { "false".to_string() },
            VmValue::Bytes(b) => format!("0x{}", hex::encode(b)),
        }
    }
}

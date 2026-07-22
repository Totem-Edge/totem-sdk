import type { MiniNumber } from './MiniNumber.js';

/**
 * KISSVM v1 public value type.
 *   MiniNumber — numeric values (matches Java MiniNumber / BigDecimal)
 *   string     — hex literals (0x…), text strings [...]
 *   boolean    — TRUE / FALSE
 *   Uint8Array — raw byte arrays (hash digests, raw data)
 *
 * NOTE: `number` (IEEE-754 float) is intentionally excluded from the public
 * type to prevent callers from relying on non-deterministic float arithmetic.
 */
export type Value = MiniNumber | string | boolean | Uint8Array;

/**
 * Internal evaluator type.
 * Extends Value with `number` solely to accommodate the parser's
 * `parseFloat(numStr)` output before the LITERAL evaluator converts
 * it to a MiniNumber.  Nothing outside LiteralNode.value should hold
 * a `number`.
 */
export type Scalar = number | MiniNumber | string | boolean | Uint8Array;

/** Source-range span — for error messages and tooling */
export interface Span { start: number; end: number }

/** EvalResult returned from evaluateScript / simulateSpend */
export interface EvalResult {
  passed: boolean;
  trace: string[];
  error?: string;
  instructionsUsed: number;
}

/** A canonical Minima ScriptProof: script + MMR proof + computed root address */
export interface ScriptProof {
  script: string;
  proofHex: string;
  address: string;
}

/** Witness supplied for signature and MAST verification */
export interface ScriptWitness {
  /** pubkey-hex (lowercase, no 0x) → flat 1088-byte WOTS signature */
  signatures: Map<string, Uint8Array>;
  /** HTLC: hash hex → preimage hex */
  preimages?: Map<string, string>;
  /**
   * Canonical ScriptProofs for MAST branch revelation.
   * The evaluator verifies each proof against the MAST root before executing.
   */
  scriptProofs?: ScriptProof[];
}

/** A single input coin */
export interface CoinData {
  amount: number;
  tokenId: string;
  coinId: string;
  address: string;
  /** Block when this coin was created (for @COINAGE = @BLOCK − coinCreatedBlock) */
  coinCreatedBlock?: number;
  /** Hash of the coin's locking script (for @SCRIPT) */
  scriptHash?: string;
}

/** A transaction output */
export interface OutputData {
  address: string;
  amount: number;
  tokenId: string;
  keepState: boolean;
}

/** Context supplied to the evaluator describing the spend transaction */
export interface TxContext {
  /** Current block height */
  block: number;
  /** Index of the input coin being evaluated */
  inputIndex: number;
  /** All input coins */
  inputs: CoinData[];
  /** All output coins */
  outputs: OutputData[];
  /** Current state (port → encoded string value) */
  state: Record<number, string>;
  /** Previous state from the spent coin */
  prevState: Record<number, string>;
  /** 32-byte transaction digest for signature verification */
  txDigest?: Uint8Array;
  /**
   * MAST branch resolution: maps hashHex (lowercase, 0x-prefixed) → scriptText.
   * The spender reveals the branch they are executing here.
   * Key = `'0x' + sha3_256(UPPER(trim(scriptText)))`
   */
  mastBranches?: Map<string, string>;
  /**
   * Previous input coins for SAMECOINS check.
   * If not provided SAMECOINS returns true (simulation default).
   */
  prevCoins?: CoinData[];
  /**
   * When true, SIGNEDBY/CHECKSIG accept signature *presence* without
   * verifying against a txDigest.  Use ONLY for unit-testing script logic.
   * Never set in production or in simulateSpend — those paths always compute
   * a real txDigest and run full WOTS verification.
   */
  simulationMode?: boolean;
}

// ─── AST node types ─────────────────────────────────────────────────────────

export type ASTNode =
  | ReturnNode | AssertNode | LetNode | StoreStateNode
  | IfNode | ForNode | ForeachNode | SwitchNode
  | FuncDefNode | CallStmtNode
  | ExecMastNode | MastStmtNode | MastBlockNode
  | LiteralNode | BuiltinVarNode | IdentNode
  | BinaryNode | UnaryNode | CallExprNode
  | StateNode | PrevStateNode | SamestateNode | SamecoinsNode | CoindataNode
  | SignedbyNode | MultisigNode | ChecksigNode
  | HashNode | VerifyoutNode | GetoutNode | SigdigNode
  | MastExprNode | ProofNode;

export interface ReturnNode     { type: 'RETURN';      expr: ASTNode; span?: Span }
export interface AssertNode     { type: 'ASSERT';      expr: ASTNode; span?: Span }
export interface LetNode        { type: 'LET';         name: string; value: ASTNode; span?: Span }
export interface StoreStateNode { type: 'STORE_STATE'; port: ASTNode; value: ASTNode; span?: Span }
export interface IfNode         { type: 'IF';          cond: ASTNode; then: ASTNode[]; else?: ASTNode[]; span?: Span }
export interface ForNode        { type: 'FOR';         name: string; from: ASTNode; to: ASTNode; by?: ASTNode; body: ASTNode[]; span?: Span }
export interface ForeachNode    { type: 'FOREACH';     name: string; list: ASTNode; body: ASTNode[]; span?: Span }
export interface SwitchNode     { type: 'SWITCH';      expr: ASTNode; cases: { value: ASTNode; body: ASTNode[] }[]; defaultBody?: ASTNode[]; span?: Span }
export interface FuncDefNode    { type: 'FUNC_DEF';    name: string; params: string[]; body: ASTNode[]; span?: Span }
export interface CallStmtNode   { type: 'CALL_STMT';   name: string; args: ASTNode[]; span?: Span }
export interface ExecMastNode   { type: 'EXEC_MAST';   span?: Span }
export interface MastStmtNode   { type: 'MAST_STMT';   rootHash: ASTNode; span?: Span }
/** Brace-form MAST: `MAST { HASH 0x… = PROOF { body } … }` */
export interface MastBlockNode  { type: 'MAST_BLOCK';  branches: { hash: string; body: ASTNode[] }[]; span?: Span }
/** LiteralNode.value may be `number` only for legacy programmatic Scalars; the parser emits `MiniNumber` for numeric literals (no IEEE-754 float involved) */
export interface LiteralNode    { type: 'LITERAL';     kind?: 'HEX'|'STR'|'NUM'|'BOOL'; value: Scalar; span?: Span }
export interface BuiltinVarNode { type: 'BUILTIN';     name: string; span?: Span }
export interface IdentNode      { type: 'IDENT';       name: string; span?: Span }
export interface BinaryNode     { type: 'BINARY';      op: string; left: ASTNode; right: ASTNode; span?: Span }
export interface UnaryNode      { type: 'UNARY';       op: string; expr: ASTNode; span?: Span }
export interface CallExprNode   { type: 'CALL_EXPR';   name: string; args: ASTNode[]; span?: Span }
export interface StateNode      { type: 'STATE';       port: ASTNode; span?: Span }
export interface PrevStateNode  { type: 'PREVSTATE';   port: ASTNode; span?: Span }
export interface SamestateNode  { type: 'SAMESTATE';   from: ASTNode; to: ASTNode; span?: Span }
export interface SamecoinsNode  { type: 'SAMECOINS';   span?: Span }
export interface CoindataNode   { type: 'COINDATA';    span?: Span }
export interface SignedbyNode   { type: 'SIGNEDBY';    pubkey: ASTNode; span?: Span }
export interface MultisigNode   { type: 'MULTISIG';    threshold: ASTNode; keys: ASTNode[]; span?: Span }
export interface ChecksigNode   { type: 'CHECKSIG';    span?: Span }
export interface HashNode       { type: 'HASH';        fn: 'SHA3' | 'SHA2' | 'HASH'; expr: ASTNode; span?: Span }
export interface VerifyoutNode  { type: 'VERIFYOUT';   index: ASTNode; address: ASTNode; amount: ASTNode; tokenId: ASTNode; keepState: ASTNode; span?: Span }
export interface GetoutNode     { type: 'GETOUT';      fn: 'AMT'|'ADDR'|'TOK'|'KEEPSTATE'; index: ASTNode; span?: Span }
export interface SigdigNode     { type: 'SIGDIG';      digits: ASTNode; expr: ASTNode; span?: Span }
export interface MastExprNode   { type: 'MAST_EXPR';   rootHash: ASTNode; span?: Span }
export interface ProofNode      { type: 'PROOF';       data: ASTNode; leafSum: ASTNode; rootHash: ASTNode; rootSum: ASTNode; proof: ASTNode; span?: Span }

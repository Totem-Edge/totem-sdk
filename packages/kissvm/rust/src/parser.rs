use crate::lexer::{Token, TokenKind, tokenize};
use crate::types::*;

pub fn parse_script(source: &str) -> Result<Vec<AstNode>, String> {
    let tokens = tokenize(source)?;
    let mut parser = Parser::new(tokens);
    parser.parse_program()
}

struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    fn new(tokens: Vec<Token>) -> Self {
        Parser { tokens, pos: 0 }
    }

    fn peek(&self) -> &Token { &self.tokens[self.pos] }
    fn prev(&self) -> &Token { &self.tokens[self.pos - 1] }

    fn at(&self, kind: TokenKind) -> bool { self.peek().kind == kind }
    fn at_any(&self, kinds: &[TokenKind]) -> bool { kinds.contains(&self.peek().kind) }

    fn eat(&mut self, kind: Option<TokenKind>) -> Result<Token, String> {
        let tok = self.peek().clone();
        if let Some(k) = kind {
            if tok.kind != k {
                return Err(format!("Expected {:?} but got {:?} ('{}') at pos {}", k, tok.kind, tok.value, tok.pos));
            }
        }
        self.pos += 1;
        Ok(tok)
    }

    fn try_eat(&mut self, kind: TokenKind) -> bool {
        if self.at(kind) { self.pos += 1; true } else { false }
    }

    fn span(&self, start: usize) -> Span {
        Span { start, end: self.prev().pos + 1 }
    }

    fn parse_program(&mut self) -> Result<Vec<AstNode>, String> {
        let mut stmts = Vec::new();
        while !self.at(TokenKind::Eof) {
            stmts.push(self.parse_statement()?);
        }
        Ok(stmts)
    }

    fn parse_block(&mut self, terminals: &[TokenKind]) -> Result<Vec<AstNode>, String> {
        let mut stmts = Vec::new();
        while !self.at(TokenKind::Eof) && !self.at_any(terminals) {
            stmts.push(self.parse_statement()?);
        }
        Ok(stmts)
    }

    fn parse_statement(&mut self) -> Result<AstNode, String> {
        let tok = self.peek().clone();
        let start_pos = tok.pos;

        match tok.kind {
            TokenKind::Return => {
                self.eat(None)?;
                if self.at(TokenKind::Exec) {
                    self.eat(None)?;
                    self.eat(Some(TokenKind::Mast))?;
                    return Ok(AstNode::ExecMast { span: Some(self.span(start_pos)) });
                }
                let expr = self.parse_expr()?;
                Ok(AstNode::Return { expr: Box::new(expr), span: Some(self.span(start_pos)) })
            }
            TokenKind::Assert => {
                self.eat(None)?;
                let expr = self.parse_expr()?;
                Ok(AstNode::Assert { expr: Box::new(expr), span: Some(self.span(start_pos)) })
            }
            TokenKind::Let => {
                self.eat(None)?;
                let name = self.eat(Some(TokenKind::Ident))?.value;
                self.eat(Some(TokenKind::Assign))?;
                let value = self.parse_expr()?;
                Ok(AstNode::Let { name, value: Box::new(value), span: Some(self.span(start_pos)) })
            }
            TokenKind::Store => {
                self.eat(None)?;
                self.eat(Some(TokenKind::State))?;
                self.eat(Some(TokenKind::LParen))?;
                let port = self.parse_expr()?;
                self.eat(Some(TokenKind::RParen))?;
                self.eat(Some(TokenKind::With))?;
                let value = self.parse_expr()?;
                Ok(AstNode::StoreState { port: Box::new(port), value: Box::new(value), span: Some(self.span(start_pos)) })
            }
            TokenKind::If => {
                self.eat(None)?;
                let cond = self.parse_expr()?;
                self.eat(Some(TokenKind::Then))?;
                let then_block = self.parse_block(&[TokenKind::Else, TokenKind::EndIf])?;
                let mut else_block = None;
                if self.try_eat(TokenKind::Else) {
                    else_block = Some(self.parse_block(&[TokenKind::EndIf])?);
                }
                self.eat(Some(TokenKind::EndIf))?;
                Ok(AstNode::If { cond: Box::new(cond), then: then_block, else_block, span: Some(self.span(start_pos)) })
            }
            TokenKind::For => {
                self.eat(None)?;
                let name = self.eat(Some(TokenKind::Ident))?.value;
                self.eat(Some(TokenKind::Assign))?;
                let from = self.parse_expr()?;
                self.eat(Some(TokenKind::To))?;
                let to = self.parse_expr()?;
                let mut by = None;
                if self.try_eat(TokenKind::By) {
                    by = Some(Box::new(self.parse_expr()?));
                }
                let body = self.parse_block(&[TokenKind::EndFor])?;
                self.eat(Some(TokenKind::EndFor))?;
                Ok(AstNode::For { name, from: Box::new(from), to: Box::new(to), by, body, span: Some(self.span(start_pos)) })
            }
            TokenKind::Foreach => {
                self.eat(None)?;
                let name = self.eat(Some(TokenKind::Ident))?.value;
                self.eat(Some(TokenKind::In))?;
                let list = self.parse_expr()?;
                let body = self.parse_block(&[TokenKind::EndFor])?;
                self.eat(Some(TokenKind::EndFor))?;
                Ok(AstNode::Foreach { name, list: Box::new(list), body, span: Some(self.span(start_pos)) })
            }
            TokenKind::Switch => {
                self.eat(None)?;
                let expr = self.parse_expr()?;
                let mut cases = Vec::new();
                let mut default_body = None;
                while !self.at_any(&[TokenKind::EndSwitch, TokenKind::Eof]) {
                    if self.try_eat(TokenKind::Case) {
                        let case_val = self.parse_primary()?;
                        let case_body = self.parse_block(&[TokenKind::Case, TokenKind::Default, TokenKind::EndSwitch])?;
                        cases.push(SwitchCase { value: case_val, body: case_body });
                    } else if self.try_eat(TokenKind::Default) {
                        default_body = Some(self.parse_block(&[TokenKind::EndSwitch])?);
                    } else {
                        break;
                    }
                }
                self.eat(Some(TokenKind::EndSwitch))?;
                Ok(AstNode::Switch { expr: Box::new(expr), cases, default_body, span: Some(self.span(start_pos)) })
            }
            TokenKind::Func => {
                self.eat(None)?;
                let name = self.eat(Some(TokenKind::Ident))?.value;
                self.eat(Some(TokenKind::LParen))?;
                let mut params = Vec::new();
                while !self.at(TokenKind::RParen) && !self.at(TokenKind::Eof) {
                    params.push(self.eat(Some(TokenKind::Ident))?.value);
                    self.try_eat(TokenKind::Comma);
                }
                self.eat(Some(TokenKind::RParen))?;
                let body = self.parse_block(&[TokenKind::EndFunc])?;
                self.eat(Some(TokenKind::EndFunc))?;
                Ok(AstNode::FuncDef { name, params, body, span: Some(self.span(start_pos)) })
            }
            TokenKind::Exec => {
                self.eat(None)?;
                self.eat(Some(TokenKind::Mast))?;
                Ok(AstNode::ExecMast { span: Some(self.span(start_pos)) })
            }
            TokenKind::Mast => {
                self.eat(None)?;
                if self.at(TokenKind::LBrace) {
                    self.eat(Some(TokenKind::LBrace))?;
                    let mut branches = Vec::new();
                    while !self.at_any(&[TokenKind::RBrace, TokenKind::Eof]) {
                        self.eat(Some(TokenKind::Hash))?;
                        let hash = self.eat(Some(TokenKind::Hex))?.value;
                        self.eat(Some(TokenKind::Assign))?;
                        self.eat(Some(TokenKind::Proof))?;
                        self.eat(Some(TokenKind::LBrace))?;
                        let branch_body = self.parse_block(&[TokenKind::RBrace])?;
                        self.eat(Some(TokenKind::RBrace))?;
                        branches.push(MastBranchDef { hash, body: branch_body });
                    }
                    self.eat(Some(TokenKind::RBrace))?;
                    Ok(AstNode::MastBlock { branches, span: Some(self.span(start_pos)) })
                } else {
                    let root_hash = self.eat(Some(TokenKind::Hex))?.value;
                    Ok(AstNode::MastStmt { root_hash, span: Some(self.span(start_pos)) })
                }
            }
            TokenKind::Ident => {
                let name = self.eat(None)?.value;
                if self.at(TokenKind::LParen) {
                    self.eat(Some(TokenKind::LParen))?;
                    let args = self.parse_space_arg_list(TokenKind::RParen)?;
                    self.eat(Some(TokenKind::RParen))?;
                    return Ok(AstNode::CallStmt { name, args, span: Some(self.span(start_pos)) });
                }
                Err(format!("Unexpected identifier '{}' as statement at pos {}", name, tok.pos))
            }
            _ => Err(format!("Unexpected token {:?} ('{}') at pos {}", tok.kind, tok.value, tok.pos))
        }
    }

    // ─── Expression parsing ──────────────────────────────────────────────────

    fn parse_expr(&mut self) -> Result<AstNode, String> { self.parse_or() }

    fn parse_or(&mut self) -> Result<AstNode, String> {
        let mut left = self.parse_and()?;
        while self.at(TokenKind::Or) {
            self.eat(None)?;
            let right = self.parse_and()?;
            left = AstNode::Binary { op: "OR".into(), left: Box::new(left), right: Box::new(right), span: None };
        }
        Ok(left)
    }

    fn parse_and(&mut self) -> Result<AstNode, String> {
        let mut left = self.parse_xor()?;
        while self.at(TokenKind::And) {
            self.eat(None)?;
            let right = self.parse_xor()?;
            left = AstNode::Binary { op: "AND".into(), left: Box::new(left), right: Box::new(right), span: None };
        }
        Ok(left)
    }

    fn parse_xor(&mut self) -> Result<AstNode, String> {
        let mut left = self.parse_not()?;
        while self.at(TokenKind::Xor) {
            self.eat(None)?;
            let right = self.parse_not()?;
            left = AstNode::Binary { op: "XOR".into(), left: Box::new(left), right: Box::new(right), span: None };
        }
        Ok(left)
    }

    fn parse_not(&mut self) -> Result<AstNode, String> {
        if self.at(TokenKind::Not) {
            self.eat(None)?;
            let expr = self.parse_not()?;
            return Ok(AstNode::Unary { op: "NOT".into(), expr: Box::new(expr), span: None });
        }
        self.parse_comparison()
    }

    fn token_kind_to_op(kind: &TokenKind) -> &'static str {
        match kind {
            TokenKind::Eq => "EQ",
            TokenKind::Neq => "NEQ",
            TokenKind::Gt => "GT",
            TokenKind::Gte => "GTE",
            TokenKind::Lt => "LT",
            TokenKind::Lte => "LTE",
            TokenKind::Add => "ADD",
            TokenKind::Sub => "SUB",
            TokenKind::Mul => "MUL",
            TokenKind::Div => "DIV",
            TokenKind::Mod => "MOD",
            TokenKind::LShift => "LSHIFT",
            TokenKind::RShift => "RSHIFT",
            _ => "UNKNOWN",
        }
    }

    fn parse_comparison(&mut self) -> Result<AstNode, String> {
        let mut left = self.parse_shift()?;
        while self.at_any(&[TokenKind::Eq, TokenKind::Neq, TokenKind::Gt, TokenKind::Gte, TokenKind::Lt, TokenKind::Lte]) {
            let op = Self::token_kind_to_op(&self.eat(None)?.kind).to_string();
            let right = self.parse_shift()?;
            left = AstNode::Binary { op, left: Box::new(left), right: Box::new(right), span: None };
        }
        Ok(left)
    }

    fn parse_shift(&mut self) -> Result<AstNode, String> {
        let mut left = self.parse_add_sub()?;
        while self.at_any(&[TokenKind::LShift, TokenKind::RShift]) {
            let op = Self::token_kind_to_op(&self.eat(None)?.kind).to_string();
            let right = self.parse_add_sub()?;
            left = AstNode::Binary { op, left: Box::new(left), right: Box::new(right), span: None };
        }
        Ok(left)
    }

    fn parse_add_sub(&mut self) -> Result<AstNode, String> {
        let mut left = self.parse_mul_div()?;
        while self.at_any(&[TokenKind::Add, TokenKind::Sub]) {
            let op = Self::token_kind_to_op(&self.eat(None)?.kind).to_string();
            let right = self.parse_mul_div()?;
            left = AstNode::Binary { op, left: Box::new(left), right: Box::new(right), span: None };
        }
        Ok(left)
    }

    fn parse_mul_div(&mut self) -> Result<AstNode, String> {
        let mut left = self.parse_unary()?;
        while self.at_any(&[TokenKind::Mul, TokenKind::Div, TokenKind::Mod]) {
            let op = Self::token_kind_to_op(&self.eat(None)?.kind).to_string();
            let right = self.parse_unary()?;
            left = AstNode::Binary { op, left: Box::new(left), right: Box::new(right), span: None };
        }
        Ok(left)
    }

    fn parse_unary(&mut self) -> Result<AstNode, String> {
        if self.at(TokenKind::Sub) {
            self.eat(None)?;
            let expr = self.parse_primary()?;
            return Ok(AstNode::Unary { op: "NEG".into(), expr: Box::new(expr), span: None });
        }
        self.parse_primary()
    }

    fn parse_primary(&mut self) -> Result<AstNode, String> {
        let tok = self.peek().clone();
        let start_pos = tok.pos;

        match tok.kind {
            TokenKind::Number => {
                self.eat(None)?;
                let val = parse_literal_bigint(&tok.value);
                Ok(AstNode::Literal { value: SerdeValue::BigInt(val.try_into().unwrap_or(0)), span: Some(self.span(start_pos)) })
            }
            TokenKind::Hex => {
                self.eat(None)?;
                Ok(AstNode::Literal { value: SerdeValue::String(tok.value), span: Some(self.span(start_pos)) })
            }
            TokenKind::String => {
                self.eat(None)?;
                Ok(AstNode::Literal { value: SerdeValue::String(tok.value), span: Some(self.span(start_pos)) })
            }
            TokenKind::True => {
                self.eat(None)?;
                Ok(AstNode::Literal { value: SerdeValue::Bool(true), span: Some(self.span(start_pos)) })
            }
            TokenKind::False => {
                self.eat(None)?;
                Ok(AstNode::Literal { value: SerdeValue::Bool(false), span: Some(self.span(start_pos)) })
            }
            TokenKind::AtVar => {
                self.eat(None)?;
                Ok(AstNode::Builtin { name: tok.value, span: Some(self.span(start_pos)) })
            }
            TokenKind::LParen => {
                self.eat(None)?;
                let inner = self.parse_expr()?;
                self.eat(Some(TokenKind::RParen))?;
                Ok(inner)
            }
            TokenKind::Exec => {
                self.eat(None)?;
                self.eat(Some(TokenKind::Mast))?;
                Ok(AstNode::ExecMast { span: Some(self.span(start_pos)) })
            }
            TokenKind::State => {
                self.eat(None)?;
                self.eat(Some(TokenKind::LParen))?;
                let port = self.parse_expr()?;
                self.eat(Some(TokenKind::RParen))?;
                Ok(AstNode::State { port: Box::new(port), span: Some(self.span(start_pos)) })
            }
            TokenKind::PrevState => {
                self.eat(None)?;
                self.eat(Some(TokenKind::LParen))?;
                let port = self.parse_expr()?;
                self.eat(Some(TokenKind::RParen))?;
                Ok(AstNode::PrevState { port: Box::new(port), span: Some(self.span(start_pos)) })
            }
            TokenKind::SameState => {
                self.eat(None)?;
                self.eat(Some(TokenKind::LParen))?;
                let from = self.parse_expr()?;
                let to = self.parse_expr()?;
                self.eat(Some(TokenKind::RParen))?;
                Ok(AstNode::SameState { from: Box::new(from), to: Box::new(to), span: Some(self.span(start_pos)) })
            }
            TokenKind::SameCoins => {
                self.eat(None)?;
                Ok(AstNode::SameCoins { span: Some(self.span(start_pos)) })
            }
            TokenKind::CoinData => {
                self.eat(None)?;
                Ok(AstNode::CoinData_ { span: Some(self.span(start_pos)) })
            }
            TokenKind::SignedBy => {
                self.eat(None)?;
                self.eat(Some(TokenKind::LParen))?;
                let pubkey = self.parse_expr()?;
                self.eat(Some(TokenKind::RParen))?;
                Ok(AstNode::SignedBy { pubkey: Box::new(pubkey), span: Some(self.span(start_pos)) })
            }
            TokenKind::MultiSig => {
                self.eat(None)?;
                self.eat(Some(TokenKind::LParen))?;
                let threshold = self.parse_expr()?;
                let mut keys = Vec::new();
                while !self.at_any(&[TokenKind::RParen, TokenKind::Eof]) {
                    self.try_eat(TokenKind::Comma);
                    if self.at(TokenKind::RParen) { break; }
                    keys.push(self.parse_expr()?);
                }
                self.eat(Some(TokenKind::RParen))?;
                Ok(AstNode::MultiSig { threshold: Box::new(threshold), keys, span: Some(self.span(start_pos)) })
            }
            TokenKind::CheckSig => {
                self.eat(None)?;
                Ok(AstNode::CheckSig { span: Some(self.span(start_pos)) })
            }
            TokenKind::Sha3 | TokenKind::Sha2 | TokenKind::Hash => {
                let fn_ = format!("{:?}", tok.kind);
                self.eat(None)?;
                self.eat(Some(TokenKind::LParen))?;
                let expr = self.parse_expr()?;
                self.eat(Some(TokenKind::RParen))?;
                Ok(AstNode::Hash { fn_, expr: Box::new(expr), span: Some(self.span(start_pos)) })
            }
            TokenKind::VerifyOut => {
                self.eat(None)?;
                self.eat(Some(TokenKind::LParen))?;
                let index = self.parse_expr()?; self.try_eat(TokenKind::Comma);
                let address = self.parse_expr()?; self.try_eat(TokenKind::Comma);
                let amount = self.parse_expr()?; self.try_eat(TokenKind::Comma);
                let token_id = self.parse_expr()?; self.try_eat(TokenKind::Comma);
                let keep_state = self.parse_expr()?;
                self.eat(Some(TokenKind::RParen))?;
                Ok(AstNode::VerifyOut { index: Box::new(index), address: Box::new(address), amount: Box::new(amount), token_id: Box::new(token_id), keep_state: Box::new(keep_state), span: Some(self.span(start_pos)) })
            }
            TokenKind::GetOutAmt => {
                self.eat(None)?; self.eat(Some(TokenKind::LParen))?;
                let index = self.parse_expr()?; self.eat(Some(TokenKind::RParen))?;
                Ok(AstNode::GetOut { fn_: "AMT".into(), index: Box::new(index), span: Some(self.span(start_pos)) })
            }
            TokenKind::GetOutAddr => {
                self.eat(None)?; self.eat(Some(TokenKind::LParen))?;
                let index = self.parse_expr()?; self.eat(Some(TokenKind::RParen))?;
                Ok(AstNode::GetOut { fn_: "ADDR".into(), index: Box::new(index), span: Some(self.span(start_pos)) })
            }
            TokenKind::GetOutTok => {
                self.eat(None)?; self.eat(Some(TokenKind::LParen))?;
                let index = self.parse_expr()?; self.eat(Some(TokenKind::RParen))?;
                Ok(AstNode::GetOut { fn_: "TOK".into(), index: Box::new(index), span: Some(self.span(start_pos)) })
            }
            TokenKind::GetOutKeepState => {
                self.eat(None)?; self.eat(Some(TokenKind::LParen))?;
                let index = self.parse_expr()?; self.eat(Some(TokenKind::RParen))?;
                Ok(AstNode::GetOut { fn_: "KEEPSTATE".into(), index: Box::new(index), span: Some(self.span(start_pos)) })
            }
            TokenKind::SigDig => {
                self.eat(None)?; self.eat(Some(TokenKind::LParen))?;
                let digits = self.parse_expr()?; self.try_eat(TokenKind::Comma);
                let expr = self.parse_expr()?;
                self.eat(Some(TokenKind::RParen))?;
                Ok(AstNode::SigDig { digits: Box::new(digits), expr: Box::new(expr), span: Some(self.span(start_pos)) })
            }
            TokenKind::Proof => {
                self.eat(None)?; self.eat(Some(TokenKind::LParen))?;
                let script_hash = self.parse_expr()?; self.try_eat(TokenKind::Comma);
                let policy_root = self.parse_expr()?; self.try_eat(TokenKind::Comma);
                let proof = self.parse_expr()?;
                self.eat(Some(TokenKind::RParen))?;
                Ok(AstNode::Proof { script_hash: Box::new(script_hash), policy_root: Box::new(policy_root), proof: Box::new(proof), span: Some(self.span(start_pos)) })
            }
            TokenKind::Mast => {
                self.eat(None)?;
                let root_hash = self.eat(Some(TokenKind::Hex))?.value;
                Ok(AstNode::MastExpr { root_hash, span: Some(self.span(start_pos)) })
            }
            TokenKind::Ident => {
                let name = self.eat(None)?.value;
                if self.at(TokenKind::LParen) {
                    self.eat(Some(TokenKind::LParen))?;
                    let args = self.parse_space_arg_list(TokenKind::RParen)?;
                    self.eat(Some(TokenKind::RParen))?;
                    return Ok(AstNode::CallExpr { name, args, span: Some(self.span(start_pos)) });
                }
                Ok(AstNode::Ident { name, span: Some(self.span(start_pos)) })
            }
            _ => Err(format!("Unexpected token {:?} ('{}') at pos {}", tok.kind, tok.value, tok.pos))
        }
    }

    fn parse_space_arg_list(&mut self, terminal: TokenKind) -> Result<Vec<AstNode>, String> {
        let mut args = Vec::new();
        while !self.at(terminal) && !self.at(TokenKind::Eof) {
            args.push(self.parse_expr()?);
            self.try_eat(TokenKind::Comma);
        }
        Ok(args)
    }
}

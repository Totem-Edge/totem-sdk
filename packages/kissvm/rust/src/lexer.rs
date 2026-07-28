#[derive(Debug, Clone, PartialEq, Eq, Copy)]
pub enum TokenKind {
    Number,
    Hex,
    String,
    Ident,
    True,
    False,
    Return,
    Assert,
    Let,
    If,
    Then,
    Else,
    EndIf,
    For,
    To,
    By,
    EndFor,
    Foreach,
    In,
    Switch,
    Case,
    Default,
    EndSwitch,
    Store,
    With,
    Func,
    EndFunc,
    Exec,
    Mast,
    Proof,
    And,
    Or,
    Xor,
    Not,
    Eq,
    Neq,
    Gt,
    Gte,
    Lt,
    Lte,
    Add,
    Sub,
    Mul,
    Div,
    Mod,
    LShift,
    RShift,
    LParen,
    RParen,
    LBrace,
    RBrace,
    Comma,
    Assign,
    SignedBy,
    MultiSig,
    CheckSig,
    Sha3,
    Sha2,
    Hash,
    State,
    PrevState,
    SameState,
    SameCoins,
    CoinData,
    VerifyOut,
    GetOutAmt,
    GetOutAddr,
    GetOutTok,
    GetOutKeepState,
    SigDig,
    AtVar,
    Eof,
}

#[derive(Debug, Clone)]
pub struct Token {
    pub kind: TokenKind,
    pub value: String,
    pub pos: usize,
}

pub fn tokenize(source: &str) -> Result<Vec<Token>, String> {
    let mut tokens: Vec<Token> = Vec::new();
    let chars: Vec<char> = source.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let start = i;
        let ch = chars[i];

        if ch.is_whitespace() {
            i += 1;
            continue;
        }

        if ch == '/' && i + 1 < chars.len() && chars[i + 1] == '/' {
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
            continue;
        }

        match ch {
            '(' => { tokens.push(Token { kind: TokenKind::LParen, value: "(".into(), pos: start }); i += 1; }
            ')' => { tokens.push(Token { kind: TokenKind::RParen, value: ")".into(), pos: start }); i += 1; }
            '{' => { tokens.push(Token { kind: TokenKind::LBrace, value: "{".into(), pos: start }); i += 1; }
            '}' => { tokens.push(Token { kind: TokenKind::RBrace, value: "}".into(), pos: start }); i += 1; }
            ',' => { tokens.push(Token { kind: TokenKind::Comma, value: ",".into(), pos: start }); i += 1; }
            '+' => { tokens.push(Token { kind: TokenKind::Add, value: "+".into(), pos: start }); i += 1; }
            '-' => { tokens.push(Token { kind: TokenKind::Sub, value: "-".into(), pos: start }); i += 1; }
            '*' => { tokens.push(Token { kind: TokenKind::Mul, value: "*".into(), pos: start }); i += 1; }
            '%' => { tokens.push(Token { kind: TokenKind::Mod, value: "%".into(), pos: start }); i += 1; }
            '=' => {
                if i + 1 < chars.len() && chars[i + 1] == '=' {
                    tokens.push(Token { kind: TokenKind::Eq, value: "==".into(), pos: start });
                    i += 2;
                } else {
                    tokens.push(Token { kind: TokenKind::Assign, value: "=".into(), pos: start });
                    i += 1;
                }
            }
            '!' => {
                if i + 1 < chars.len() && chars[i + 1] == '=' {
                    tokens.push(Token { kind: TokenKind::Neq, value: "!=".into(), pos: start });
                    i += 2;
                } else {
                    tokens.push(Token { kind: TokenKind::Not, value: "!".into(), pos: start });
                    i += 1;
                }
            }
            '>' => {
                if i + 1 < chars.len() && chars[i + 1] == '>' {
                    tokens.push(Token { kind: TokenKind::RShift, value: ">>".into(), pos: start });
                    i += 2;
                } else if i + 1 < chars.len() && chars[i + 1] == '=' {
                    tokens.push(Token { kind: TokenKind::Gte, value: ">=".into(), pos: start });
                    i += 2;
                } else {
                    tokens.push(Token { kind: TokenKind::Gt, value: ">".into(), pos: start });
                    i += 1;
                }
            }
            '<' => {
                if i + 1 < chars.len() && chars[i + 1] == '<' {
                    tokens.push(Token { kind: TokenKind::LShift, value: "<<".into(), pos: start });
                    i += 2;
                } else if i + 1 < chars.len() && chars[i + 1] == '=' {
                    tokens.push(Token { kind: TokenKind::Lte, value: "<=".into(), pos: start });
                    i += 2;
                } else {
                    tokens.push(Token { kind: TokenKind::Lt, value: "<".into(), pos: start });
                    i += 1;
                }
            }
            '/' => { tokens.push(Token { kind: TokenKind::Div, value: "/".into(), pos: start }); i += 1; }
            '[' => {
                i += 1;
                let mut s = String::new();
                while i < chars.len() && chars[i] != ']' {
                    s.push(chars[i]);
                    i += 1;
                }
                if i < chars.len() && chars[i] == ']' {
                    i += 1;
                }
                if s.len() > 65536 {
                    return Err(format!("String literal at pos {} exceeds 64 KB limit", start));
                }
                tokens.push(Token { kind: TokenKind::String, value: s, pos: start });
            }
            '0' if i + 1 < chars.len() && (chars[i + 1] == 'x' || chars[i + 1] == 'X') => {
                i += 2;
                let mut hex_str = String::from("0x");
                while i < chars.len() && chars[i].is_ascii_hexdigit() {
                    hex_str.push(chars[i].to_ascii_lowercase());
                    i += 1;
                }
                if (hex_str.len() - 2) / 2 > 65536 {
                    return Err(format!("Hex literal at pos {} exceeds 64 KB limit", start));
                }
                tokens.push(Token { kind: TokenKind::Hex, value: hex_str, pos: start });
            }
            '0'..='9' => {
                let mut num = String::new();
                while i < chars.len() && chars[i].is_ascii_digit() {
                    num.push(chars[i]);
                    i += 1;
                }
                if i < chars.len() && chars[i] == '.' && i + 1 < chars.len() && chars[i + 1].is_ascii_digit() {
                    num.push(chars[i]);
                    i += 1;
                    while i < chars.len() && chars[i].is_ascii_digit() {
                        num.push(chars[i]);
                        i += 1;
                    }
                }
                tokens.push(Token { kind: TokenKind::Number, value: num, pos: start });
            }
            '@' => {
                i += 1;
                let mut name = String::new();
                while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                    name.push(chars[i].to_ascii_uppercase());
                    i += 1;
                }
                tokens.push(Token { kind: TokenKind::AtVar, value: name, pos: start });
            }
            ch if ch.is_alphabetic() || ch == '_' => {
                let mut word = String::new();
                while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                    word.push(chars[i]);
                    i += 1;
                }
                let upper = word.to_uppercase();
                let kind = match upper.as_str() {
                    "TRUE" => TokenKind::True,
                    "FALSE" => TokenKind::False,
                    "RETURN" => TokenKind::Return,
                    "ASSERT" => TokenKind::Assert,
                    "LET" => TokenKind::Let,
                    "IF" => TokenKind::If,
                    "THEN" => TokenKind::Then,
                    "ELSE" => TokenKind::Else,
                    "ENDIF" => TokenKind::EndIf,
                    "FOR" => TokenKind::For,
                    "TO" => TokenKind::To,
                    "BY" => TokenKind::By,
                    "ENDFOR" => TokenKind::EndFor,
                    "FOREACH" => TokenKind::Foreach,
                    "IN" => TokenKind::In,
                    "SWITCH" => TokenKind::Switch,
                    "CASE" => TokenKind::Case,
                    "DEFAULT" => TokenKind::Default,
                    "ENDSWITCH" => TokenKind::EndSwitch,
                    "STORE" => TokenKind::Store,
                    "WITH" => TokenKind::With,
                    "FUNC" => TokenKind::Func,
                    "ENDFUNC" => TokenKind::EndFunc,
                    "EXEC" => TokenKind::Exec,
                    "MAST" => TokenKind::Mast,
                    "PROOF" => TokenKind::Proof,
                    "AND" => TokenKind::And,
                    "OR" => TokenKind::Or,
                    "XOR" => TokenKind::Xor,
                    "NOT" => TokenKind::Not,
                    "EQ" => TokenKind::Eq,
                    "NEQ" => TokenKind::Neq,
                    "GT" => TokenKind::Gt,
                    "GTE" => TokenKind::Gte,
                    "LT" => TokenKind::Lt,
                    "LTE" => TokenKind::Lte,
                    "ADD" => TokenKind::Add,
                    "SUB" => TokenKind::Sub,
                    "MUL" => TokenKind::Mul,
                    "DIV" => TokenKind::Div,
                    "MOD" => TokenKind::Mod,
                    "LSHIFT" => TokenKind::LShift,
                    "RSHIFT" => TokenKind::RShift,
                    "SIGNEDBY" => TokenKind::SignedBy,
                    "MULTISIG" => TokenKind::MultiSig,
                    "CHECKSIG" => TokenKind::CheckSig,
                    "SHA3" => TokenKind::Sha3,
                    "SHA2" => TokenKind::Sha2,
                    "HASH" => TokenKind::Hash,
                    "STATE" => TokenKind::State,
                    "PREVSTATE" => TokenKind::PrevState,
                    "SAMESTATE" => TokenKind::SameState,
                    "SAMECOINS" => TokenKind::SameCoins,
                    "COINDATA" => TokenKind::CoinData,
                    "VERIFYOUT" => TokenKind::VerifyOut,
                    "GETOUTAMT" => TokenKind::GetOutAmt,
                    "GETOUTADDR" => TokenKind::GetOutAddr,
                    "GETOUTTOK" => TokenKind::GetOutTok,
                    "GETOUTKEEPSTATE" => TokenKind::GetOutKeepState,
                    "SIGDIG" => TokenKind::SigDig,
                    _ => TokenKind::Ident,
                };
                tokens.push(Token { kind, value: word, pos: start });
            }
            _ => {
                return Err(format!("Unexpected character '{}' at position {}", ch, start));
            }
        }
    }

    tokens.push(Token { kind: TokenKind::Eof, value: String::new(), pos: i });
    Ok(tokens)
}

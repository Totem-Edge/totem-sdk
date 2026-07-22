import { tokenize, Token, TokenKind } from './lexer.js';
import { MiniNumber } from './MiniNumber.js';
import type { ASTNode, Scalar, Span } from './types.js';

function parseNumLiteral(s: string): MiniNumber {
  return new MiniNumber(s);
}

export function parseScript(source: string): ASTNode[] {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  return parser.parseProgram();
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token { return this.tokens[this.pos]; }
  private prev(): Token { return this.tokens[this.pos - 1]; }

  private at(kind: TokenKind): boolean { return this.peek().kind === kind; }
  private atAny(...kinds: TokenKind[]): boolean { return kinds.includes(this.peek().kind); }

  private eat(kind?: TokenKind): Token {
    const tok = this.peek();
    if (kind && tok.kind !== kind) {
      throw new Error(`Expected ${kind} but got ${tok.kind} ('${tok.value}') at pos ${tok.pos}`);
    }
    this.pos++;
    return tok;
  }

  private tryEat(kind: TokenKind): boolean {
    if (this.at(kind)) { this.pos++; return true; }
    return false;
  }

  private span(start: number): Span {
    return { start, end: this.prev().pos + 1 };
  }

  parseProgram(): ASTNode[] {
    const stmts: ASTNode[] = [];
    while (!this.at('EOF')) {
      stmts.push(this.parseStatement());
    }
    return stmts;
  }

  private parseBlock(terminals: TokenKind[]): ASTNode[] {
    const stmts: ASTNode[] = [];
    while (!this.at('EOF') && !this.atAny(...terminals)) {
      stmts.push(this.parseStatement());
    }
    return stmts;
  }

  private parseStatement(): ASTNode {
    const tok = this.peek();
    const startPos = tok.pos;

    switch (tok.kind) {
      case 'RETURN': {
        this.eat();
        // Handle RETURN EXEC MAST as a single statement
        if (this.at('EXEC')) {
          this.eat(); this.eat('MAST');
          return { type: 'EXEC_MAST', span: this.span(startPos) };
        }
        const expr = this.parseExpr();
        return { type: 'RETURN', expr, span: this.span(startPos) };
      }
      case 'ASSERT': {
        this.eat();
        const expr = this.parseExpr();
        return { type: 'ASSERT', expr, span: this.span(startPos) };
      }
      case 'LET': {
        this.eat();
        const name = this.eat('IDENT').value;
        this.eat('ASSIGN');
        const value = this.parseExpr();
        return { type: 'LET', name, value, span: this.span(startPos) };
      }
      case 'STORE': {
        this.eat();
        this.eat('STATE');
        this.eat('LPAREN');
        const port = this.parseExpr();
        this.eat('RPAREN');
        this.eat('WITH');
        const value = this.parseExpr();
        return { type: 'STORE_STATE', port, value, span: this.span(startPos) };
      }
      case 'IF': {
        this.eat();
        const cond = this.parseExpr();
        this.eat('THEN');
        const thenBlock = this.parseBlock(['ELSE', 'ENDIF']);
        let elseBlock: ASTNode[] | undefined;
        if (this.tryEat('ELSE')) {
          elseBlock = this.parseBlock(['ENDIF']);
        }
        this.eat('ENDIF');
        return { type: 'IF', cond, then: thenBlock, else: elseBlock, span: this.span(startPos) };
      }
      case 'FOR': {
        this.eat();
        const name = this.eat('IDENT').value;
        this.eat('ASSIGN');
        const from = this.parseExpr();
        this.eat('TO');
        const to = this.parseExpr();
        let by: ASTNode | undefined;
        if (this.tryEat('BY')) {
          by = this.parseExpr();
        }
        const body = this.parseBlock(['ENDFOR']);
        this.eat('ENDFOR');
        return { type: 'FOR', name, from, to, by, body, span: this.span(startPos) };
      }
      case 'FOREACH': {
        this.eat();
        const name = this.eat('IDENT').value;
        this.eat('IN');
        const list = this.parseExpr();
        const body = this.parseBlock(['ENDFOR']);
        this.eat('ENDFOR');
        return { type: 'FOREACH', name, list, body, span: this.span(startPos) };
      }
      case 'SWITCH': {
        this.eat();
        const expr = this.parseExpr();
        const cases: { value: ASTNode; body: ASTNode[] }[] = [];
        let defaultBody: ASTNode[] | undefined;
        while (!this.atAny('ENDSWITCH', 'EOF')) {
          if (this.tryEat('CASE')) {
            const caseVal = this.parsePrimary();
            const caseBody = this.parseBlock(['CASE', 'DEFAULT', 'ENDSWITCH']);
            cases.push({ value: caseVal, body: caseBody });
          } else if (this.tryEat('DEFAULT')) {
            defaultBody = this.parseBlock(['ENDSWITCH']);
          } else {
            break;
          }
        }
        this.eat('ENDSWITCH');
        return { type: 'SWITCH', expr, cases, defaultBody, span: this.span(startPos) };
      }
      case 'FUNC': {
        this.eat();
        const name = this.eat('IDENT').value;
        this.eat('LPAREN');
        const params: string[] = [];
        while (!this.at('RPAREN') && !this.at('EOF')) {
          params.push(this.eat('IDENT').value);
          this.tryEat('COMMA');
        }
        this.eat('RPAREN');
        const body = this.parseBlock(['ENDFUNC']);
        this.eat('ENDFUNC');
        return { type: 'FUNC_DEF', name, params, body, span: this.span(startPos) };
      }
      case 'EXEC': {
        this.eat();
        this.eat('MAST');
        return { type: 'EXEC_MAST', span: this.span(startPos) };
      }
      case 'MAST': {
        this.eat();
        if (this.at('LBRACE')) {
          // Brace-form: MAST { HASH 0x… = PROOF { body } … }
          this.eat('LBRACE');
          const branches: { hash: string; body: ASTNode[] }[] = [];
          while (!this.atAny('RBRACE', 'EOF')) {
            this.eat('HASH');             // HASH keyword
            const hash = this.eat('HEX').value;
            this.eat('ASSIGN');           // =
            this.eat('PROOF');            // PROOF keyword
            this.eat('LBRACE');           // opening {
            const branchBody = this.parseBlock(['RBRACE']);
            this.eat('RBRACE');           // closing }
            branches.push({ hash, body: branchBody });
          }
          this.eat('RBRACE');             // closing } of MAST block
          return { type: 'MAST_BLOCK', branches, span: this.span(startPos) };
        }
        const rootHash = this.parseExpr();
        return { type: 'MAST_STMT', rootHash, span: this.span(startPos) };
      }
      case 'IDENT': {
        const name = this.eat().value;
        if (this.at('LPAREN')) {
          this.eat('LPAREN');
          const args = this.parseSpaceArgList('RPAREN');
          this.eat('RPAREN');
          return { type: 'CALL_STMT', name, args, span: this.span(startPos) };
        }
        throw new Error(`Unexpected identifier '${name}' as statement at pos ${tok.pos}`);
      }
      default:
        throw new Error(`Unexpected token ${tok.kind} ('${tok.value}') at pos ${tok.pos}`);
    }
  }

  // ─── Expression parsing (recursive descent) ──────────────────────────────

  parseExpr(): ASTNode { return this.parseOr(); }

  private parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.at('OR')) {
      this.eat();
      const right = this.parseAnd();
      left = { type: 'BINARY', op: 'OR', left, right };
    }
    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseXor();
    while (this.at('AND')) {
      this.eat();
      const right = this.parseXor();
      left = { type: 'BINARY', op: 'AND', left, right };
    }
    return left;
  }

  private parseXor(): ASTNode {
    let left = this.parseNot();
    while (this.at('XOR')) {
      this.eat();
      const right = this.parseNot();
      left = { type: 'BINARY', op: 'XOR', left, right };
    }
    return left;
  }

  private parseNot(): ASTNode {
    if (this.at('NOT')) {
      this.eat();
      return { type: 'UNARY', op: 'NOT', expr: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): ASTNode {
    let left = this.parseShift();
    while (this.atAny('EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE')) {
      const op = this.eat().kind;
      const right = this.parseShift();
      left = { type: 'BINARY', op, left, right };
    }
    return left;
  }

  /** Bit-shift operators: lower precedence than arithmetic, higher than comparison */
  private parseShift(): ASTNode {
    let left = this.parseAddSub();
    while (this.atAny('LSHIFT', 'RSHIFT')) {
      const op = this.eat().kind;
      const right = this.parseAddSub();
      left = { type: 'BINARY', op, left, right };
    }
    return left;
  }

  private parseAddSub(): ASTNode {
    let left = this.parseMulDiv();
    while (this.atAny('ADD', 'SUB')) {
      const op = this.eat().kind;
      const right = this.parseMulDiv();
      left = { type: 'BINARY', op, left, right };
    }
    return left;
  }

  private parseMulDiv(): ASTNode {
    let left = this.parseUnary();
    while (this.atAny('MUL', 'DIV', 'MOD')) {
      const op = this.eat().kind;
      const right = this.parseUnary();
      left = { type: 'BINARY', op, left, right };
    }
    return left;
  }

  private parseUnary(): ASTNode {
    if (this.at('SUB')) {
      this.eat();
      return { type: 'UNARY', op: 'NEG', expr: this.parsePrimary() };
    }
    return this.parsePrimary();
  }

  parsePrimary(): ASTNode {
    const tok = this.peek();
    const startPos = tok.pos;

    switch (tok.kind) {
      case 'NUMBER': {
        this.eat();
        // Parse to MiniNumber (matching Java's MiniNumber semantics) — avoids
        // IEEE-754 float intermediary which loses precision.
        return { type: 'LITERAL', value: parseNumLiteral(tok.value), span: this.span(startPos) };
      }
      case 'HEX': {
        this.eat();
        return { type: 'LITERAL', kind: 'HEX', value: tok.value, span: this.span(startPos) };
      }
      case 'STRING': {
        this.eat();
        return { type: 'LITERAL', kind: 'STR', value: tok.value, span: this.span(startPos) };
      }
      case 'TRUE': {
        this.eat();
        return { type: 'LITERAL', kind: 'BOOL', value: true, span: this.span(startPos) };
      }
      case 'FALSE': {
        this.eat();
        return { type: 'LITERAL', kind: 'BOOL', value: false, span: this.span(startPos) };
      }
      case 'ATVAR': {
        this.eat();
        return { type: 'BUILTIN', name: tok.value, span: this.span(startPos) };
      }
      case 'LPAREN': {
        this.eat();
        const inner = this.parseExpr();
        this.eat('RPAREN');
        return inner;
      }
      case 'EXEC': {
        // Allow EXEC MAST as an expression (for RETURN EXEC MAST patterns)
        this.eat();
        this.eat('MAST');
        return { type: 'EXEC_MAST', span: this.span(startPos) };
      }
      case 'STATE': {
        this.eat();
        this.eat('LPAREN');
        const port = this.parseExpr();
        this.eat('RPAREN');
        return { type: 'STATE', port, span: this.span(startPos) };
      }
      case 'PREVSTATE': {
        this.eat();
        this.eat('LPAREN');
        const port = this.parseExpr();
        this.eat('RPAREN');
        return { type: 'PREVSTATE', port, span: this.span(startPos) };
      }
      case 'SAMESTATE': {
        this.eat();
        this.eat('LPAREN');
        const from = this.parseExpr();
        const to = this.parseExpr();
        this.eat('RPAREN');
        return { type: 'SAMESTATE', from, to, span: this.span(startPos) };
      }
      case 'SAMECOINS': {
        this.eat();
        return { type: 'SAMECOINS', span: this.span(startPos) };
      }
      case 'COINDATA': {
        this.eat();
        return { type: 'COINDATA', span: this.span(startPos) };
      }
      case 'SIGNEDBY': {
        this.eat();
        this.eat('LPAREN');
        const pubkey = this.parseExpr();
        this.eat('RPAREN');
        return { type: 'SIGNEDBY', pubkey, span: this.span(startPos) };
      }
      case 'MULTISIG': {
        this.eat();
        this.eat('LPAREN');
        const threshold = this.parseExpr();
        const keys: ASTNode[] = [];
        while (!this.atAny('RPAREN', 'EOF')) {
          this.tryEat('COMMA');
          if (this.at('RPAREN')) break;
          keys.push(this.parseExpr());
        }
        this.eat('RPAREN');
        return { type: 'MULTISIG', threshold, keys, span: this.span(startPos) };
      }
      case 'CHECKSIG': {
        this.eat();
        return { type: 'CHECKSIG', span: this.span(startPos) };
      }
      case 'SHA3':
      case 'SHA2':
      case 'HASH': {
        const fn = tok.kind as 'SHA3' | 'SHA2' | 'HASH';
        this.eat();
        this.eat('LPAREN');
        const expr = this.parseExpr();
        this.eat('RPAREN');
        return { type: 'HASH', fn, expr, span: this.span(startPos) };
      }
      case 'VERIFYOUT': {
        this.eat();
        this.eat('LPAREN');
        const index     = this.parseExpr(); this.tryEat('COMMA');
        const address   = this.parseExpr(); this.tryEat('COMMA');
        const amount    = this.parseExpr(); this.tryEat('COMMA');
        const tokenId   = this.parseExpr(); this.tryEat('COMMA');
        const keepState = this.parseExpr();
        this.eat('RPAREN');
        return { type: 'VERIFYOUT', index, address, amount, tokenId, keepState, span: this.span(startPos) };
      }
      case 'GETOUTAMT': {
        this.eat(); this.eat('LPAREN');
        const index = this.parseExpr(); this.eat('RPAREN');
        return { type: 'GETOUT', fn: 'AMT', index, span: this.span(startPos) };
      }
      case 'GETOUTADDR': {
        this.eat(); this.eat('LPAREN');
        const index = this.parseExpr(); this.eat('RPAREN');
        return { type: 'GETOUT', fn: 'ADDR', index, span: this.span(startPos) };
      }
      case 'GETOUTTOK': {
        this.eat(); this.eat('LPAREN');
        const index = this.parseExpr(); this.eat('RPAREN');
        return { type: 'GETOUT', fn: 'TOK', index, span: this.span(startPos) };
      }
      case 'GETOUTKEEPSTATE': {
        this.eat(); this.eat('LPAREN');
        const index = this.parseExpr(); this.eat('RPAREN');
        return { type: 'GETOUT', fn: 'KEEPSTATE', index, span: this.span(startPos) };
      }
      case 'SIGDIG': {
        this.eat(); this.eat('LPAREN');
        const digits = this.parseExpr(); this.tryEat('COMMA');
        const expr = this.parseExpr();
        this.eat('RPAREN');
        return { type: 'SIGDIG', digits, expr, span: this.span(startPos) };
      }
      case 'PROOF': {
        this.eat(); this.eat('LPAREN');
        const data     = this.parseExpr(); this.tryEat('COMMA');
        const leafSum  = this.parseExpr(); this.tryEat('COMMA');
        const rootHash = this.parseExpr(); this.tryEat('COMMA');
        const rootSum  = this.parseExpr(); this.tryEat('COMMA');
        const proof    = this.parseExpr();
        this.eat('RPAREN');
        return { type: 'PROOF', data, leafSum, rootHash, rootSum, proof, span: this.span(startPos) };
      }
      case 'MAST': {
        this.eat();
        const rootHash = this.parseExpr();
        return { type: 'MAST_EXPR', rootHash, span: this.span(startPos) };
      }
      case 'IDENT': {
        const name = this.eat().value;
        if (this.at('LPAREN')) {
          this.eat('LPAREN');
          const args = this.parseSpaceArgList('RPAREN');
          this.eat('RPAREN');
          return { type: 'CALL_EXPR', name, args, span: this.span(startPos) };
        }
        return { type: 'IDENT', name, span: this.span(startPos) };
      }
      default:
        throw new Error(`Unexpected token ${tok.kind} ('${tok.value}') at pos ${tok.pos}`);
    }
  }

  /** Parse a list of expressions separated by optional commas; stop at terminal */
  private parseSpaceArgList(terminal: TokenKind): ASTNode[] {
    const args: ASTNode[] = [];
    while (!this.at(terminal) && !this.at('EOF')) {
      args.push(this.parseExpr());
      this.tryEat('COMMA');
    }
    return args;
  }
}

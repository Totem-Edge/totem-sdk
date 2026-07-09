export type TokenKind =
  | 'NUMBER' | 'HEX' | 'STRING' | 'IDENT'
  | 'TRUE' | 'FALSE'
  | 'RETURN' | 'ASSERT' | 'LET'
  | 'IF' | 'THEN' | 'ELSE' | 'ENDIF'
  | 'FOR' | 'TO' | 'BY' | 'ENDFOR'
  | 'FOREACH' | 'IN'
  | 'SWITCH' | 'CASE' | 'DEFAULT' | 'ENDSWITCH'
  | 'STORE' | 'WITH'
  | 'FUNC' | 'ENDFUNC'
  | 'EXEC' | 'MAST' | 'PROOF'
  | 'AND' | 'OR' | 'XOR' | 'NOT'
  | 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE'
  | 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'MOD'
  | 'LSHIFT' | 'RSHIFT'
  | 'LPAREN' | 'RPAREN' | 'LBRACE' | 'RBRACE'
  | 'COMMA' | 'ASSIGN'
  | 'SIGNEDBY' | 'MULTISIG' | 'CHECKSIG'
  | 'SHA3' | 'SHA2' | 'HASH'
  | 'STATE' | 'PREVSTATE' | 'SAMESTATE' | 'SAMECOINS' | 'COINDATA'
  | 'VERIFYOUT' | 'GETOUTAMT' | 'GETOUTADDR' | 'GETOUTTOK' | 'GETOUTKEEPSTATE'
  | 'SIGDIG'
  | 'ATVAR'
  | 'EOF';

export interface Token {
  kind: TokenKind;
  value: string;
  pos: number;
}

const KEYWORDS: Record<string, TokenKind> = {
  TRUE: 'TRUE', FALSE: 'FALSE',
  RETURN: 'RETURN', ASSERT: 'ASSERT', LET: 'LET',
  IF: 'IF', THEN: 'THEN', ELSE: 'ELSE', ENDIF: 'ENDIF',
  FOR: 'FOR', TO: 'TO', BY: 'BY', ENDFOR: 'ENDFOR',
  FOREACH: 'FOREACH', IN: 'IN',
  SWITCH: 'SWITCH', CASE: 'CASE', DEFAULT: 'DEFAULT', ENDSWITCH: 'ENDSWITCH',
  STORE: 'STORE', WITH: 'WITH',
  FUNC: 'FUNC', ENDFUNC: 'ENDFUNC',
  EXEC: 'EXEC', MAST: 'MAST', PROOF: 'PROOF',
  AND: 'AND', OR: 'OR', XOR: 'XOR', NOT: 'NOT',
  EQ: 'EQ', NEQ: 'NEQ', GT: 'GT', GTE: 'GTE', LT: 'LT', LTE: 'LTE',
  ADD: 'ADD', SUB: 'SUB', MUL: 'MUL', DIV: 'DIV', MOD: 'MOD',
  LSHIFT: 'LSHIFT', RSHIFT: 'RSHIFT',
  SIGNEDBY: 'SIGNEDBY', MULTISIG: 'MULTISIG', CHECKSIG: 'CHECKSIG',
  SHA3: 'SHA3', SHA2: 'SHA2', HASH: 'HASH',
  STATE: 'STATE', PREVSTATE: 'PREVSTATE', SAMESTATE: 'SAMESTATE',
  SAMECOINS: 'SAMECOINS', COINDATA: 'COINDATA',
  VERIFYOUT: 'VERIFYOUT', GETOUTAMT: 'GETOUTAMT', GETOUTADDR: 'GETOUTADDR',
  GETOUTTOK: 'GETOUTTOK', GETOUTKEEPSTATE: 'GETOUTKEEPSTATE',
  SIGDIG: 'SIGDIG',
};

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const start = i;
    const ch = source[i];

    if (/\s/.test(ch)) { i++; continue; }

    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    if (ch === '(' ) { tokens.push({ kind: 'LPAREN',  value: '(', pos: start }); i++; continue; }
    if (ch === ')' ) { tokens.push({ kind: 'RPAREN',  value: ')', pos: start }); i++; continue; }
    if (ch === '{' ) { tokens.push({ kind: 'LBRACE',  value: '{', pos: start }); i++; continue; }
    if (ch === '}' ) { tokens.push({ kind: 'RBRACE',  value: '}', pos: start }); i++; continue; }
    if (ch === ',' ) { tokens.push({ kind: 'COMMA',   value: ',', pos: start }); i++; continue; }
    if (ch === '+' ) { tokens.push({ kind: 'ADD',     value: '+', pos: start }); i++; continue; }
    if (ch === '-' ) { tokens.push({ kind: 'SUB',     value: '-', pos: start }); i++; continue; }
    if (ch === '*' ) { tokens.push({ kind: 'MUL',     value: '*', pos: start }); i++; continue; }
    if (ch === '%' ) { tokens.push({ kind: 'MOD',     value: '%', pos: start }); i++; continue; }
    if (ch === '=') {
      if (source[i + 1] === '=') { tokens.push({ kind: 'EQ', value: '==', pos: start }); i += 2; }
      else { tokens.push({ kind: 'ASSIGN', value: '=', pos: start }); i++; }
      continue;
    }
    if (ch === '!') {
      if (source[i + 1] === '=') { tokens.push({ kind: 'NEQ', value: '!=', pos: start }); i += 2; }
      else { tokens.push({ kind: 'NOT', value: '!', pos: start }); i++; }
      continue;
    }
    if (ch === '>') {
      if (source[i + 1] === '>') { tokens.push({ kind: 'RSHIFT', value: '>>', pos: start }); i += 2; }
      else if (source[i + 1] === '=') { tokens.push({ kind: 'GTE', value: '>=', pos: start }); i += 2; }
      else { tokens.push({ kind: 'GT', value: '>', pos: start }); i++; }
      continue;
    }
    if (ch === '<') {
      if (source[i + 1] === '<') { tokens.push({ kind: 'LSHIFT', value: '<<', pos: start }); i += 2; }
      else if (source[i + 1] === '=') { tokens.push({ kind: 'LTE', value: '<=', pos: start }); i += 2; }
      else { tokens.push({ kind: 'LT', value: '<', pos: start }); i++; }
      continue;
    }

    if (ch === '/') { tokens.push({ kind: 'DIV', value: '/', pos: start }); i++; continue; }

    if (ch === '[') {
      i++;
      let s = '';
      while (i < source.length && source[i] !== ']') {
        s += source[i++];
      }
      if (source[i] === ']') i++;
      if (new TextEncoder().encode(s).length > 65536) {
        throw new Error(`String literal at pos ${start} exceeds 64 KB limit`);
      }
      tokens.push({ kind: 'STRING', value: s, pos: start });
      continue;
    }

    if (ch === '0' && (source[i + 1] === 'x' || source[i + 1] === 'X')) {
      i += 2;
      let hex = '0x';
      while (i < source.length && /[0-9a-fA-F]/.test(source[i])) {
        hex += source[i++];
      }
      // Hex literal byte length = (digits) / 2
      if ((hex.length - 2) / 2 > 65536) {
        throw new Error(`Hex literal at pos ${start} exceeds 64 KB limit`);
      }
      tokens.push({ kind: 'HEX', value: hex.toLowerCase(), pos: start });
      continue;
    }

    if (/[0-9]/.test(ch)) {
      let num = '';
      while (i < source.length && /[0-9]/.test(source[i])) num += source[i++];
      if (source[i] === '.' && /[0-9]/.test(source[i + 1])) {
        num += source[i++];
        while (i < source.length && /[0-9]/.test(source[i])) num += source[i++];
      }
      tokens.push({ kind: 'NUMBER', value: num, pos: start });
      continue;
    }

    if (ch === '@') {
      i++;
      let name = '';
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) name += source[i++];
      tokens.push({ kind: 'ATVAR', value: name.toUpperCase(), pos: start });
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let word = '';
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) word += source[i++];
      const upper = word.toUpperCase();
      const kw = KEYWORDS[upper];
      if (kw) {
        tokens.push({ kind: kw, value: upper, pos: start });
      } else {
        tokens.push({ kind: 'IDENT', value: word, pos: start });
      }
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at position ${start}`);
  }

  tokens.push({ kind: 'EOF', value: '', pos: i });
  return tokens;
}

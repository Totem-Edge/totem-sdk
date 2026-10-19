import { toNodeScript } from '../canonical.js';

describe('toNodeScript (node KISSVM canonicalization)', () => {
  it('lowercases variable names and strips digits/underscores', () => {
    expect(toNodeScript('LET SHARE0=PREVSTATE(128) RETURN SHARE0')).toBe(
      'LET share=PREVSTATE(128) RETURN share',
    );
    expect(toNodeScript('LET prevClaimed = 1 LET expiresAt = 2 RETURN prevClaimed + expiresAt')).toBe(
      'LET prevclaimed = 1 LET expiresat = 2 RETURN prevclaimed + expiresat',
    );
  });

  it('rewrites the hex prefix to lowercase 0x', () => {
    expect(toNodeScript('ASSERT SIGNEDBY(0X' + 'AA'.repeat(32) + ')')).toContain('0x' + 'AA'.repeat(32));
  });

  it('rewrites ADD/SUB to + / -', () => {
    expect(toNodeScript('RETURN @AMOUNT SUB 1')).toBe('RETURN @AMOUNT - 1');
    expect(toNodeScript('RETURN 1 ADD 2')).toBe('RETURN 1 + 2');
  });

  it('preserves functions, keywords, globals, hex and [..] literals', () => {
    const s = 'IF @BLOCK GTE PREVSTATE(102) THEN ASSERT VERIFYOUT(0 0xAB 1 @TOKENID FALSE) ENDIF';
    expect(toNodeScript(s)).toBe(s);
    expect(toNodeScript('MAST [RETURN SIGNEDBY(0xAB)]')).toBe('MAST [RETURN SIGNEDBY(0xAB)]');
  });

  it('de-collides lowercase collisions deterministically', () => {
    const out = toNodeScript('LET A = 1 LET a = 2 RETURN A + a');
    // two distinct variables must remain two distinct canonical names
    const names = out.match(/LET ([a-z]+) =/g)!;
    expect(names[0]).not.toBe(names[1]);
  });

  it('is idempotent', () => {
    const s = 'LET stage=STATE(101) LET share0=PREVSTATE(128) RETURN share0 + @AMOUNT - 1';
    const once = toNodeScript(s);
    expect(toNodeScript(once)).toBe(once);
    for (const m of once.matchAll(/LET ([A-Za-z0-9_]+)/g)) expect(m[1]).toMatch(/^[a-z]+$/);
  });
});

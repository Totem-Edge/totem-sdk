/**
 * RFC-020 H8: KISSVM `FUNCTION` must not allow sandbox escapes — arguments are
 * bound as values (never text-substituted into re-parsed code), and the
 * instruction/call-depth budget is shared with the parent frame.
 */
import { evaluateScript } from '../index';
import { VMState } from '../vm.js';
import type { ScriptWitness, TxContext } from '../types.js';

function ctx(state: Record<number, string> = {}): TxContext {
  return {
    block: 1000,
    inputIndex: 0,
    inputs: [{ amount: 1, tokenId: '0x00', coinId: '0xabc', address: '0xAA' }],
    outputs: [],
    state,
    prevState: {},
    simulationMode: true,
  };
}
function witness(): ScriptWitness {
  return { signatures: new Map() };
}

describe('RFC-020 H8: FUNCTION sandbox', () => {
  test('binds arguments as values and evaluates arithmetic correctly', () => {
    const res = evaluateScript('RETURN FUNCTION([LET r = $1 ADD $2] 2 3) EQ 5', witness(), ctx());
    expect(res.passed).toBe(true);
  });

  test('does not execute opcodes embedded in an argument value', () => {
    const script = [
      'LET f = [LET r = $1]',
      'LET v = FUNCTION(f STATE(0))',
      'RETURN v EQ STATE(0)',
    ].join('\n');
    // If `$1` were text-substituted, the body would become
    // `LET r = 1 RETURN FALSE` and the function would return FALSE.
    const res = evaluateScript(script, witness(), ctx({ 0: '[1 RETURN FALSE]' }));
    expect(res.passed).toBe(true);
  });

  test('shares the instruction budget with the parent frame', () => {
    const parent = new VMState(witness(), ctx());
    const child = new VMState(witness(), ctx());
    parent.instructionCount = 5;
    child.adoptLimitsFrom(parent);
    expect(child.instructionCount).toBe(5);
    child.tick(3);
    child.flushLimitsTo(parent);
    expect(parent.instructionCount).toBe(8);
  });
});

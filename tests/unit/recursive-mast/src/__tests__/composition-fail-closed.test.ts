/**
 * RFC-018 RM-COMPOSE-001: composing a terminal MAST must fail closed.
 *
 * MAST is terminal, so appending it after a layer's `RETURN` makes the child
 * branch dead. Only a terminal `RETURN TRUE` may be stripped; any other
 * terminal RETURN (an explicit deny) must abort composition.
 */
import {
  toNestedMastScript,
  computeCanonicalScriptHash,
  compileMastTree,
  buildPrevStateWorkflow,
  counterWorkflow,
  buildMigrationStep,
  buildMigrationPath,
  buildMigrationScript,
  toMigrationPathScript,
  buildDelegationScript,
  type ProofChain,
} from '../index.js';

const pkB = 'bb'.repeat(32);

function chainWithParent(parentScript: string): ProofChain {
  const childScript = `ASSERT SIGNEDBY(0x${pkB})\nRETURN TRUE`;
  const childMast = compileMastTree([childScript]);
  return {
    links: [
      {
        scriptHash: computeCanonicalScriptHash(parentScript),
        policyRoot: computeCanonicalScriptHash(parentScript),
        proof: '',
        script: parentScript,
      },
      {
        scriptHash: computeCanonicalScriptHash(childScript),
        policyRoot: childMast.rootHex,
        proof: '',
        script: childScript,
      },
    ],
    depth: 2,
    verified: false,
    leafScriptHash: '',
  };
}

describe('RFC-018 RM-COMPOSE-001: composition fails closed', () => {
  it('rejects an empty proof chain instead of compiling to allow-all', () => {
    const empty: ProofChain = { links: [], depth: 0, verified: false, leafScriptHash: '' };
    expect(() => toNestedMastScript(empty)).toThrow(/empty/i);
  });

  it('refuses a parent layer whose terminal RETURN is not TRUE', () => {
    expect(() => toNestedMastScript(chainWithParent('ASSERT STATE(0) EQ [a]\nRETURN FALSE'))).toThrow(
      /RETURN TRUE/,
    );
  });

  it('strips an inline RETURN TRUE so the child MAST is reachable', () => {
    const chain = chainWithParent('ASSERT STATE(0) EQ [a] RETURN TRUE');
    const script = toNestedMastScript(chain);
    const lines = script.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(lines).toContain('ASSERT STATE(0) EQ [a]');
    expect(lines.filter((l) => /RETURN TRUE/i.test(l))).toHaveLength(0);
    expect(lines[lines.length - 1]).toBe(`MAST 0x${chain.links[1].policyRoot}`);
  });
});

describe('RFC-018 P2-2: prevstate workflows terminate', () => {
  it('rejects an empty workflow instead of allow-all', () => {
    expect(() => buildPrevStateWorkflow('x', 'X', [])).toThrow(/at least one transition/);
  });

  it('emits a terminal RETURN for generated workflows', () => {
    expect(/(?:^|\n)\s*RETURN\b/i.test(counterWorkflow(1, 10).script.trim())).toBe(true);
  });
});

describe('RFC-018 P2-2: migration path composition', () => {
  it('rejects an empty migration path', () => {
    expect(() =>
      toMigrationPathScript({ steps: [], originalRoot: '', currentRoot: '', complete: false }),
    ).toThrow(/empty migration path/);
  });

  it('delegates each step to the next composed script', () => {
    const path = buildMigrationPath([
      buildMigrationStep('aa', 'bb', 10, 20, ''),
      buildMigrationStep('bb', 'cc', 20, 30, ''),
    ]);
    const script = toMigrationPathScript(path);
    const inner = buildMigrationScript('bb', 'cc', 20, 30);
    expect(script).toContain(`MAST 0x${computeCanonicalScriptHash(inner)}`);
  });

  it('terminates each window with a single MAST and no dead RETURN (RFC-020 P2-7)', () => {
    const script = buildMigrationScript('aa', 'bb', 10, 20);
    expect(script).toContain('MAST 0xaa');
    expect(script).toContain('MAST 0xbb');
    // No RETURN after a terminal MAST.
    expect(script).not.toMatch(/MAST 0x[0-9a-f]+[^\n]*\n\s*RETURN/i);
    expect(script).not.toContain('deprecation');
  });
});

describe('RFC-020 H9: delegation-script key validation', () => {
  it('rejects a delegator that is not exactly 64 hex characters', () => {
    expect(() => buildDelegationScript('aa\nRETURN TRUE', 'bb'.repeat(32))).toThrow(/64 hex/);
  });
});
